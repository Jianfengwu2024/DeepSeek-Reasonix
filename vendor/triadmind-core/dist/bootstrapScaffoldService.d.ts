import { WorkspacePaths } from './workspace';
export interface BootstrapScaffoldInitOptions {
    force?: boolean;
    nonInteractive?: boolean;
    triadmindCommand?: string;
}
export interface BootstrapScaffoldFileResult {
    key: 'AGENTS.md' | 'skills.md' | 'session-bootstrap.sh' | 'session-bootstrap.ps1' | 'session-bootstrap.cmd';
    path: string;
    action: 'created' | 'updated' | 'skipped';
    existed: boolean;
    changed: boolean;
    executable: boolean;
    note?: string;
}
export interface BootstrapScaffoldInitResult {
    schemaVersion: '1.0';
    generatedAt: string;
    force: boolean;
    nonInteractive: boolean;
    files: BootstrapScaffoldFileResult[];
}
export interface BootstrapDoctorFileStatus {
    key: 'AGENTS.md' | 'skills.md' | 'session-bootstrap.sh' | 'session-bootstrap.ps1' | 'session-bootstrap.cmd';
    path: string;
    exists: boolean;
    upToDate: boolean;
    executable: boolean;
    status: 'pass' | 'fail';
    message: string;
    recommendedAction?: string;
    version?: string;
}
export interface BootstrapDoctorReport {
    schemaVersion: '1.0';
    generatedAt: string;
    passed: boolean;
    files: BootstrapDoctorFileStatus[];
    summary: {
        passCount: number;
        failCount: number;
    };
}
export declare class BootstrapScaffoldService {
    init(paths: WorkspacePaths, options?: BootstrapScaffoldInitOptions): BootstrapScaffoldInitResult;
    doctor(paths: WorkspacePaths, options?: Pick<BootstrapScaffoldInitOptions, 'triadmindCommand'>): BootstrapDoctorReport;
    private upsertAgentsFile;
    private inspectAgents;
}
