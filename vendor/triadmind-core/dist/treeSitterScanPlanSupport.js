"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTreeSitterScanPlan = createTreeSitterScanPlan;
function createTreeSitterScanPlan(parserConfig) {
    const projectedScanMode = parserConfig.scanMode;
    const architectureScanMode = projectedScanMode === 'leaf' ? 'capability' : projectedScanMode;
    return {
        projectedScanMode,
        architectureScanMode,
        leafParserConfig: {
            ...parserConfig,
            scanMode: 'leaf'
        },
        architectureParserConfig: {
            ...parserConfig,
            scanMode: architectureScanMode
        },
        useLeafProjection: projectedScanMode === 'leaf',
        scanUnit: projectedScanMode === 'leaf'
            ? 'leaf nodes'
            : projectedScanMode === 'module'
                ? 'module capability nodes'
                : projectedScanMode === 'domain'
                    ? 'domain capability nodes'
                    : 'capability nodes'
    };
}
//# sourceMappingURL=treeSitterScanPlanSupport.js.map