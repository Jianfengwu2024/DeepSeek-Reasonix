import { TriadizationConfirmation, TriadizationConfirmationSource, TriadizationDiagnosisCode, TriadizationOperation, TriadizationReport, TriadizationScale, TriadizationSessionConfirmation, TriadizationTask } from './triadizationTypes';
import { TriadizationPaths } from './workspace';
/**
 * @LeftBranch
 */
export declare function buildTriadizationTaskMarkdown(report: TriadizationReport): string;
/**
 * @LeftBranch
 */
export declare function writeTriadizationArtifacts(paths: TriadizationPaths): TriadizationReport;
/**
 * @LeftBranch
 */
export declare function readTriadizationSession(paths: TriadizationPaths): {
    schemaVersion: "1.0";
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
    blastRadius: {
        impactedNodeCount: number;
        impactedNodeIds: string[];
    };
    taskBundle: TriadizationTask[];
    reportGeneratedAt: string;
    status: "proposed" | "confirmed";
    confirmation: TriadizationSessionConfirmation | undefined;
} | undefined;
/**
 * @LeftBranch
 */
export declare function readTriadizationConfirmation(paths: TriadizationPaths): TriadizationConfirmation | undefined;
/**
 * @LeftBranch
 */
export declare function hasConfirmedTriadization(paths: TriadizationPaths, report: TriadizationReport): boolean;
/**
 * @LeftBranch
 */
export declare function writeTriadizationConfirmation(paths: TriadizationPaths, report: TriadizationReport, source: TriadizationConfirmationSource): TriadizationConfirmation | undefined;
/**
 * @LeftBranch
 */
export declare function resolveTriadizationSession(paths: TriadizationPaths, report?: TriadizationReport): {
    schemaVersion: "1.0";
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
    blastRadius: {
        impactedNodeCount: number;
        impactedNodeIds: string[];
    };
    taskBundle: TriadizationTask[];
    reportGeneratedAt: string;
    status: "proposed" | "confirmed";
    confirmation: TriadizationSessionConfirmation | undefined;
} | undefined;
