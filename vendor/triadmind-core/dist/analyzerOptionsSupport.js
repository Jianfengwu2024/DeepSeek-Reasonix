"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAnalyzerOptionsFromConfig = resolveAnalyzerOptionsFromConfig;
function resolveAnalyzerOptionsFromConfig(config, stableAnchors) {
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
//# sourceMappingURL=analyzerOptionsSupport.js.map