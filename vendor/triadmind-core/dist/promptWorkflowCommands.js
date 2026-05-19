"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPromptWorkflowCommands = registerPromptWorkflowCommands;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const cliSupport_1 = require("./cliSupport");
const cliPresentationSupport_1 = require("./cliPresentationSupport");
const workflow_1 = require("./workflow");
function registerPromptWorkflowCommands(program) {
    program
        .command('prepare [demand...]')
        .description('Generate triad, protocol, and implementation prompts for the current demand')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts, options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        const demand = resolvePromptWorkflowDemand(demandParts, options, paths, 'Please provide a demand, for example: triadmind prepare "add CSV export button"');
        if (!demand) {
            return;
        }
        console.log(chalk_1.default.cyan('[TriadMind] Preparing planning prompts...'));
        (0, cliSupport_1.prepareWorkspace)(paths, demand);
        console.log(chalk_1.default.green(`Prompt written: ${paths.promptFile}`));
        console.log(chalk_1.default.green(`Protocol task prompt written: ${paths.protocolTaskFile}`));
        console.log(chalk_1.default.green(`Pipeline prompt written: ${paths.pipelinePromptFile}`));
        console.log(chalk_1.default.green(`Implementation prompt written: ${paths.implementationPromptFile}`));
        console.log(chalk_1.default.green(`Latest demand written: ${paths.demandFile}`));
        console.log(chalk_1.default.yellow(`Save the AI JSON response to ${paths.draftFile}`));
    });
    program
        .command('prompt [demand...]')
        .description('Alias of `prepare`')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts, options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        const demand = resolvePromptWorkflowDemand(demandParts, options, paths, 'Please provide a demand, for example: triadmind prompt "add CSV export button"');
        if (!demand) {
            return;
        }
        (0, cliSupport_1.prepareWorkspace)(paths, demand);
        console.log(chalk_1.default.green(`Prompt written: ${paths.promptFile}`));
    });
    program
        .command('protocol [demand...]')
        .description('Generate the protocol prompt for `draft-protocol.json`')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts, options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        const demand = resolvePromptWorkflowDemand(demandParts, { ...options, usePersistedDemand: true }, paths, 'Please provide a demand, or run prepare/pipeline first to save `latest-demand.txt`');
        if (!demand) {
            return;
        }
        console.log(chalk_1.default.cyan('[TriadMind] Generating protocol prompt...'));
        (0, cliSupport_1.prepareWorkspace)(paths, demand);
        console.log(chalk_1.default.green(`Protocol task prompt written: ${paths.protocolTaskFile}`));
        console.log(chalk_1.default.green(`Protocol planning prompt written: ${paths.promptFile}`));
        console.log(chalk_1.default.yellow(`Send ${paths.protocolTaskFile} to the current AI assistant to produce draft-protocol.json`));
        console.log(chalk_1.default.yellow(`Then save the returned JSON to ${paths.draftFile}`));
    });
    program
        .command('pipeline [demand...]')
        .description('Generate Macro / Meso / Micro split workflow files')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts, options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        const demand = resolvePromptWorkflowDemand(demandParts, { ...options, usePersistedDemand: true }, paths, 'Please provide a demand, or run prepare first to save `latest-demand.txt`');
        if (!demand) {
            return;
        }
        console.log(chalk_1.default.cyan('[TriadMind] Generating multi-pass split workflow...'));
        (0, cliSupport_1.prepareWorkspace)(paths, demand);
        console.log(chalk_1.default.green(`Macro prompt: ${paths.macroPromptFile}`));
        console.log(chalk_1.default.green(`Meso prompt: ${paths.mesoPromptFile}`));
        console.log(chalk_1.default.green(`Micro prompt: ${paths.microPromptFile}`));
        console.log(chalk_1.default.green(`Pipeline prompt: ${paths.pipelinePromptFile}`));
        console.log(chalk_1.default.green(`Macro split output: ${paths.macroSplitFile}`));
        console.log(chalk_1.default.green(`Meso split output: ${paths.mesoSplitFile}`));
        console.log(chalk_1.default.green(`Micro split output: ${paths.microSplitFile}`));
        console.log(chalk_1.default.yellow('Suggested order: Macro -> Meso -> Micro -> draft-protocol.json'));
        console.log(chalk_1.default.yellow(`Single-file entry remains ${paths.masterPromptFile}`));
    });
    program
        .command('macro [demand...]')
        .description('Generate and show the Macro-Split prompt')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts, options) => {
        (0, cliPresentationSupport_1.printPassPrompt)('macro', demandParts, options.demand);
    });
    program
        .command('meso [demand...]')
        .description('Generate and show the Meso-Split prompt')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts, options) => {
        (0, cliPresentationSupport_1.printPassPrompt)('meso', demandParts, options.demand);
    });
    program
        .command('micro [demand...]')
        .description('Generate and show the Micro-Split prompt')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts, options) => {
        (0, cliPresentationSupport_1.printPassPrompt)('micro', demandParts, options.demand);
    });
    program
        .command('auto [demand...]')
        .description('Generate the implementation prompt with protocol planning as an internal pre-task')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts, options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        const demand = resolvePromptWorkflowDemand(demandParts, { ...options, usePersistedDemand: true }, paths, 'Please provide a demand, or run prepare first to save `latest-demand.txt`');
        if (!demand) {
            return;
        }
        console.log(chalk_1.default.cyan('[TriadMind] Generating implementation prompt...'));
        (0, cliSupport_1.prepareWorkspace)(paths, demand);
        console.log(chalk_1.default.green(`Implementation prompt written: ${paths.implementationPromptFile}`));
        console.log(chalk_1.default.yellow(`Use ${paths.implementationPromptFile} as the working prompt for the current AI session`));
        console.log(chalk_1.default.yellow('The model will first complete Macro -> Meso -> Micro -> draft-protocol.json, then continue into visualizer review and implementation'));
    });
    program
        .command('handoff')
        .description('Generate the phase-two implementation prompt from the approved protocol and latest triad-map')
        .action(() => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        if (!fs.existsSync(paths.approvedProtocolFile)) {
            console.log(chalk_1.default.red(`Approved protocol not found: ${paths.approvedProtocolFile}`));
            console.log(chalk_1.default.yellow('Run `triadmind apply` first, or manually prepare `last-approved-protocol.json`'));
            process.exitCode = 1;
            return;
        }
        if (!fs.existsSync(paths.mapFile)) {
            console.log(chalk_1.default.red(`triad-map.json not found: ${paths.mapFile}`));
            process.exitCode = 1;
            return;
        }
        (0, cliSupport_1.writeHandoffPrompt)(paths.projectRoot);
        console.log(chalk_1.default.green(`Handoff prompt written: ${paths.handoffPromptFile}`));
        console.log(chalk_1.default.yellow(`Send ${paths.handoffPromptFile} to the current implementation-stage AI assistant`));
    });
    program
        .command('master')
        .description('Rebuild the unified `master-prompt.md` entry file')
        .action(() => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        if (!fs.existsSync(paths.mapFile)) {
            (0, cliSupport_1.syncProjectTopology)(paths);
        }
        (0, workflow_1.writeMasterPrompt)(paths);
        console.log(chalk_1.default.green(`Master prompt written: ${paths.masterPromptFile}`));
    });
}
function resolvePromptWorkflowDemand(demandParts, options, paths, errorMessage) {
    const demand = options.usePersistedDemand
        ? (0, cliSupport_1.resolveDemand)(demandParts, options.demand, paths)
        : (0, cliSupport_1.resolveDemand)(demandParts, options.demand);
    if (demand) {
        return demand;
    }
    console.log(chalk_1.default.red(errorMessage));
    process.exitCode = 1;
    return '';
}
//# sourceMappingURL=promptWorkflowCommands.js.map