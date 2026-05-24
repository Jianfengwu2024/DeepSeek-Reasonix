import { WorkspacePaths } from './workspace';
import type { TriadizationFocusSeed } from './triadizationFocusSupport';
import {
    createDraftProtocolTemplateSeed,
    createMacroSplitSeedRecord,
    createMesoSplitSeedRecord,
    createMicroSplitSeedRecord
} from './triadizationSplitArtifactSupport';
import {
    buildTriadSpecDocumentTemplate,
    getWorkflowPromptPolicyLines,
    type WorkflowSplitStage
} from './workflowPromptCatalogSupport';
import { buildWorkflowSplitPromptShape } from './workflowSplitPromptShapeSupport';

export type { TriadizationFocusSeed } from './triadizationFocusSupport';

/**
 * @RightBranch
 */
export function createDraftProtocolTemplate(projectRoot: string, mapFile: string, userDemand = '') {
    return createDraftProtocolTemplateSeed(projectRoot, mapFile, userDemand);
}

/**
 * @RightBranch
 */
export function createMacroSplitSeed(userDemand: string, focus?: Partial<TriadizationFocusSeed>) {
    return createMacroSplitSeedRecord(userDemand, focus);
}

/**
 * @RightBranch
 */
export function createMesoSplitSeed(focus?: Partial<TriadizationFocusSeed>) {
    return createMesoSplitSeedRecord(focus);
}

/**
 * @RightBranch
 */
export function createMicroSplitSeed(focus?: Partial<TriadizationFocusSeed>) {
    return createMicroSplitSeedRecord(focus);
}

/**
 * @RightBranch
 */
export function getProtocolOutputContractLines() {
    return getWorkflowPromptPolicyLines('protocolOutputContract');
}

/**
 * @RightBranch
 */
export function getImplementationExecutionWorkflowLines() {
    return getWorkflowPromptPolicyLines('implementationExecutionWorkflow');
}

/**
 * @RightBranch
 */
export function getMasterPromptStageRouterLines() {
    return getWorkflowPromptPolicyLines('masterPromptStageRouter');
}

/**
 * @RightBranch
 */
export function getMasterPromptProtocolPhaseLines() {
    return getWorkflowPromptPolicyLines('masterPromptProtocolPhase');
}

/**
 * @RightBranch
 */
export function getMasterPromptImplementationPhaseLines() {
    return getWorkflowPromptPolicyLines('masterPromptImplementationPhase');
}

/**
 * @RightBranch
 */
export function getMasterPromptExpectedBehaviorLines() {
    return getWorkflowPromptPolicyLines('masterPromptExpectedBehavior');
}

/**
 * @RightBranch
 */
export function getImplementationHandoffRuleLines() {
    return getWorkflowPromptPolicyLines('implementationHandoffRules');
}

/**
 * @RightBranch
 */
export function buildTriadSpecDocument(projectName: string) {
    return buildTriadSpecDocumentTemplate(projectName);
}

/**
 * @RightBranch
 */
export function buildMacroPromptShape(paths: WorkspacePaths, userDemand: string) {
    return buildSplitPromptShape('macro', paths, userDemand);
}

/**
 * @RightBranch
 */
export function buildMesoPromptShape(paths: WorkspacePaths, userDemand: string) {
    return buildSplitPromptShape('meso', paths, userDemand);
}

/**
 * @RightBranch
 */
export function buildMicroPromptShape(paths: WorkspacePaths, userDemand: string) {
    return buildSplitPromptShape('micro', paths, userDemand);
}

function buildSplitPromptShape(stage: WorkflowSplitStage, paths: WorkspacePaths, userDemand: string) {
    return buildWorkflowSplitPromptShape(stage, paths, userDemand);
}
