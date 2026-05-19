import { ViewMapPaths } from './workspace';
type ViewName = 'runtime' | 'capability' | 'leaf';
type ViewRelation = 'exact' | 'folded_leaf' | 'owner_match' | 'source_match' | 'name_match' | 'runtime_capability' | 'runtime_leaf_derived';
export interface ViewMapDiagnostic {
    level: 'info' | 'warning' | 'error';
    code: string;
    message: string;
    sourcePath?: string;
}
export interface ViewMapLink {
    id: string;
    fromView: ViewName;
    fromId: string;
    toView: ViewName;
    toId: string;
    relation: ViewRelation;
    confidence: number;
    reason: string;
    sourcePath?: string;
}
export interface ViewMapStats {
    runtimeNodes: number;
    capabilityNodes: number;
    leafNodes: number;
    linkCount: number;
    runtimeMatchedNodes: number;
    runtimeUnmatchedNodes: number;
    runtimeMatchRate: number;
    capabilityMatchedNodes: number;
    capabilityUnmatchedNodes: number;
    capabilityLeafMatchRate: number;
    leafMatchedNodes: number;
    leafUnmatchedNodes: number;
    leafCapabilityMatchRate: number;
    runtimeToCapabilityLinkCount: number;
    capabilityToLeafLinkCount: number;
    runtimeToLeafLinkCount: number;
    endToEndTraceableRuntimeNodes: number;
    endToEndTraceabilityRate: number;
}
export interface ViewMap {
    schemaVersion: '1.0';
    project: string;
    generatedAt: string;
    stats: ViewMapStats;
    links: ViewMapLink[];
    diagnostics: ViewMapDiagnostic[];
}
export interface ViewMapOptions {
    maxCandidatesPerRuntimeNode?: number;
}
export declare function generateViewMap(paths: ViewMapPaths, options?: ViewMapOptions): ViewMap;
export declare function writeViewMapArtifacts(paths: ViewMapPaths, options?: ViewMapOptions): ViewMap;
export {};
