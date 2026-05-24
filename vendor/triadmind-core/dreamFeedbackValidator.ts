/**
 * dreamFeedbackValidator.ts
 *
 * Validates that active architecture constraint rules are being respected
 * by the latest dream proposals. Reports compliance, violations, and
 * blind spots where rules exist but no proposals tested them.
 */

import * as path from 'path';
import { loadDreamRuleLedger, getActiveRules, type DreamRuleEntry } from './dreamRuleLedger';
import type { DreamProposal } from './dream';
import { loadLatestDreamReport } from './dream';
import type { WorkspacePaths } from './workspace';

// ─── Public types ───────────────────────────────────────────────

export type ValidationVerdict = 'compliant' | 'violated' | 'untested';

export interface RuleValidationEntry {
    rule: DreamRuleEntry;
    verdict: ValidationVerdict;
    violatingProposals: Array<{
        id: string;
        title: string;
        reason: string;
    }>;
    compliantProposals: string[];
}

export interface ValidationReport {
    schemaVersion: '1.0';
    generatedAt: string;
    project: string;
    summary: {
        totalRules: number;
        compliant: number;
        violated: number;
        untested: number;
        overallScore: number; // 0-1
    };
    entries: RuleValidationEntry[];
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Validate the latest dream proposals against active architecture rules.
 * Returns a structured report showing which rules are being respected,
 * which are violated, and which have not been tested by any proposal.
 */
export function validateFeedback(
    paths: WorkspacePaths
): ValidationReport {
    const ruleLoad = loadDreamRuleLedger(paths);
    const activeRules = getActiveRules(ruleLoad.ledger);
    const report = loadLatestDreamReport(paths);
    const proposals = report?.proposals ?? [];

    const entries: RuleValidationEntry[] = activeRules.map((rule) => {
        return validateRuleAgainstProposals(rule, proposals);
    });

    const compliant = entries.filter((e) => e.verdict === 'compliant').length;
    const violated = entries.filter((e) => e.verdict === 'violated').length;
    const untested = entries.filter((e) => e.verdict === 'untested').length;
    const totalEntries = entries.length;

    // overallScore: 1.0 = perfect compliance, 0.0 = all violated
    const overallScore = totalEntries > 0
        ? (compliant + untested * 0.5) / totalEntries
        : 1.0;

    return {
        schemaVersion: '1.0',
        generatedAt: new Date().toISOString(),
        project: ruleLoad.ledger.project,
        summary: {
            totalRules: totalEntries,
            compliant,
            violated,
            untested,
            overallScore
        },
        entries
    };
}

// ─── Internal ───────────────────────────────────────────────────

function validateRuleAgainstProposals(
    rule: DreamRuleEntry,
    proposals: DreamProposal[]
): RuleValidationEntry {
    const violatingProposals: RuleValidationEntry['violatingProposals'] = [];
    const compliantProposals: string[] = [];
    const pattern = buildMatchPattern(rule.targetPattern);

    for (const proposal of proposals) {
        const proposalScope = collectProposalScope(proposal);
        const matchesScope = proposalScope.some((scope) => pattern.test(scope));
        if (!matchesScope) {
            continue; // rule does not apply to this proposal's scope
        }

        if (rule.constraintType === 'forbid') {
            // A "forbid" rule is violated if the proposal targets matching scope
            violatingProposals.push({
                id: proposal.id,
                title: proposal.title,
                reason: `Proposal targets scope matching "${rule.targetPattern}" which is forbidden.`
            });
        } else if (rule.constraintType === 'require') {
            // A "require" rule is compliant if the proposal mentions the required pattern
            const summaryLower = proposal.title.toLowerCase() + ' ' + proposal.objective.toLowerCase();
            const actionsText = (proposal.actions || []).join(' ').toLowerCase();
            const relevantTerms = extractRelevantTerms(rule.summary);
            const mentionsRequirement = relevantTerms.some(
                (term) => summaryLower.includes(term) || actionsText.includes(term)
            );

            if (mentionsRequirement) {
                compliantProposals.push(proposal.id);
            } else {
                violatingProposals.push({
                    id: proposal.id,
                    title: proposal.title,
                    reason: `Proposal in scope "${rule.targetPattern}" does not reference required pattern: "${rule.summary}".`
                });
            }
        } else if (rule.constraintType === 'exempt') {
            // Exempt rules pass by default when scope matches
            compliantProposals.push(proposal.id);
        }
    }

    let verdict: ValidationVerdict = 'untested';
    if (violatingProposals.length > 0) {
        verdict = 'violated';
    } else if (compliantProposals.length > 0) {
        verdict = 'compliant';
    }

    return { rule, verdict, violatingProposals, compliantProposals };
}

function collectProposalScope(proposal: DreamProposal): string[] {
    const scopes: string[] = [];
    if (proposal.sourcePath) scopes.push(proposal.sourcePath);
    const draft = proposal.protocolDraft;
    if (draft?.actions) {
        for (const action of draft.actions) {
            const nodeSource = (action as any).node?.sourcePath;
            if (nodeSource) scopes.push(String(nodeSource));
            const actionSource = (action as any).sourcePath;
            if (actionSource) scopes.push(String(actionSource));
            const nodeId = (action as any).nodeId || (action as any).parentNodeId;
            if (nodeId) scopes.push(String(nodeId));
        }
    }
    return scopes;
}

/**
 * Build a RegExp from a glob-like targetPattern.
 * Supports `**`, `*`, and plain paths.
 */
function buildMatchPattern(pattern: string): RegExp {
    if (pattern === '*' || pattern === '**') {
        return /.*/;
    }
    const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '___DOUBLESTAR___')
        .replace(/\*/g, '[^/]*')
        .replace(/___DOUBLESTAR___/g, '.*');
    return new RegExp(`^${escaped}$`, 'i');
}

function extractRelevantTerms(summary: string): string[] {
    return summary
        .toLowerCase()
        .split(/[^a-zA-Z0-9]+/)
        .filter((t) => t.length > 3);
}
