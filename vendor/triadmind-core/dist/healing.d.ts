import { HealingDiagnosis } from './healingRightBranch';
import { TriadNodeDefinition } from './protocol';
import { WorkspacePaths } from './workspace';
export * from './healingRightBranch';
/**
 * @LeftBranch
 */
export declare function prepareHealingArtifacts(paths: WorkspacePaths, errorText: string, retryCount?: number): {
    diagnosis: HealingDiagnosis;
    prompt: string;
};
/**
 * @LeftBranch
 */
export declare function diagnoseRuntimeFailure(paths: WorkspacePaths, errorText: string, retryCount: number, nodes: TriadNodeDefinition[]): HealingDiagnosis;
/**
 * @LeftBranch
 */
export declare function buildHealingPrompt(paths: WorkspacePaths, errorText: string, diagnosis: HealingDiagnosis): string;
