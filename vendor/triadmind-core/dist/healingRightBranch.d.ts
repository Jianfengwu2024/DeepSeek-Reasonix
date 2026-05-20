import { TriadNodeDefinition } from './protocol';
export type HealingBranchKind = 'left_branch' | 'right_branch' | 'contract' | 'topology' | 'unknown';
export type HealingActionKind = 'modify' | 'create_child' | 'manual_review';
export interface RuntimeTraceFrame {
    raw: string;
    sourcePath: string;
    line: number;
    column: number;
    symbol?: string;
}
export interface HealingDiagnosis {
    projectRoot: string;
    adapterLanguage: string;
    retryCount: number;
    matchedNodeId: string | null;
    matchedSourcePath: string | null;
    diagnosis: HealingBranchKind;
    suggestedAction: HealingActionKind;
    summary: string;
    blastRadius: {
        impactedNodeIds: string[];
        risk: 'low' | 'medium' | 'high';
    };
    traceFrames: RuntimeTraceFrame[];
    evidence: string[];
    requiresHumanApproval: boolean;
}
export type BlastRadius = {
    impactedNodeIds: string[];
    risk: 'low' | 'medium' | 'high';
};
/**
 * @RightBranch
 */
export declare function getContractGuardLine(requireHumanApprovalForContractChanges: boolean): "如果判断为 Demand / Answer 契约变更，请只输出待审阅协议，不要假定可直接自动落盘。" | "契约变更允许自动生成待执行协议。";
/**
 * @RightBranch
 */
export declare function getHealingOutputRuleLines(): string[];
/**
 * @RightBranch
 */
export declare function parseTraceLine(line: string, projectRootNormalized: string, projectRoot: string): {
    raw: string;
    sourcePath: string;
    line: number;
    column: number;
    symbol: string | undefined;
} | null;
/**
 * @RightBranch
 */
export declare function scoreNodeMatch(frame: RuntimeTraceFrame, node: TriadNodeDefinition): number;
/**
 * @RightBranch
 */
export declare function classifyDiagnosis(errorText: string): HealingBranchKind;
/**
 * @RightBranch
 */
export declare function chooseSuggestedAction(diagnosis: HealingBranchKind, retryCount: number, maxAutoRetries: number): HealingActionKind;
/**
 * @RightBranch
 */
export declare function estimateBlastRadius(rootNode: TriadNodeDefinition | null, nodes: TriadNodeDefinition[], isContractChange: boolean): BlastRadius;
/**
 * @RightBranch
 */
export declare function buildEvidence(errorText: string, traceFrames: RuntimeTraceFrame[], matchedNode: TriadNodeDefinition | null, diagnosis: HealingBranchKind, blastRadius: BlastRadius): string[];
/**
 * @RightBranch
 */
export declare function buildSummary(matchedNode: TriadNodeDefinition | null, diagnosis: HealingBranchKind, suggestedAction: HealingActionKind, blastRadius: BlastRadius): string;
