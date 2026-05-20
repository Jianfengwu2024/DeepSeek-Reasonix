import type { TriadConfig } from './config';
import { type DreamFeedbackLedger } from './dreamFeedbackSupport';
import type { WorkspacePaths } from './workspace';
export type StableArchitectureAnchorOptions = {
    matureStableNodeIds: string[];
    matureStableNodePatterns: string[];
    matureStableSourcePaths: string[];
    matureStableSourcePathPatterns: string[];
};
export interface StableArchitectureAnchorEntry {
    source: 'config' | 'feedback';
    matchKind: 'node_id' | 'node_pattern' | 'source_path' | 'source_path_pattern';
    value: string;
    proposalId?: string;
    reasonCode?: string;
    recordedAt?: string;
}
export interface EffectiveStableArchitectureAnchors extends StableArchitectureAnchorOptions {
    entries: StableArchitectureAnchorEntry[];
}
export declare function resolveEffectiveStableAnchors(paths: Pick<WorkspacePaths, 'projectRoot' | 'dreamFeedbackFile'>, configTopologyRisk?: Partial<StableArchitectureAnchorOptions>): {
    loadStatus: import("./artifactReaders").ArtifactReadStatus;
    stableAnchors: {
        matureStableNodeIds: string[];
        matureStableNodePatterns: string[];
        matureStableSourcePaths: string[];
        matureStableSourcePathPatterns: string[];
        entries: StableArchitectureAnchorEntry[];
    };
};
export declare function resolveEffectiveStableAnchorsFromSources(input: {
    configTopologyRisk?: Partial<StableArchitectureAnchorOptions> | TriadConfig['topologyRisk'];
    feedbackLedger?: DreamFeedbackLedger;
}): {
    matureStableNodeIds: string[];
    matureStableNodePatterns: string[];
    matureStableSourcePaths: string[];
    matureStableSourcePathPatterns: string[];
    entries: StableArchitectureAnchorEntry[];
};
