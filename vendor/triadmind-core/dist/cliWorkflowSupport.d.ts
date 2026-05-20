import { normalizeRuntimeView } from './runtime/filterRuntimeMapByView';
import { RuntimeMap } from './runtime/types';
import { ViewMap, ViewMapOptions } from './viewMap';
import { WorkspacePaths } from './workspace';
export interface DreamRunCliOptions {
    mode?: string;
    force?: boolean;
    maxProposals?: string;
    minConfidence?: string;
    impactThreshold?: string;
    visualize?: boolean;
    theme?: string;
    json?: boolean;
}
export interface RuntimeTopologyArtifactOptions {
    view?: ReturnType<typeof normalizeRuntimeView>;
    includeFrontend?: boolean;
    includeInfra?: boolean;
    frameworkHint?: string;
}
export interface RuntimeArtifactResult {
    runtimeMap: RuntimeMap;
    recovered: boolean;
}
export interface ViewMapArtifactResult {
    viewMap: ViewMap;
    recovered: boolean;
}
export interface DerivedArtifactRefreshResult {
    runtimeResult: RuntimeArtifactResult;
    viewMapResult: ViewMapArtifactResult;
}
export declare function refreshRuntimeAndViewArtifacts(paths: WorkspacePaths, runtimeOptions?: RuntimeTopologyArtifactOptions, viewMapOptions?: ViewMapOptions, bestEffort?: boolean): Promise<DerivedArtifactRefreshResult>;
export declare function reportRuntimeArtifactStatus(paths: WorkspacePaths, result: RuntimeArtifactResult): void;
export declare function reportViewMapStatus(paths: WorkspacePaths, result: ViewMapArtifactResult): void;
export declare function runAutoDreamAfterCommand(paths: WorkspacePaths, trigger: string): void;
export declare function executeDreamRun(options: DreamRunCliOptions): Promise<void>;
export declare function executeConvergePlaceholder(paths: WorkspacePaths): void;
