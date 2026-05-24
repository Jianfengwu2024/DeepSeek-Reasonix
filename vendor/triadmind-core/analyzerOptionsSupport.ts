import type { AnalyzerOptions } from './analyzer';
import type { StableArchitectureAnchorOptions } from './stableArchitectureAnchorSupport';

type AnalyzerConfigLike = {
    parser: {
        ignoreGenericContracts: boolean;
        genericContractIgnoreList: string[];
    };
    topologyRisk: {
        matureStableNodeIds: string[];
        matureStableNodePatterns: string[];
        matureStableSourcePaths: string[];
        matureStableSourcePathPatterns: string[];
    };
};

export function resolveAnalyzerOptionsFromConfig(
    config: AnalyzerConfigLike,
    stableAnchors?: Partial<StableArchitectureAnchorOptions>
): AnalyzerOptions {
    return {
        ignoreGenericContracts: config.parser.ignoreGenericContracts,
        genericContractIgnoreList: [...config.parser.genericContractIgnoreList],
        matureStableNodeIds: [...(stableAnchors?.matureStableNodeIds ?? config.topologyRisk.matureStableNodeIds)],
        matureStableNodePatterns: [...(stableAnchors?.matureStableNodePatterns ?? config.topologyRisk.matureStableNodePatterns)],
        matureStableSourcePaths: [...(stableAnchors?.matureStableSourcePaths ?? config.topologyRisk.matureStableSourcePaths)],
        matureStableSourcePathPatterns: [
            ...(stableAnchors?.matureStableSourcePathPatterns ?? config.topologyRisk.matureStableSourcePathPatterns)
        ]
    };
}
