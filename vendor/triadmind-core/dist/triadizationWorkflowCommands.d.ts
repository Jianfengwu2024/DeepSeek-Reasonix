import { Command } from 'commander';
import { WorkspacePaths } from './workspace';
export interface TriadizationWorkflowHooks {
    runAutoDreamAfterCommand(paths: WorkspacePaths, trigger: string): void;
    executeConvergePlaceholder(paths: WorkspacePaths): void;
}
export declare function registerTriadizationWorkflowCommands(program: Command, hooks: TriadizationWorkflowHooks): void;
