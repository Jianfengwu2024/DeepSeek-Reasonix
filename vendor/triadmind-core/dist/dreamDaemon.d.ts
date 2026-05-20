import { WorkspacePaths } from './workspace';
export interface DreamDaemonStartOptions {
    intervalSeconds?: number;
    maxTicks?: number;
}
export interface DreamDaemonLoopOptions {
    intervalSeconds: number;
    maxTicks: number;
}
export interface DreamDaemonPidRecord {
    schemaVersion: '1.0';
    pid: number;
    startedAt: string;
    intervalSeconds: number;
    maxTicks: number;
}
export interface DreamDaemonState {
    schemaVersion: '1.0';
    updatedAt: string;
    running: boolean;
    pid?: number;
    startedAt?: string;
    heartbeatAt?: string;
    ticks: number;
    lastStatus?: 'run' | 'skipped' | 'error';
    lastReason?: string;
    lastError?: string;
}
export interface DreamDaemonControlResult {
    status: 'started' | 'already_running' | 'stopped' | 'not_running' | 'error';
    running: boolean;
    pid?: number;
    message: string;
    state?: DreamDaemonState;
}
export declare function startDreamDaemon(paths: WorkspacePaths, options?: DreamDaemonStartOptions): DreamDaemonControlResult;
export declare function stopDreamDaemon(paths: WorkspacePaths): DreamDaemonControlResult;
export declare function getDreamDaemonStatus(paths: WorkspacePaths): {
    running: boolean;
    pid?: number;
    state: DreamDaemonState;
};
export declare function runDreamDaemonLoop(paths: WorkspacePaths, options: DreamDaemonLoopOptions): Promise<void>;
