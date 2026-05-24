export type TriadizationOperation = 'aggregate' | 'split' | 'renormalize';
export type TriadizationScale = 'class' | 'capability' | 'module' | 'workflow' | 'cluster';
export type TriadizationDiagnosisCode =
    | 'cyclic_cluster'
    | 'overloaded_vertex'
    | 'left_right_mixing'
    | 'capability_fragmented'
    | 'triadization_candidate';

export type TriadizationTaskPhase = 'macro' | 'meso' | 'micro' | 'renormalize' | 'protocol' | 'verify';
export type TriadizationConfirmationSource = 'plan' | 'apply' | 'invoke' | 'triadize';

export type TriadMapNodeLike = {
    nodeId?: unknown;
    category?: unknown;
    sourcePath?: unknown;
    fission?: {
        problem?: unknown;
        demand?: unknown;
        answer?: unknown;
    };
};

export interface TriadizationTask {
    phase: TriadizationTaskPhase;
    title: string;
    objective: string;
}

export interface TriadizationAlternative {
    operation: Exclude<TriadizationOperation, never>;
    reason: string;
}

export interface TriadizationBlastRadius {
    impactedNodeCount: number;
    impactedNodeIds: string[];
}

export interface TriadizationProposal {
    proposalId: string;
    targetNodeId: string;
    targetNodeIds: string[];
    triadScale: TriadizationScale;
    diagnosis: TriadizationDiagnosisCode[];
    recommendedOperation: TriadizationOperation;
    rationale: string;
    rejectedAlternatives: TriadizationAlternative[];
    evidence: string[];
    blastRadius: TriadizationBlastRadius;
    taskBundle: TriadizationTask[];
    confirmationPrompt: string;
    confirmationNeeded: true;
    score: number;
}

export interface TriadizationReport {
    schemaVersion: '1.0';
    project: string;
    generatedAt: string;
    summary: string[];
    primaryProposal?: TriadizationProposal;
    candidates: TriadizationProposal[];
}

export interface TriadizationConfirmation {
    schemaVersion: '1.0';
    confirmedAt: string;
    source: TriadizationConfirmationSource;
    proposalId: string;
    targetNodeId: string;
    recommendedOperation: TriadizationOperation;
    reportGeneratedAt: string;
}

export interface TriadizationSessionConfirmation {
    confirmedAt: string;
    source: TriadizationConfirmationSource;
}

export interface TriadizationSession {
    schemaVersion: '1.0';
    sessionId: string;
    project: string;
    generatedAt: string;
    updatedAt: string;
    proposalId: string;
    triadizationFocus: string;
    targetNodeIds: string[];
    triadScale: TriadizationScale;
    recommendedOperation: TriadizationOperation;
    diagnosis: TriadizationDiagnosisCode[];
    rationale: string;
    evidence: string[];
    confirmationPrompt: string;
    blastRadius: TriadizationBlastRadius;
    taskBundle: TriadizationTask[];
    reportGeneratedAt: string;
    status: 'proposed' | 'confirmed';
    confirmation?: TriadizationSessionConfirmation;
}
