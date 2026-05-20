/**
 * dreamRuleExtractor.ts
 *
 * LLM-powered rule extraction from dream proposal rejections.
 * Given a rejected proposal and the user's natural-language reason,
 * calls OpenAI/Anthropic to produce a structured architecture constraint
 * that can be persisted in the DreamRuleLedger and injected into the
 * Navigator prompt as "lessons learned from past mistakes."
 */
import type { DreamProposalRejectionRecord } from './dreamFeedbackSupport';
import type { DreamProposal } from './dream';
import type { WorkspacePaths } from './workspace';
export interface ExtractRuleInput {
    proposal: DreamProposal;
    rejection: DreamProposalRejectionRecord;
}
export interface ExtractRuleResult {
    /** true when the LLM successfully extracted a rule. */
    extracted: boolean;
    /** The structured rule when extracted, or a fallback. */
    rule: ExtractedRule;
    /** Raw LLM response text (for diagnostics). */
    rawResponse?: string;
    /** Error message when extraction failed. */
    error?: string;
}
/**
 * The structured output expected from the LLM.
 * This is a subset of DreamRuleEntry filled by the LLM.
 */
export interface ExtractedRule {
    /** One-sentence summary of the architecture constraint. */
    summary: string;
    /** Nature of the constraint. */
    constraintType: 'forbid' | 'require' | 'exempt';
    /** Glob-like or source-path pattern for where the rule applies.
     *  The LLM infers this from the proposal's sourcePath / protocolDraft. */
    targetPattern: string;
    /** LLM self-assessed confidence (0–1). */
    confidence: number;
    /** Optional TTL in days. null means "until manually removed". */
    ttlDays: number | null;
}
/**
 * Call the configured LLM to extract a structured architecture constraint
 * from a rejected dream proposal and its rejection reason.
 *
 * Returns a fully populated result. When the LLM is not configured or the
 * call fails, `extracted` is false and `rule` contains a best-effort
 * fallback derived from the rejection reason.
 */
export declare function extractRuleFromRejection(paths: Pick<WorkspacePaths, 'projectRoot' | 'triadDir' | 'configFile' | 'profileFile'>, input: ExtractRuleInput): Promise<ExtractRuleResult>;
