#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const cliPresentationSupport_1 = require("./cliPresentationSupport");
const cliWorkflowSupport_1 = require("./cliWorkflowSupport");
const dreamCommands_1 = require("./dreamCommands");
const interrogationCommands_1 = require("./interrogationCommands");
const maintenanceCommands_1 = require("./maintenanceCommands");
const memoryCommands_1 = require("./memoryCommands");
const navigatorCommands_1 = require("./navigatorCommands");
const promptWorkflowCommands_1 = require("./promptWorkflowCommands");
const runtimeGovernanceCommands_1 = require("./runtimeGovernanceCommands");
const triadizationWorkflowCommands_1 = require("./triadizationWorkflowCommands");
const workspaceLifecycleCommands_1 = require("./workspaceLifecycleCommands");
const program = new commander_1.Command();
program
    .name('triadmind')
    .description('TriadMind CLI for topology planning, triadization, and scaffold generation')
    .version('1.2.0');
(0, workspaceLifecycleCommands_1.registerWorkspaceLifecycleCommands)(program);
(0, promptWorkflowCommands_1.registerPromptWorkflowCommands)(program);
(0, navigatorCommands_1.registerNavigatorCommands)(program);
(0, interrogationCommands_1.registerInterrogationCommands)(program);
(0, runtimeGovernanceCommands_1.registerRuntimeGovernanceCommands)(program);
(0, dreamCommands_1.registerDreamCommands)(program);
(0, triadizationWorkflowCommands_1.registerTriadizationWorkflowCommands)(program, {
    runAutoDreamAfterCommand: cliWorkflowSupport_1.runAutoDreamAfterCommand,
    executeConvergePlaceholder: cliWorkflowSupport_1.executeConvergePlaceholder
});
(0, maintenanceCommands_1.registerMaintenanceCommands)(program);
(0, memoryCommands_1.registerMemoryCommands)(program);
program.parse((0, cliPresentationSupport_1.normalizeDreamDefaultSubcommandArgv)(process.argv));
//# sourceMappingURL=cli.js.map