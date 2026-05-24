import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { readJsonObjectArtifactResult } from './artifactReaders';
import { normalizePath, WorkspacePaths } from './workspace';

/**
 * A structured architecture constraint rule extracted from a dream
 * proposal rejection. Used to prevent repeated mistakes and to inject
 * project-specific architectural knowledge into the Navigator prompt.
 */
export interface DreamRuleEntry {
    ruleId: string;
    proposalId: string;
    decisionId: string;

    /** Human-readable summary of the rule, e.g.
     * "Payment modules must be referenced through IPaymentStrategy,
     * never directly coupled to ConcretePaymentGateway." */
    summary: string;

    /** The nature of the constraint. */
    constraintType: 'forbid' | 'require' | 'exempt';

    /** Glob-like or source-path pattern describing where the rule applies.
     *  e.g. "src/payment/**" or "src/services/*.ts" */
    targetPattern: string;

    /** Optional category hint (frontend, backend, core). */
    category?: string;

    /** LLM self-assessed confidence (0–1). */
    confidence: number;

    /** Reference back to the source proposal. */
    sourceProposalId: string;
    sourceProposalTitle: string;

    /** Reference back to the rejection decision. */
    sourceRejectionId: string;

    createdAt: string;
    updatedAt: string;

    /** Soft-delete flag; ttl-expired rules are marked inactive rather than removed. */
    active: boolean;

    /** Optional time-to-live in days. When set and the current date exceeds
     *  createdAt + ttl days, the rule is automatically deactivated. */
    ttlDays?: number;
}

export interface DreamRuleLedger {
    schemaVersion: '1.0';
    project: string;
    updatedAt: string;
    rules: DreamRuleEntry[];
}

export interface DreamRuleLoadResult {
    status: 'ok' | 'not_found' | 'shape_invalid';
    ledger: DreamRuleLedger;
}

export interface DreamRuleAddInput {
    summary: string;
    constraintType: DreamRuleEntry['constraintType'];
    targetPattern: string;
    category?: string;
    confidence: number;
    sourceProposalId: string;
    sourceProposalTitle: string;
    sourceRejectionId: string;
    ttlDays?: number;
}

const RULE_LEDGER_FILENAME = 'dream-rules.json';

export function getDreamRuleFilePath(paths: Pick<WorkspacePaths, 'triadDir'>): string {
    return path.join(paths.triadDir, RULE_LEDGER_FILENAME);
}

export function loadDreamRuleLedger(paths: Pick<WorkspacePaths, 'triadDir'>): DreamRuleLoadResult {
    const filePath = getDreamRuleFilePath(paths);
    const readResult = readJsonObjectArtifactResult<Record<string, unknown>>(filePath);
    if (readResult.status !== 'ok' || !readResult.value) {
        const mappedStatus = readResult.status === 'ok' || readResult.status === 'missing'
            ? 'not_found'
            : 'shape_invalid';
        return {
            status: mappedStatus,
            ledger: createEmptyDreamRuleLedger(paths)
        };
    }

    const value = readResult.value;
    if (value.schemaVersion && value.schemaVersion !== '1.0') {
        return { status: 'shape_invalid', ledger: createEmptyDreamRuleLedger(paths) };
    }

    const rulesRaw = value.rules;
    if (rulesRaw !== undefined && !Array.isArray(rulesRaw)) {
        return { status: 'shape_invalid', ledger: createEmptyDreamRuleLedger(paths) };
    }

    const rules = Array.isArray(rulesRaw)
        ? rulesRaw.map((entry) => normalizeRuleEntry(entry)).filter(isDefined)
        : [];

    return {
        status: 'ok',
        ledger: {
            schemaVersion: '1.0',
            project: normalizeText(value.project) || path.basename(paths.triadDir),
            updatedAt: normalizeText(value.updatedAt) || new Date().toISOString(),
            rules
        }
    };
}

