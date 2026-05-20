"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDraftProtocolTemplate = createDraftProtocolTemplate;
exports.createMacroSplitSeed = createMacroSplitSeed;
exports.createMesoSplitSeed = createMesoSplitSeed;
exports.createMicroSplitSeed = createMicroSplitSeed;
exports.getProtocolOutputContractLines = getProtocolOutputContractLines;
exports.getImplementationExecutionWorkflowLines = getImplementationExecutionWorkflowLines;
exports.getMasterPromptStageRouterLines = getMasterPromptStageRouterLines;
exports.getMasterPromptProtocolPhaseLines = getMasterPromptProtocolPhaseLines;
exports.getMasterPromptImplementationPhaseLines = getMasterPromptImplementationPhaseLines;
exports.getMasterPromptExpectedBehaviorLines = getMasterPromptExpectedBehaviorLines;
exports.getImplementationHandoffRuleLines = getImplementationHandoffRuleLines;
exports.buildTriadSpecDocument = buildTriadSpecDocument;
exports.buildMacroPromptShape = buildMacroPromptShape;
exports.buildMesoPromptShape = buildMesoPromptShape;
exports.buildMicroPromptShape = buildMicroPromptShape;
const triadizationSplitArtifactSupport_1 = require("./triadizationSplitArtifactSupport");
const workflowPromptCatalogSupport_1 = require("./workflowPromptCatalogSupport");
const workflowSplitPromptShapeSupport_1 = require("./workflowSplitPromptShapeSupport");
/**
 * @RightBranch
 */
function createDraftProtocolTemplate(projectRoot, mapFile, userDemand = '') {
    return (0, triadizationSplitArtifactSupport_1.createDraftProtocolTemplateSeed)(projectRoot, mapFile, userDemand);
}
/**
 * @RightBranch
 */
function createMacroSplitSeed(userDemand, focus) {
    return (0, triadizationSplitArtifactSupport_1.createMacroSplitSeedRecord)(userDemand, focus);
}
/**
 * @RightBranch
 */
function createMesoSplitSeed(focus) {
    return (0, triadizationSplitArtifactSupport_1.createMesoSplitSeedRecord)(focus);
}
/**
 * @RightBranch
 */
function createMicroSplitSeed(focus) {
    return (0, triadizationSplitArtifactSupport_1.createMicroSplitSeedRecord)(focus);
}
/**
 * @RightBranch
 */
function getProtocolOutputContractLines() {
    return (0, workflowPromptCatalogSupport_1.getWorkflowPromptPolicyLines)('protocolOutputContract');
}
/**
 * @RightBranch
 */
function getImplementationExecutionWorkflowLines() {
    return (0, workflowPromptCatalogSupport_1.getWorkflowPromptPolicyLines)('implementationExecutionWorkflow');
}
/**
 * @RightBranch
 */
function getMasterPromptStageRouterLines() {
    return (0, workflowPromptCatalogSupport_1.getWorkflowPromptPolicyLines)('masterPromptStageRouter');
}
/**
 * @RightBranch
 */
function getMasterPromptProtocolPhaseLines() {
    return (0, workflowPromptCatalogSupport_1.getWorkflowPromptPolicyLines)('masterPromptProtocolPhase');
}
/**
 * @RightBranch
 */
function getMasterPromptImplementationPhaseLines() {
    return (0, workflowPromptCatalogSupport_1.getWorkflowPromptPolicyLines)('masterPromptImplementationPhase');
}
/**
 * @RightBranch
 */
function getMasterPromptExpectedBehaviorLines() {
    return (0, workflowPromptCatalogSupport_1.getWorkflowPromptPolicyLines)('masterPromptExpectedBehavior');
}
/**
 * @RightBranch
 */
function getImplementationHandoffRuleLines() {
    return (0, workflowPromptCatalogSupport_1.getWorkflowPromptPolicyLines)('implementationHandoffRules');
}
/**
 * @RightBranch
 */
function buildTriadSpecDocument(projectName) {
    return (0, workflowPromptCatalogSupport_1.buildTriadSpecDocumentTemplate)(projectName);
}
/**
 * @RightBranch
 */
function buildMacroPromptShape(paths, userDemand) {
    return buildSplitPromptShape('macro', paths, userDemand);
}
/**
 * @RightBranch
 */
function buildMesoPromptShape(paths, userDemand) {
    return buildSplitPromptShape('meso', paths, userDemand);
}
/**
 * @RightBranch
 */
function buildMicroPromptShape(paths, userDemand) {
    return buildSplitPromptShape('micro', paths, userDemand);
}
function buildSplitPromptShape(stage, paths, userDemand) {
    return (0, workflowSplitPromptShapeSupport_1.buildWorkflowSplitPromptShape)(stage, paths, userDemand);
}
//# sourceMappingURL=workflowRightBranch.js.map