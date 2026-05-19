import type { TriadFission, TriadNodeDefinition } from './protocolRightBranch';
export type TopologyRiskNodeLike = Omit<Partial<TriadNodeDefinition>, 'fission'> & {
    fission?: Partial<TriadFission>;
};
export type MatureStableArchitectureOptions = {
    matureStableNodeIds?: string[];
    matureStableNodePatterns?: string[];
    matureStableSourcePaths?: string[];
    matureStableSourcePathPatterns?: string[];
};
export declare function hasGhostDemand(node: TopologyRiskNodeLike): boolean;
export declare function isGhostNoiseNode(node: TopologyRiskNodeLike, degree: number, executeLike?: boolean): boolean;
export declare function isSupportLayerAggregateNode(node: TopologyRiskNodeLike): boolean;
export declare function isHelperPrimitiveNode(node: TopologyRiskNodeLike): boolean;
export declare function isStructuralRiskCandidate(node: TopologyRiskNodeLike): boolean;
export declare function isMatureStableArchitectureNode(node: TopologyRiskNodeLike, options?: MatureStableArchitectureOptions): boolean;
export declare function getPromotionReasons(node: TopologyRiskNodeLike): string[];
