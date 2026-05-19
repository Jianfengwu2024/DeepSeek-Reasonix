import { Command } from 'commander';
import { BootstrapScaffoldService } from './bootstrapScaffoldService';
interface WorkspaceLifecycleRegistrarOptions {
    bootstrapScaffoldService?: BootstrapScaffoldService;
}
export declare function registerWorkspaceLifecycleCommands(program: Command, options?: WorkspaceLifecycleRegistrarOptions): void;
export {};
