import { WorkspacePaths } from './workspace';
export interface TrendNodeRisk {
    nodeId: string;
    sourcePath?: string;
    inDegree: number;
    outDegree: number;
    degree: number;
    ghost: boolean;
    executeLike: boolean;
    riskScore: number;
    classification: 'structural' | 'support_layer' | 'ghost_noise' | 'mature_stable';
}
export interface TrendSnapshot {
    generatedAt: string;
    triadNodeCount: number;
    triadEdgeCount: number;
    runtimeNodeCount: number;
    runtimeEdgeCount: number;
    executeLikeRatio: number;
    ghostRatio: number;
    diagnosticsNoCode: number;
    highRiskNodes: TrendNodeRisk[];
    supportLayerNodes: TrendNodeRisk[];
    ghostNoiseNodes: TrendNodeRisk[];
    matureStableNodes: TrendNodeRisk[];
    centralityByNode: Record<string, number>;
    triadEdgeKeys: string[];
    runtimeEdgeKeys: string[];
}
export interface TrendHistory {
    schemaVersion: '1.0';
    updatedAt: string;
    snapshots: TrendSnapshot[];
}
export interface TrendDeltaReport {
    generatedAt: string;
    previousGeneratedAt?: string;
    summary: string[];
    highRiskAdded: TrendNodeRisk[];
    highRiskRemoved: TrendNodeRisk[];
    centralitySurges: Array<{
        nodeId: string;
        previousDegree: number;
        currentDegree: number;
        delta: number;
    }>;
    addedTriadEdges: string[];
    removedTriadEdges: string[];
    addedRuntimeEdges: string[];
    removedRuntimeEdges: string[];
    snapshot: TrendSnapshot;
}
export interface TrendOptions {
    historyWindow?: number;
    maxEdgeDiff?: number;
}
export declare function generateTrendArtifacts(paths: WorkspacePaths, options?: TrendOptions): {
    history: TrendHistory;
    report: TrendDeltaReport;
};
