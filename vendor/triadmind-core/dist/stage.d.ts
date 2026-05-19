import { TriadizationFocusGateFailureKind, TriadizationFocusGateReport } from './triadizationFocus';
export interface StageAnalysisInput {
    latestDemand: string;
    draftProtocol: string;
    macroSplit: string;
    mesoSplit: string;
    microSplit: string;
    approvedProtocol: string;
    triadizationReport?: string;
    triadizationSession?: string;
}
export interface StageAnalysisResult {
    hasRelevantApprovedProtocol: boolean;
    hasRelevantDraftProtocol: boolean;
    hasMacroSplit: boolean;
    hasMesoSplit: boolean;
    hasMicroSplit: boolean;
    hasTriadizationReport: boolean;
    triadizationFocus?: string;
    triadizationAction?: string;
    hasBlockingTriadizationFocusGate: boolean;
    triadizationFocusGateStatus: TriadizationFocusGateReport['status'];
    triadizationFocusGateKind?: TriadizationFocusGateFailureKind;
    triadizationFocusGateSummary?: string;
    triadizationFocusGateRepairTarget?: string;
    triadizationFocusGateDetails: string[];
    currentStage: string;
}
export declare function analyzeWorkspaceStage(input: StageAnalysisInput): StageAnalysisResult;
