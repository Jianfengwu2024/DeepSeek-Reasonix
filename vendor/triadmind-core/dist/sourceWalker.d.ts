import { TriadConfig } from './config';
export type SourceWalkMode = 'parser' | 'runtime' | 'visualizer';
export interface SourceWalkDiagnostic {
    level: 'info' | 'warning' | 'error';
    message: string;
    sourcePath?: string;
    code?: string;
}
interface SafeWalkProjectOptions {
    projectRoot: string;
    mode: SourceWalkMode;
    config: TriadConfig;
    maxFiles?: number;
    onFile: (absolutePath: string, relativePath: string) => void;
    onDiagnostic?: (diagnostic: SourceWalkDiagnostic) => void;
}
export interface SafeWalkSummary {
    scannedFiles: number;
    skippedPermissionPaths: string[];
    skippedExcludedPaths: string[];
    skippedMissingPaths: string[];
    maxFilesReached: boolean;
}
export declare function safeWalkProject(options: SafeWalkProjectOptions): SafeWalkSummary;
export declare function shouldSkipDirectory(relativePath: string, config: TriadConfig, mode: SourceWalkMode): boolean;
export declare function shouldSkipFile(relativePath: string, config: TriadConfig, mode: SourceWalkMode): boolean;
export {};
