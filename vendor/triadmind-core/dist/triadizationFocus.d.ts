import type { NormalizedTriadizationFocusReference, TriadizationFocusReferenceLike } from './triadizationFocusSupport';
import type { MicroClassArtifactLike, MicroSplitArtifactLike } from './triadizationSplitBlueprintSupport';
export { normalizeTriadizationFocusReference, resolveExpectedTriadizationFocus } from './triadizationFocusSupport';
export type { NormalizedTriadizationFocusReference, TriadizationFocusReferenceLike } from './triadizationFocusSupport';
export type TriadizationFocusGateFailureKind = 'protocol_focus_alignment' | 'triad_focus_closure' | 'mixed';
export interface TriadizationFocusGateReport {
    status: 'pass' | 'fail' | 'skip';
    failureKind?: TriadizationFocusGateFailureKind;
    canonicalFocus?: string;
    recommendedOperation?: string;
    summary: string;
    repairTarget?: string;
    details: string[];
    alignmentViolations: string[];
    closureViolations: string[];
}
export type MicroClassLike = MicroClassArtifactLike;
export type MicroSplitLike = MicroSplitArtifactLike<TriadizationFocusReferenceLike>;
export type DraftProtocolLike = {
    macroSplit?: TriadizationFocusReferenceLike;
    mesoSplit?: TriadizationFocusReferenceLike;
    microSplit?: MicroSplitLike;
};
export type TriadizationFocusAlignmentAnalysis = {
    artifactsInspected: string[];
    focusReferences: NormalizedTriadizationFocusReference[];
    alignmentViolations: string[];
};
export type TriadizationFocusClosureAnalysis = {
    focusReference?: NormalizedTriadizationFocusReference;
    closureViolations: string[];
};
export interface TriadizationFocusGateArtifactsAnalysis {
    draftProtocol?: DraftProtocolLike;
    microSplit?: MicroSplitLike;
    alignment: TriadizationFocusAlignmentAnalysis;
    closure: TriadizationFocusClosureAnalysis;
    canonicalReference?: NormalizedTriadizationFocusReference;
    failureKind?: TriadizationFocusGateFailureKind;
}
export declare function analyzeTriadizationFocusGateArtifacts(draftProtocol: unknown, microSplit: unknown): TriadizationFocusGateArtifactsAnalysis;
export declare function evaluateTriadizationFocusGateArtifacts(draftProtocol: unknown, microSplit: unknown): TriadizationFocusGateReport;
export declare function analyzeTriadizationFocusAlignment(draftProtocol: DraftProtocolLike | undefined, microSplit: MicroSplitLike | undefined): TriadizationFocusAlignmentAnalysis;
export declare function analyzeTriadFocusClosure(draftProtocol: DraftProtocolLike | undefined, microSplit: MicroSplitLike | undefined, focusReferences: NormalizedTriadizationFocusReference[]): TriadizationFocusClosureAnalysis;
