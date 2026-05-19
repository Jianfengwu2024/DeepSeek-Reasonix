"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDraftProtocolTemplateSeed = createDraftProtocolTemplateSeed;
exports.createDefaultUpgradePolicySeed = createDefaultUpgradePolicySeed;
exports.createMacroSplitSeedRecord = createMacroSplitSeedRecord;
exports.createMesoSplitSeedRecord = createMesoSplitSeedRecord;
exports.createMicroSplitSeedRecord = createMicroSplitSeedRecord;
exports.buildSplitArtifactShapeJson = buildSplitArtifactShapeJson;
const triadizationFocusSupport_1 = require("./triadizationFocusSupport");
const triadizationSplitBlueprintSupport_1 = require("./triadizationSplitBlueprintSupport");
const workspace_1 = require("./workspace");
function createDraftProtocolTemplateSeed(projectRoot, mapFile, userDemand = '') {
    return {
        protocolVersion: '1.0',
        project: (0, workspace_1.normalizePath)(projectRoot),
        mapSource: (0, workspace_1.normalizePath)(mapFile),
        userDemand,
        upgradePolicy: createDefaultUpgradePolicySeed(),
        macroSplit: createMacroSplitSeedRecord(''),
        mesoSplit: createMesoSplitSeedRecord(),
        microSplit: createMicroSplitSeedRecord(),
        impactedNodes: [],
        actions: []
    };
}
function createDefaultUpgradePolicySeed() {
    return {
        allowedOps: ['reuse', 'modify', 'create_child'],
        principle: 'reuse_first_minimal_change'
    };
}
function createMacroSplitSeedRecord(userDemand, focus) {
    return {
        ...(0, triadizationFocusSupport_1.createTriadizationFocusSeed)(focus),
        ...(0, triadizationSplitBlueprintSupport_1.createMacroSplitBlueprintSeed)(userDemand)
    };
}
function createMesoSplitSeedRecord(focus) {
    return {
        ...(0, triadizationFocusSupport_1.createTriadizationFocusSeed)(focus),
        ...(0, triadizationSplitBlueprintSupport_1.createMesoSplitBlueprintSeed)()
    };
}
function createMicroSplitSeedRecord(focus) {
    return {
        ...(0, triadizationFocusSupport_1.createTriadizationFocusSeed)(focus),
        ...(0, triadizationSplitBlueprintSupport_1.createMicroSplitBlueprintSeed)()
    };
}
function buildSplitArtifactShapeJson(stage) {
    switch (stage) {
        case 'macro':
            return JSON.stringify(createMacroSplitSeedRecord(''));
        case 'meso':
            return JSON.stringify(createMesoSplitSeedRecord());
        case 'micro':
            return JSON.stringify(createMicroSplitSeedRecord());
    }
}
//# sourceMappingURL=triadizationSplitArtifactSupport.js.map