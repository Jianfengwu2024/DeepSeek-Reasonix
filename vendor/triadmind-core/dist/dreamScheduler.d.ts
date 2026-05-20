import { WorkspacePaths } from './workspace';
type DreamAutoStatus = 'run' | 'skipped' | 'error';
export interface DreamAutoTickOptions {
    trigger: string;
    force?: boolean;
    impactThreshold?: number;
    now?: Date;
}
export interface DreamAutoTickResult {
    status: DreamAutoStatus;
    trigger: string;
    reason: string;
    ran: boolean;
    pendingEvents: number;
    lock: 'acquired' | 'busy' | 'stale_recovered' | 'none';
    reportFile?: string;
    diagnosticsFile?: string;
    error?: string;
}
export declare function tickDreamAutoRun(paths: WorkspacePaths, options: DreamAutoTickOptions): Promise<DreamAutoTickResult>;
export {};
