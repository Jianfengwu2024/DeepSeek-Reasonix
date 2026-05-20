import { ArtifactReadStatus } from './artifactReaders';
import type { DreamProposal } from './dream';
import type { TriadCategory } from './protocol';
import type { WorkspacePaths } from './workspace';
export type DreamFeedbackReviewerRole = 'maintainer' | 'ai' | 'operator';
export interface DreamProposalRejectionRecord {
    decisionId: string;
    decision: 'reject';
    proposalId: string;
    proposalFamily: string;
    proposalSignature: string;
    proposalTitle: string;
    category?: TriadCategory | 'unknown';
    sourcePath?: string;
    targetNodeIds: string[];
    linkedFindings: string[];
    reason: string;
    reasonCode?: string;
    extractedRule?: string;
    reviewer: string;
    reviewerRole: DreamFeedbackReviewerRole;
    recordedAt: string;
    isStableAnchor?: boolean;
    stableAnchorRecorded?: boolean;
    stableAnchorNodeId?: string;
    stableAnchorSourcePath?: string;
}
export interface DreamFeedbackLedger {
    schemaVersion: '1.0';
    project: string;
    updatedAt?: string;
    rejections: DreamProposalRejectionRecord[];
}
export interface DreamFeedbackLoadResult {
    status: ArtifactReadStatus;
    ledger: DreamFeedbackLedger;
}
export interface RecordDreamProposalRejectionInput {
    proposal: DreamProposal;
    reason: string;
    reasonCode?: string;
    extractedRule?: string;
    reviewer?: string;
    reviewerRole?: DreamFeedbackReviewerRole;
    recordedAt?: string;
    isStableAnchor?: boolean;
    stableAnchorRecorded?: boolean;
    stableAnchorNodeId?: string;
    stableAnchorSourcePath?: string;
}
export interface RecordDreamProposalRejectionResult {
    record: DreamProposalRejectionRecord;
    ledger: DreamFeedbackLedger;
    loadStatus: ArtifactReadStatus;
}
export declare function normalizeDreamFeedbackReviewerRole(value: string | undefined): DreamFeedbackReviewerRole | undefined;
export declare function deriveDreamProposalFamily(proposalId: string): string;
export declare function buildDreamProposalFeedbackSignature(proposal: DreamProposal): string;
export declare function loadDreamFeedbackLedger(paths: Pick<WorkspacePaths, 'projectRoot' | 'dreamFeedbackFile'>): DreamFeedbackLoadResult;
export declare function isStableAnchorRejectionRecord(record: Pick<DreamProposalRejectionRecord, 'isStableAnchor' | 'stableAnchorRecorded' | 'reasonCode'>): boolean;
export declare function recordDreamProposalRejection(paths: Pick<WorkspacePaths, 'projectRoot' | 'dreamFeedbackFile'>, input: RecordDreamProposalRejectionInput): RecordDreamProposalRejectionResult;
export declare function indexLatestDreamRejectionsBySignature(ledger: DreamFeedbackLedger): Map<string, DreamProposalRejectionRecord>;
export declare function formatDreamFeedbackRules(ledger: DreamFeedbackLedger, additionalFormattedRules?: string): string;
export declare function formatDreamFeedbackLedger(ledger: DreamFeedbackLedger): string;
export declare function deriveStableArchitectureAnchorFromProposal(proposal: DreamProposal): {
    nodeId: string | undefined;
    sourcePath: string | undefined;
} | undefined;
