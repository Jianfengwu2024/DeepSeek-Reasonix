import { TriadLanguage } from './config';
import type { TriadFission, TriadNodeDefinition } from './protocolRightBranch';
import type { MicroSplitArtifactLike } from './triadizationSplitBlueprintSupport';
export type TopologyQualityNodeLike = Omit<Partial<TriadNodeDefinition>, 'fission'> & {
    fission?: Partial<TriadFission>;
};
export interface LanguageGhostPolicy {
    includeInDemand: boolean;
    topK: number;
    minConfidence: number;
}
export interface GhostMetricsByLanguage {
    ghostRatioByLanguage: Record<string, number>;
    ghostInDemandCountByLanguage: Record<string, number>;
}
export interface TriadCompletenessAnalysis {
    triadVertices: number;
    leftOnlyVertices: string[];
    rightOnlyVertices: string[];
    emptyVertices: string[];
    scaleMixingVertices: string[];
}
export interface GhostPolicyViolationOptions {
    violationLimit?: number;
}
export declare function collectGhostMetricsByLanguage(triadNodes: TopologyQualityNodeLike[]): GhostMetricsByLanguage;
export declare function evaluateGhostPolicyViolations(triadNodes: TopologyQualityNodeLike[], policyByLanguage: Record<string, LanguageGhostPolicy | undefined>, options?: GhostPolicyViolationOptions): string[];
export declare function analyzeTriadCompleteness(triadNodes: TopologyQualityNodeLike[], microSplit: MicroSplitArtifactLike | undefined, language: TriadLanguage, genericContractIgnoreList: string[]): TriadCompletenessAnalysis;
export declare function inferLanguageFromSourcePath(sourcePath: string | undefined): TriadLanguage | 'unknown';
