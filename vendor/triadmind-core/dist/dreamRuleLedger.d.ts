import { WorkspacePaths } from './workspace';
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
export declare function getDreamRuleFilePath(paths: Pick<WorkspacePaths, 'triadDir'>): string;
export declare function loadDreamRuleLedger(paths: Pick<WorkspacePaths, 'triadDir'>): DreamRuleLoadResult;
export declare function saveDreamRuleLedger(paths: Pick<WorkspacePaths, 'triadDir'>, ledger: DreamRuleLedger): void;
export declare function addDreamRule(paths: Pick<WorkspacePaths, 'triadDir'>, input: DreamRuleAddInput): {
    rule: DreamRuleEntry;
    ledger: DreamRuleLedger;
};
export declare function deactivateDreamRule(paths: Pick<WorkspacePaths, 'triadDir'>, ruleId: string): boolean;
/** Return only rules that are active and not expired. */
export declare function getActiveRules(ledger: DreamRuleLedger): DreamRuleEntry[];
/** Format active rules for injection into Navigator / Dream prompts. */
export declare function formatActiveRulesPrompt(ledger: DreamRuleLedger): string;
/** Deactivate rules that have expired TTL. Returns number of deactivated rules. */
export declare function expireStaleRules(paths: Pick<WorkspacePaths, 'triadDir'>): number;
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
export declare function jaccardSimilarity(a: string, b: string): number;
/**
 * Find all conflicts within the given rules.
 * When `newRule` is provided, only check that rule against the rest (for
 * pre-add validation). When omitted, do a full pairwise scan.
 */
export declare function findConflictingRules(ledger: DreamRuleLedger, newRule?: DreamRuleEntry): ConflictReport;
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
export declare function deduplicateRules(paths: Pick<WorkspacePaths, 'triadDir'>): DeduplicateResult;
/**
 * Check for potential duplicates/conflicts before adding a new rule.
 * Returns warnings (not blocking) so the caller can decide whether to proceed.
 */
export declare function checkForDuplicateBeforeAdd(paths: Pick<WorkspacePaths, 'triadDir'>, input: DreamRuleAddInput): {
    isExactDuplicate: boolean;
    conflicts: RuleConflict[];
    warnings: string[];
};
