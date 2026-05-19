import { TriadConfig } from './config';
import { MatureStableArchitectureOptions, TopologyRiskNodeLike } from './topologyRiskSupport';
import { WorkspacePaths } from './workspace';
export type ImpactTier = 'exempt' | 'advisory' | 'strict';
export interface ImpactTierEntry {
    nodeId: string;
    sourcePath?: string;
    chainLength: number;
    tier: ImpactTier;
    forced: boolean;
    stableAnchor: boolean;
}
export interface ImpactTierSummary {
    available: boolean;
    protocolFile: string;
    shortChainMax: number;
    mediumChainMax: number;
    entries: ImpactTierEntry[];
    impactedNodeIds: Set<string>;
    impactedSourcePaths: Set<string>;
    notes: string[];
}
type ImpactNodeLike = TopologyRiskNodeLike & {
    sourcePath?: string;
    nodeId?: string;
};
export declare function loadImpactTierSummary(paths: Pick<WorkspacePaths, 'impactProtocolFile' | 'dreamFeedbackFile'>, triadNodes: ImpactNodeLike[], config: Pick<TriadConfig, 'impactTiers' | 'topologyRisk'>, stableAnchors?: MatureStableArchitectureOptions): ImpactTierSummary;
export declare function classifyImpactTier(chainLength: number | undefined, config: Pick<TriadConfig['impactTiers'], 'shortChainMax' | 'mediumChainMax'>): ImpactTier;
export declare function filterNodesForImpactThreshold<T extends ImpactNodeLike>(nodes: T[], summary: ImpactTierSummary, threshold: number | undefined, options?: {
    keepWhenUnavailable?: boolean;
}): T[];
export declare function filterNodesToImpactScope<T extends ImpactNodeLike>(nodes: T[], summary: ImpactTierSummary, options?: {
    includeAdvisory?: boolean;
    includeStrict?: boolean;
}): T[];
export declare function findImpactEntryForNode(summary: ImpactTierSummary, node: ImpactNodeLike): ImpactTierEntry | undefined;
export declare function hasImpactTierAtLeast(tier: ImpactTier, minimum: ImpactTier): boolean;
export {};
