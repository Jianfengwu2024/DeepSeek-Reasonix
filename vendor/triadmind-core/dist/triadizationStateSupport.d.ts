import { TriadizationConfirmationSource, TriadizationDiagnosisCode, TriadizationOperation, TriadizationProposal } from './triadizationTypes';
export interface TriadizationFocusState {
    sessionId?: string;
    proposalId: string;
    triadizationFocus: string;
    recommendedOperation: TriadizationOperation;
    diagnosis: TriadizationDiagnosisCode[];
    confirmed: boolean;
    confirmationSource?: TriadizationConfirmationSource;
}
type TriadizationFocusArtifacts = {
    session?: unknown;
    report?: unknown;
    confirmation?: unknown;
};
type TriadizationProposalSummary = Pick<TriadizationProposal, 'proposalId' | 'targetNodeId' | 'recommendedOperation' | 'diagnosis'>;
export declare function resolveTriadizationFocusState(input: TriadizationFocusArtifacts): TriadizationFocusState | undefined;
export declare function readPrimaryTriadizationProposalSummary(value: unknown): TriadizationProposalSummary | undefined;
export declare function formatTriadizationFocusState(state?: Pick<TriadizationFocusState, 'triadizationFocus' | 'recommendedOperation'>): string | undefined;
export declare function buildTriadizationConfirmationMessage(proposalLike: unknown): string;
export {};
