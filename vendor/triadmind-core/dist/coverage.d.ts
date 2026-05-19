import { TriadCategory } from './protocol';
import { CoveragePaths } from './workspace';
export type CoverageMetricName = 'triad' | 'runtime' | 'combined';
export interface CoverageDiagnostic {
    level: 'info' | 'warning' | 'error';
    code: string;
    message: string;
    sourcePath?: string;
}
export interface CoverageBucketReport {
    key: string;
    category?: TriadCategory | 'unknown';
    rootPath?: string;
    exists?: boolean;
    totalSourceFiles: number;
    triadCoveredFiles: number;
    runtimeCoveredFiles: number;
    combinedCoveredFiles: number;
    triadCoverage: number;
    runtimeCoverage: number;
    combinedCoverage: number;
    coveredSamples: string[];
    uncoveredSamples: string[];
}
export interface CoverageReport {
    schemaVersion: '1.0';
    generatedAt: string;
    projectRoot: string;
    artifacts: {
        triadMapFile: string;
        runtimeMapFile: string;
        coverageReportFile: string;
    };
    summary: CoverageBucketReport;
    byCategory: Record<string, CoverageBucketReport>;
    byRoot: Record<string, CoverageBucketReport>;
    diagnostics: CoverageDiagnostic[];
}
export declare function runCoverage(paths: CoveragePaths): CoverageReport;
export declare function formatCoverageReport(report: CoverageReport): string;