export function saveDreamRuleLedger(
    paths: Pick<WorkspacePaths, 'triadDir'>,
    ledger: DreamRuleLedger
): void {
    const filePath = getDreamRuleFilePath(paths);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(ledger, null, 2), 'utf-8');
}

export function addDreamRule(
    paths: Pick<WorkspacePaths, 'triadDir'>,
    input: DreamRuleAddInput
): { rule: DreamRuleEntry; ledger: DreamRuleLedger } {
    const loadResult = loadDreamRuleLedger(paths);
    const now = new Date().toISOString();
    const rule: DreamRuleEntry = {
        ruleId: buildRuleId(input),
        proposalId: input.sourceProposalId,
        decisionId: input.sourceRejectionId,
        summary: input.summary,
        constraintType: input.constraintType,
        targetPattern: input.targetPattern,
        category: input.category || undefined,
        confidence: clampNumber(input.confidence, 0, 1),
        sourceProposalId: input.sourceProposalId,
        sourceProposalTitle: input.sourceProposalTitle,
        sourceRejectionId: input.sourceRejectionId,
        createdAt: now,
        updatedAt: now,
        active: true,
        ttlDays: input.ttlDays && input.ttlDays > 0 ? input.ttlDays : undefined
    };

    const ledger: DreamRuleLedger = {
        schemaVersion: '1.0',
        project: loadResult.ledger.project,
        updatedAt: now,
        rules: [...loadResult.ledger.rules, rule]
    };

    saveDreamRuleLedger(paths, ledger);
    return { rule, ledger };
}

export function deactivateDreamRule(
    paths: Pick<WorkspacePaths, 'triadDir'>,
    ruleId: string
): boolean {
    const loadResult = loadDreamRuleLedger(paths);
    let found = false;
    const updatedRules = loadResult.ledger.rules.map((r) => {
        if (r.ruleId === ruleId && r.active) {
            found = true;
            return { ...r, active: false, updatedAt: new Date().toISOString() };
        }
        return r;
    });
    if (!found) return false;

    saveDreamRuleLedger(paths, {
        ...loadResult.ledger,
        updatedAt: new Date().toISOString(),
        rules: updatedRules
    });
    return true;
}

/** Return only rules that are active and not expired. */
export function getActiveRules(ledger: DreamRuleLedger): DreamRuleEntry[] {
    const now = Date.now();
    return ledger.rules.filter((r) => {
        if (!r.active) return false;
        if (r.ttlDays && r.ttlDays > 0) {
            const expiresAt = new Date(r.createdAt).getTime() + r.ttlDays * 86_400_000;
            if (now > expiresAt) return false;
        }
        return true;
    });
}

/** Format active rules for injection into Navigator / Dream prompts. */
export function formatActiveRulesPrompt(ledger: DreamRuleLedger): string {
    const active = getActiveRules(ledger);
    if (active.length === 0) return '';

    const lines = ['CRITICAL_CONSTRAINTS_FROM_PAST_MISTAKES:'];
    for (const rule of active) {
        const ctx = `[${rule.constraintType.toUpperCase()}] ${rule.summary}`;
        const scope = rule.targetPattern ? ` (scope: ${rule.targetPattern})` : '';
        const src = rule.sourceProposalTitle
            ? ` — from rejected proposal: ${rule.sourceProposalTitle}`
            : '';
        lines.push(`- ${ctx}${scope}${src}`);
    }
    return lines.join('\n');
}

/** Deactivate rules that have expired TTL. Returns number of deactivated rules. */
export function expireStaleRules(
    paths: Pick<WorkspacePaths, 'triadDir'>
): number {
    const loadResult = loadDreamRuleLedger(paths);
    const now = Date.now();
    let expiredCount = 0;
    const updated = loadResult.ledger.rules.map((r) => {
        if (!r.active) return r;
        if (r.ttlDays && r.ttlDays > 0) {
            const expiresAt = new Date(r.createdAt).getTime() + r.ttlDays * 86_400_000;
            if (now > expiresAt) {
                expiredCount += 1;
                return { ...r, active: false, updatedAt: new Date().toISOString() };
            }
        }
        return r;
    });
    if (expiredCount > 0) {
        saveDreamRuleLedger(paths, {
            ...loadResult.ledger,
            updatedAt: new Date().toISOString(),
            rules: updated
        });
    }
    return expiredCount;
}

