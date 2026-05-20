export interface BrokenContract {
    consumerNodeId: string;
    demand: string;
    previousProducers: string[];
}
export interface RemovedEdge {
    from: string;
    to: string;
    contract: string;
}
export interface DriftReport {
    isDegraded: boolean;
    newCycles: string[][];
    brokenContracts: BrokenContract[];
    removedEdges: RemovedEdge[];
    summary: string[];
}
export interface RenormalizeAction {
    op: 'create_macro_node';
    macro_node_id: string;
    absorbed_nodes: string[];
    new_demand: string[];
    new_answer: string[];
    rationale: string;
}
export interface RenormalizeProtocol {
    protocolVersion: string;
    protocolType: 'triadmind-renormalize';
    actions: RenormalizeAction[];
    summary: string[];
}
export interface AnalyzerOptions {
    ignoreGenericContracts?: boolean;
    genericContractIgnoreList?: string[];
    matureStableNodeIds?: string[];
    matureStableNodePatterns?: string[];
    matureStableSourcePaths?: string[];
    matureStableSourcePathPatterns?: string[];
}
export type BlastRadiusNodeId = string;
export type BlastRadiusNodeIdList = BlastRadiusNodeId[];
export interface DownstreamFanoutNode {
    nodeId: string;
    downstreamCount: number;
    downstreamNodeIds: string[];
}
export interface AbstractionSourceSummary {
    sourcePath: string;
    nodeIds: string[];
    nodeCount: number;
    abstractionSignalCount: number;
    concreteSignalCount: number;
    interfaceCount: number;
    abstractClassCount: number;
    typeAliasCount: number;
    concreteClassCount: number;
    publicMethodCount: number;
    topLevelExecutableCount: number;
    abstractionRatio: number;
    role: 'abstraction_rich' | 'concrete_only' | 'mixed' | 'unknown';
    variantClusters: string[];
    implementingNodes: string[];
    dependentNodes: string[];
}
export interface FlatVariantCluster {
    sourcePath: string;
    cluster: string;
    nodeIds: string[];
    abstractionSignalCount: number;
    concreteSignalCount: number;
    contractCoverage: boolean;
}
export interface AbstractionDeficitHotspot {
    sourcePath: string;
    nodeIds: string[];
    abstractionSignalCount: number;
    concreteSignalCount: number;
    abstractionRatio: number;
    variantClusters: string[];
    reason: string;
}
/**
 * @LeftBranch
 */
export declare function calculateBlastRadius(map: any[], targetNodeId: string, isContractChange: boolean, options?: AnalyzerOptions): BlastRadiusNodeIdList;
/**
 * @LeftBranch
 */
export declare function detectCycles(map: any[], options?: AnalyzerOptions): string[][];
/**
 * @LeftBranch
 */
export declare function generateRenormalizeProtocol(map: any[], cycles: string[][], options?: AnalyzerOptions): RenormalizeProtocol;
/**
 * @LeftBranch
 */
export declare function detectTopologicalDrift(oldMap: any[], newMap: any[], options?: AnalyzerOptions): DriftReport;
/**
 * @LeftBranch
 */
export declare function calculateProducerConsumerEdges(map: any[], options?: AnalyzerOptions): RemovedEdge[];
/**
 * @LeftBranch
 */
export declare function normalizeSubgraph(subgraph: any[]): any[];
/**
 * @LeftBranch
 */
export declare function mapTopologyToYoungPartition(subgraph: any[]): number[];
/**
 * @LeftBranch
 */
export declare function generateMayaSequence(partition: number[]): number[];
/**
 * @LeftBranch
 */
export declare function generateMayaFeatureHash(mayaSequence: number[]): string;
/**
 * @deprecated Use `generateMayaSequence(mapTopologyToYoungPartition(nodes))`.
 */
export declare function generateMayanMatrix(normalizedNodes: any[]): number[][];
/**
 * @deprecated Use `generateMayaFeatureHash(sequence)`.
 */
export declare function generateFeatureHash(matrix: number[][]): string;
/**
 * @LeftBranch
 */
export declare function calculateDownstreamFanoutNodes(map: any[], threshold?: number, options?: AnalyzerOptions): DownstreamFanoutNode[];
/**
 * @LeftBranch
 */
export declare function calculateAbstractionSummaryBySourcePath(map: any[]): AbstractionSourceSummary[];
/**
 * @LeftBranch
 */
export declare function detectFlatVariantClusters(map: any[], minNodes?: number): FlatVariantCluster[];
/**
 * @LeftBranch
 */
export declare function detectAbstractionDeficitHotspots(map: any[], options?: {
    minConcreteSignals?: number;
    maxAbstractionRatio?: number;
}): AbstractionDeficitHotspot[];
export interface C2cCouplingFinding {
    sourcePath: string;
    confidence: number;
    /** How many concrete classes per interface (infinite = no interface at all). */
    concretePerInterface: number;
    concreteClassCount: number;
    interfaceCount: number;
    concreteSignalCount: number;
    abstractionSignalCount: number;
    /** Node ids contributing to the coupling problem. */
    nodeIds: string[];
    /** Human-readable explanation. */
    detail: string;
}
/**
 * Detect concrete-to-concrete (C2C) coupling risk by analyzing the
 * ratio of concrete classes to interfaces and abstraction coverage
 * per source path.
 *
 * High C2C coupling means concrete classes depend on other concrete
 * classes without an abstraction layer — a DIP violation risk.
 */
export declare function detectC2cCoupling(map: any[], options?: {
    maxConcretePerInterface?: number;
    minConcreteClasses?: number;
}): C2cCouplingFinding[];
