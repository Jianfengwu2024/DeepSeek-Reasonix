import { TriadCategory, UpgradeProtocol } from './protocol';
import { VerifyMetrics } from './verify';
import { WorkspacePaths } from './workspace';
export interface DreamDiagnostic {
    level: 'info' | 'warning' | 'error';
    code: string;
    component: string;
    message: string;
    sourcePath?: string;
}
export interface DreamEvidence {
    type: 'metric' | 'node' | 'diagnostic' | 'runtime';
    key: string;
    value: string;
    sourcePath?: string;
}
export interface DreamFinding {
    id: string;
    type: 'metric' | 'topology' | 'runtime' | 'governance';
    severity: 'info' | 'warning' | 'error';
    title: string;
    description: string;
    metric?: string;
    currentValue?: number | boolean | string;
    targetValue?: number | boolean | string;
    confidence: number;
    evidence: DreamEvidence[];
}
export interface DreamProposal {
    id: string;
    title: string;
    priority: 'low' | 'medium' | 'high';
    confidence: number;
    category?: TriadCategory | 'unknown';
    sourcePath?: string;
    objective: string;
    expectedOutcome: string;
    actions: string[];
    linkedFindings: string[];
    evidence: DreamEvidence[];
    protocolDraft?: UpgradeProtocol;
}
export interface DreamState {
    schemaVersion: '1.0';
    updatedAt: string;
    lastRunAt?: string;
    lastMode?: DreamMode;
    runs: number;
    lastFindingCount: number;
    lastProposalCount: number;
}
export interface DreamReport {
    schemaVersion: '1.0';
    project: string;
    generatedAt: string;
    mode: DreamMode;
    skipped: boolean;
    skipReason?: string;
    config: {
        enabled: boolean;
        idleOnly: boolean;
        minHoursBetweenRuns: number;
        minConfidence: number;
        maxProposals: number;
        impactThreshold?: number;
    };
    metrics: VerifyMetrics;
    findings: DreamFinding[];
    proposals: DreamProposal[];
    diagnostics: DreamDiagnostic[];
    summary: string[];
}
export type DreamMode = 'manual' | 'idle';
export interface DreamRunOptions {
    mode?: DreamMode;
    force?: boolean;
    maxProposals?: number;
    minConfidence?: number;
    impactThreshold?: number;
}
export interface DreamRunResult {
    report: DreamReport;
    artifacts: {
        reportFile: string;
        diagnosticsFile: string;
        proposalsFile: string;
        stateFile: string;
    };
}
export declare function runDreamAnalysis(paths: WorkspacePaths, options?: DreamRunOptions): Promise<DreamRunResult>;
export declare function loadLatestDreamReport(paths: WorkspacePaths): DreamReport | undefined;
export declare function formatDreamReport(report: DreamReport): string;
export declare function buildDreamQuickHints(paths: WorkspacePaths): string[];
