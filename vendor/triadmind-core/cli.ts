#!/usr/bin/env node
import { Command } from 'commander';
import { normalizeDreamDefaultSubcommandArgv } from './cliPresentationSupport';
import {
    executeConvergePlaceholder,
    runAutoDreamAfterCommand
} from './cliWorkflowSupport';
import { registerDreamCommands } from './dreamCommands';
import { registerMaintenanceCommands } from './maintenanceCommands';
import { registerMemoryCommands } from './memoryCommands';
import { registerNavigatorCommands } from './navigatorCommands';
import { registerPromptWorkflowCommands } from './promptWorkflowCommands';
import { registerRuntimeGovernanceCommands } from './runtimeGovernanceCommands';
import { registerTriadizationWorkflowCommands } from './triadizationWorkflowCommands';
import { registerWorkspaceLifecycleCommands } from './workspaceLifecycleCommands';

const program = new Command();

program
    .name('triadmind')
    .description('TriadMind CLI for topology planning, triadization, and scaffold generation')
    .version('1.2.0');

registerWorkspaceLifecycleCommands(program);

registerPromptWorkflowCommands(program);
registerNavigatorCommands(program);
registerRuntimeGovernanceCommands(program);
registerDreamCommands(program);
registerTriadizationWorkflowCommands(program, {
    runAutoDreamAfterCommand,
    executeConvergePlaceholder
});
registerMaintenanceCommands(program);
registerMemoryCommands(program);

program.parse(normalizeDreamDefaultSubcommandArgv(process.argv));
