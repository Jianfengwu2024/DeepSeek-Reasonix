/**
 * dreamFeedbackValidator.ts
 *
 * Validates that active architecture constraint rules are being respected
 * by the latest dream proposals. Reports compliance, violations, and
 * blind spots where rules exist but no proposals tested them.
 */
import { type DreamRuleEntry } from './dreamRuleLedger';
import type { WorkspacePaths } from './workspace';
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
        overallScore: number;
    };
    entries: RuleValidationEntry[];
}
/**
 * Validate the latest dream proposals against active architecture rules.
 * Returns a structured report showing which rules are being respected,
 * which are violated, and which have not been tested by any proposal.
 */
export declare function validateFeedback(paths: WorkspacePaths): ValidationReport;
