import { WorkspacePaths } from './workspace';
export declare const GOVERN_EXIT_CODES: {
    readonly pass: 0;
    readonly gate_fail: 2;
    readonly policy_invalid: 3;
    readonly artifact_missing: 4;
    readonly metric_unavailable: 5;
    readonly forbidden_change_detected: 6;
    readonly llm_fix_failed_or_not_improved: 7;
};
export type GovernExitCode = (typeof GOVERN_EXIT_CODES)[keyof typeof GOVERN_EXIT_CODES];
export type GovernMode = 'check' | 'ci' | 'fix';
export interface GovernRunOptions {
    mode: GovernMode;
    policyPath?: string;
    llm?: string;
    maxIterations?: number;
    dryRun?: boolean;
    scope?: 'full' | 'impact';
}
export interface GovernCheckResult {
    key: string;
    status: 'pass' | 'fail' | 'error';
    expected: number | boolean | string;
    actual: number | boolean | string | null;
    detail: string;
    mustPass: boolean;
}
export interface GovernReport {
    schemaVersion: '1.0';
    generatedAt: string;
    durationMs: number;
    mode: GovernMode;
    strict: true;
    projectRoot: string;
    policyPath: string;
    policyVersion?: string;
    policyMode?: string;
    scope: 'full' | 'impact';
    passed: boolean;
    exitCode: GovernExitCode;
    checks: GovernCheckResult[];
    metrics: Record<string, unknown>;
    artifacts: {
        triadMapFile: string;
        runtimeMapFile: string;
        runtimeDiagnosticsFile: string;
        coverageReportFile: string;
        governReportFile: string;
        governAuditFile: string;
        governFixesFile?: string;
    };
    baseline?: {
        path: string;
        runtime_unmatched_route_count: number;
    };
    policyViolations: string[];
    forbiddenChanges: string[];
    failures: string[];
}
export interface GovernExecutionResult {
    exitCode: GovernExitCode;
    report: GovernReport;
}
export declare function runGovern(paths: WorkspacePaths, options: GovernRunOptions): GovernExecutionResult;
export declare function formatGovernReport(report: GovernReport): string;
