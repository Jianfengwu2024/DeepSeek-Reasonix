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
export declare function resolveAnalyzerOptionsFromConfig(config: AnalyzerConfigLike, stableAnchors?: Partial<StableArchitectureAnchorOptions>): AnalyzerOptions;
export {};