// ─── Similarity & Conflict Detection ────────────────────────────

export type ConflictType = 'direct_contradiction' | 'overlapping_scope' | 'near_duplicate';

export interface RuleConflict {
    type: ConflictType;
    ruleA: DreamRuleEntry;
    ruleB: DreamRuleEntry;
    similarity: number;
    detail: string;
}

export interface ConflictReport {
    conflicts: RuleConflict[];
    totalActiveRules: number;
    conflictedRuleIds: string[];
}

/**
 * Compute Jaccard similarity between two strings based on word tokens.
 * 1.0 = identical token sets; 0.0 = no overlap.
 */
export function jaccardSimilarity(a: string, b: string): number {
    const tokenize = (s: string): Set<string> => {
        // Split ASCII words on whitespace/punctuation; split CJK into individual chars
        const tokens: string[] = [];
        const asciiWords = s.toLowerCase().split(/[^a-zA-Z0-9]+/).filter(Boolean);
        for (const word of asciiWords) {
            // Break CJK-mixed tokens into individual chars if they contain CJK
            if (/[\u4e00-\u9fff]/.test(word)) {
                for (const ch of word) {
                    if (/[\u4e00-\u9fff0-9a-zA-Z]/.test(ch)) tokens.push(ch);
                }
            } else {
                tokens.push(word);
            }
        }
        return new Set(tokens);
    };
    const setA = tokenize(a);
    const setB = tokenize(b);
    if (setA.size === 0 && setB.size === 0) return 1;
    const intersection = new Set([...setA].filter((t) => setB.has(t)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
}

/**
 * Find all conflicts within the given rules.
 * When `newRule` is provided, only check that rule against the rest (for
 * pre-add validation). When omitted, do a full pairwise scan.
 */
export function findConflictingRules(
    ledger: DreamRuleLedger,
    newRule?: DreamRuleEntry
): ConflictReport {
    const candidates = getActiveRules(ledger);
    if (candidates.length < 2 && !newRule) {
        return { conflicts: [], totalActiveRules: candidates.length, conflictedRuleIds: [] };
    }

    const conflicts: RuleConflict[] = [];
    const seenPair = new Set<string>();

    const processPair = (a: DreamRuleEntry, b: DreamRuleEntry) => {
        // Always order by ruleId to avoid (A,B) vs (B,A) duplicates
        const [first, second] = a.ruleId < b.ruleId ? [a, b] : [b, a];
        const pairKey = `${first.ruleId}::${second.ruleId}`;
        if (seenPair.has(pairKey)) return;
        seenPair.add(pairKey);

        const sim = jaccardSimilarity(first.summary, second.summary);
        const sameScope = first.targetPattern === second.targetPattern;
        const sameCategory = first.category === second.category && Boolean(first.category);

        // 1. Direct contradiction: same scope, opposite constraint types
        if (sameScope && first.constraintType !== second.constraintType) {
            const isOpposite =
                (first.constraintType === 'forbid' && second.constraintType === 'require') ||
                (first.constraintType === 'require' && second.constraintType === 'forbid');
            if (isOpposite) {
                conflicts.push({
                    type: 'direct_contradiction',
                    ruleA: first,
                    ruleB: second,
                    similarity: sim,
                    detail: `Scope "${first.targetPattern}" has contradictory rules: [FORBID] vs [REQUIRE].`
                });
                return;
            }
        }

        // 2. Near duplicate: same constraint type + high summary similarity
        if (first.constraintType === second.constraintType && sim >= 0.7) {
            const sameScopeBonus = sameScope ? ' (same scope)' : '';
            conflicts.push({
                type: 'near_duplicate',
                ruleA: first,
                ruleB: second,
                similarity: sim,
                detail: `Rules are near-duplicates with similarity ${sim.toFixed(2)}${sameScopeBonus}: "${first.summary}" ~ "${second.summary}"`
            });
            return;
        }

        // 3. Overlapping scope: same category + similar targetPattern
        if (sameCategory && sim >= 0.5 && first.constraintType === second.constraintType) {
            conflicts.push({
                type: 'overlapping_scope',
                ruleA: first,
                ruleB: second,
                similarity: sim,
                detail: `Rules overlap in category "${first.category}" with similarity ${sim.toFixed(2)}.`
            });
        }
    };

    if (newRule) {
        for (const existing of candidates) {
            if (existing.ruleId === newRule.ruleId) continue;
            processPair(newRule, existing);
        }
    } else {
        for (let i = 0; i < candidates.length; i++) {
            for (let j = i + 1; j < candidates.length; j++) {
                processPair(candidates[i], candidates[j]);
            }
        }
    }

    const conflictedRuleIds = [...new Set(conflicts.flatMap((c) => [c.ruleA.ruleId, c.ruleB.ruleId]))];
    return { conflicts, totalActiveRules: candidates.length, conflictedRuleIds };
}

export interface DeduplicateResult {
    removedCount: number;
    mergedPairs: Array<{
        survivor: DreamRuleEntry;
        removed: DreamRuleEntry;
        reason: string;
    }>;
}

/**
 * Deduplicate near-duplicate rules by keeping the one with higher confidence
 * (or more recent if confidence is tied) and deactivating the rest.
 * Returns statistics about what was merged.
 */
export function deduplicateRules(
    paths: Pick<WorkspacePaths, 'triadDir'>
): DeduplicateResult {
    const loadResult = loadDreamRuleLedger(paths);
    const active = getActiveRules(loadResult.ledger);
    const mergedPairs: DeduplicateResult['mergedPairs'] = [];
    const toDeactivate = new Set<string>();

    // Group by (targetPattern, constraintType) for targeted comparison
    const groups = new Map<string, DreamRuleEntry[]>();
    for (const rule of active) {
        const key = `${rule.targetPattern}::${rule.constraintType}`;
        const group = groups.get(key) ?? [];
        group.push(rule);
        groups.set(key, group);
    }

    for (const [, group] of groups) {
        if (group.length < 2) continue;

        for (let i = 0; i < group.length; i++) {
            if (toDeactivate.has(group[i].ruleId)) continue;
            for (let j = i + 1; j < group.length; j++) {
                if (toDeactivate.has(group[j].ruleId)) continue;

                const sim = jaccardSimilarity(group[i].summary, group[j].summary);
                if (sim < 0.7) continue;

                // Decide survivor: higher confidence wins; tie → newer wins
                const a = group[i];
                const b = group[j];
                const survivor = a.confidence >= b.confidence ? a : b;
                const removed = a.confidence >= b.confidence ? b : a;

                toDeactivate.add(removed.ruleId);
                mergedPairs.push({
                    survivor,
                    removed,
                    reason: `Near-duplicate (sim=${sim.toFixed(2)}): kept "${survivor.summary}" over "${removed.summary}"`
                });
            }
        }
    }

    if (toDeactivate.size === 0) {
        return { removedCount: 0, mergedPairs: [] };
    }

    const updatedRules = loadResult.ledger.rules.map((r) => {
        if (toDeactivate.has(r.ruleId)) {
            return { ...r, active: false, updatedAt: new Date().toISOString() };
        }
        return r;
    });

    saveDreamRuleLedger(paths, {
        ...loadResult.ledger,
        updatedAt: new Date().toISOString(),
        rules: updatedRules
    });

    return { removedCount: toDeactivate.size, mergedPairs };
}

/**
 * Check for potential duplicates/conflicts before adding a new rule.
 * Returns warnings (not blocking) so the caller can decide whether to proceed.
 */
export function checkForDuplicateBeforeAdd(
    paths: Pick<WorkspacePaths, 'triadDir'>,
    input: DreamRuleAddInput
): {
    isExactDuplicate: boolean;
    conflicts: RuleConflict[];
    warnings: string[];
} {
    const loadResult = loadDreamRuleLedger(paths);
    const existingActive = getActiveRules(loadResult.ledger);

    // Synthesize a temporary DreamRuleEntry for comparison
    const candidate: DreamRuleEntry = {
        ruleId: buildRuleId(input),
        proposalId: input.sourceProposalId,
        decisionId: input.sourceRejectionId,
        summary: input.summary,
        constraintType: input.constraintType,
        targetPattern: input.targetPattern,
        category: input.category,
        confidence: input.confidence,
        sourceProposalId: input.sourceProposalId,
        sourceProposalTitle: input.sourceProposalTitle,
        sourceRejectionId: input.sourceRejectionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        active: true,
        ttlDays: input.ttlDays
    };

    // Exact duplicate check
    const isExactDuplicate = existingActive.some(
        (r) =>
            r.targetPattern === candidate.targetPattern &&
            r.constraintType === candidate.constraintType &&
            jaccardSimilarity(r.summary, candidate.summary) >= 0.9
    );

    // Conflict check
    const report = findConflictingRules(loadResult.ledger, candidate);
    const warnings: string[] = [];
    for (const conflict of report.conflicts) {
        warnings.push(`Conflict with ${conflict.ruleB.ruleId}: ${conflict.detail}`);
    }

    return { isExactDuplicate, conflicts: report.conflicts, warnings };
}

// ─── Internal helpers ───────────────────────────────────────────

function createEmptyDreamRuleLedger(paths: Pick<WorkspacePaths, 'triadDir'>): DreamRuleLedger {
    return {
        schemaVersion: '1.0',
        project: path.basename(paths.triadDir),
        updatedAt: new Date().toISOString(),
        rules: []
    };
}

function buildRuleId(input: DreamRuleAddInput): string {
    const hash = crypto
        .createHash('sha256')
        .update(`${input.summary}::${input.targetPattern}::${input.constraintType}`)
        .digest('hex')
        .slice(0, 12);
    return `RULE_${hash}`;
}

function normalizeRuleEntry(value: unknown): DreamRuleEntry | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const r = value as Record<string, unknown>;
    const ruleId = normalizeText(r.ruleId);
    const summary = normalizeText(r.summary);
    const sourceProposalId = normalizeText(r.sourceProposalId);
    if (!ruleId || !summary) return undefined;

    return {
        ruleId,
        proposalId: normalizeText(r.proposalId) || sourceProposalId,
        decisionId: normalizeText(r.decisionId) || ruleId,
        summary,
        constraintType: normalizeConstraintType(r.constraintType),
        targetPattern: normalizeText(r.targetPattern) || '*',
        category: normalizeText(r.category) || undefined,
        confidence: clampNumber(Number(r.confidence) || 0.5, 0, 1),
        sourceProposalId,
        sourceProposalTitle: normalizeText(r.sourceProposalTitle) || sourceProposalId,
        sourceRejectionId: normalizeText(r.sourceRejectionId) || ruleId,
        createdAt: normalizeText(r.createdAt) || new Date().toISOString(),
        updatedAt: normalizeText(r.updatedAt) || new Date().toISOString(),
        active: r.active !== false,
        ttlDays: Number.isFinite(r.ttlDays) ? Math.max(1, Number(r.ttlDays)) : undefined
    };
}

function normalizeConstraintType(value: unknown): DreamRuleEntry['constraintType'] {
    const s = String(value ?? '').trim().toLowerCase();
    if (s === 'forbid' || s === 'require' || s === 'exempt') return s;
    return 'forbid';
}

function normalizeText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
