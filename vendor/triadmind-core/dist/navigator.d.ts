import { DashboardOptions } from './visualizer';
import { WorkspacePaths } from './workspace';
export interface NavigatorRunOptions {
    protocolPath?: string;
    dashboardOptions?: DashboardOptions;
    llm?: string;
}
export interface NavigatorRunResult {
    status: 'pending_protocol' | 'ready';
    demand: string;
    impactMapFile: string;
    impactProtocolFile: string;
    impactPromptFile: string;
    impactVisualizerFile: string;
    summary: string[];
}
export declare function runNavigator(paths: WorkspacePaths, demand: string, options?: NavigatorRunOptions): Promise<NavigatorRunResult>;
