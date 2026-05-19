import { ImplementationHandoffInput, WorkspacePaths } from './workspace';
import { TriadizationFocusSeed } from './workflowRightBranch';
export { getWorkspacePaths, type WorkspacePaths, type WorkflowPaths, type ImplementationHandoffInput } from './workspace';
export { buildImplementationHandoffPrompt, buildImplementationPrompt, buildMacroPrompt, buildMasterPrompt, buildMesoPrompt, buildMicroPrompt, buildPipelinePrompt, buildProtocolPrompt } from './workflowPromptBuilders';
/**
 * @LeftBranch
 */
export declare function ensureTriadSpec(paths: WorkspacePaths, force?: boolean): void;
/**
 * @LeftBranch
 */
export declare function createDraftTemplate(paths: WorkspacePaths, userDemand?: string, force?: boolean): void;
/**
 * @LeftBranch
 */
export declare function writePromptPacket(paths: WorkspacePaths, userDemand: string): void;
/**
 * @LeftBranch
 */
export declare function resetPipelineArtifacts(paths: WorkspacePaths, userDemand: string): void;
/**
 * @LeftBranch
 */
export declare function ensurePipelineArtifactSeeds(paths: WorkspacePaths, userDemand: string): void;
/**
 * @LeftBranch
 */
export declare function writeImplementationHandoff(paths: WorkspacePaths, input: ImplementationHandoffInput): void;
/**
 * @LeftBranch
 */
export declare function writeMasterPrompt(paths: WorkspacePaths): void;
/**
 * @LeftBranch
 */
export declare function ensureMultiPassTemplates(paths: WorkspacePaths, userDemand: string, options?: {
    resetArtifacts?: boolean;
    triadizationFocus?: TriadizationFocusSeed;
}): void;
