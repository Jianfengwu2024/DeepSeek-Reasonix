import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { prepareWorkspace, resolveDemand, syncProjectTopology, writeHandoffPrompt } from './cliSupport';
import { printPassPrompt } from './cliPresentationSupport';
import { ensureTriadSpec, getWorkspacePaths, writeMasterPrompt } from './workflow';

type DemandCliOptions = {
    demand?: string;
};

type PromptWorkflowDemandOptions = DemandCliOptions & {
    usePersistedDemand?: boolean;
};

export function registerPromptWorkflowCommands(program: Command) {
    program
        .command('prepare [demand...]')
        .description('Generate triad, protocol, and implementation prompts for the current demand')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts: string[], options: DemandCliOptions) => {
            const paths = getWorkspacePaths(process.cwd());
            const demand = resolvePromptWorkflowDemand(
                demandParts,
                options,
                paths,
                'Please provide a demand, for example: triadmind prepare "add CSV export button"'
            );
            if (!demand) {
                return;
            }

            console.log(chalk.cyan('[TriadMind] Preparing planning prompts...'));
            prepareWorkspace(paths, demand);

            console.log(chalk.green(`Prompt written: ${paths.promptFile}`));
            console.log(chalk.green(`Protocol task prompt written: ${paths.protocolTaskFile}`));
            console.log(chalk.green(`Pipeline prompt written: ${paths.pipelinePromptFile}`));
            console.log(chalk.green(`Implementation prompt written: ${paths.implementationPromptFile}`));
            console.log(chalk.green(`Latest demand written: ${paths.demandFile}`));
            console.log(chalk.yellow(`Save the AI JSON response to ${paths.draftFile}`));
        });

    program
        .command('prompt [demand...]')
        .description('Alias of `prepare`')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts: string[], options: DemandCliOptions) => {
            const paths = getWorkspacePaths(process.cwd());
            const demand = resolvePromptWorkflowDemand(
                demandParts,
                options,
                paths,
                'Please provide a demand, for example: triadmind prompt "add CSV export button"'
            );
            if (!demand) {
                return;
            }

            prepareWorkspace(paths, demand);
            console.log(chalk.green(`Prompt written: ${paths.promptFile}`));
        });

    program
        .command('protocol [demand...]')
        .description('Generate the protocol prompt for `draft-protocol.json`')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts: string[], options: DemandCliOptions) => {
            const paths = getWorkspacePaths(process.cwd());
            const demand = resolvePromptWorkflowDemand(
                demandParts,
                { ...options, usePersistedDemand: true },
                paths,
                'Please provide a demand, or run prepare/pipeline first to save `latest-demand.txt`'
            );
            if (!demand) {
                return;
            }

            console.log(chalk.cyan('[TriadMind] Generating protocol prompt...'));
            prepareWorkspace(paths, demand);
            console.log(chalk.green(`Protocol task prompt written: ${paths.protocolTaskFile}`));
            console.log(chalk.green(`Protocol planning prompt written: ${paths.promptFile}`));
            console.log(chalk.yellow(`Send ${paths.protocolTaskFile} to the current AI assistant to produce draft-protocol.json`));
            console.log(chalk.yellow(`Then save the returned JSON to ${paths.draftFile}`));
        });

    program
        .command('pipeline [demand...]')
        .description('Generate Macro / Meso / Micro split workflow files')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts: string[], options: DemandCliOptions) => {
            const paths = getWorkspacePaths(process.cwd());
            const demand = resolvePromptWorkflowDemand(
                demandParts,
                { ...options, usePersistedDemand: true },
                paths,
                'Please provide a demand, or run prepare first to save `latest-demand.txt`'
            );
            if (!demand) {
                return;
            }

            console.log(chalk.cyan('[TriadMind] Generating multi-pass split workflow...'));
            prepareWorkspace(paths, demand);

            console.log(chalk.green(`Macro prompt: ${paths.macroPromptFile}`));
            console.log(chalk.green(`Meso prompt: ${paths.mesoPromptFile}`));
            console.log(chalk.green(`Micro prompt: ${paths.microPromptFile}`));
            console.log(chalk.green(`Pipeline prompt: ${paths.pipelinePromptFile}`));
            console.log(chalk.green(`Macro split output: ${paths.macroSplitFile}`));
            console.log(chalk.green(`Meso split output: ${paths.mesoSplitFile}`));
            console.log(chalk.green(`Micro split output: ${paths.microSplitFile}`));
            console.log(chalk.yellow('Suggested order: Macro -> Meso -> Micro -> draft-protocol.json'));
            console.log(chalk.yellow(`Single-file entry remains ${paths.masterPromptFile}`));
        });

    program
        .command('macro [demand...]')
        .description('Generate and show the Macro-Split prompt')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts: string[], options: DemandCliOptions) => {
            printPassPrompt('macro', demandParts, options.demand);
        });

    program
        .command('meso [demand...]')
        .description('Generate and show the Meso-Split prompt')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts: string[], options: DemandCliOptions) => {
            printPassPrompt('meso', demandParts, options.demand);
        });

    program
        .command('micro [demand...]')
        .description('Generate and show the Micro-Split prompt')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts: string[], options: DemandCliOptions) => {
            printPassPrompt('micro', demandParts, options.demand);
        });

    program
        .command('auto [demand...]')
        .description('Generate the implementation prompt with protocol planning as an internal pre-task')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .action((demandParts: string[], options: DemandCliOptions) => {
            const paths = getWorkspacePaths(process.cwd());
            const demand = resolvePromptWorkflowDemand(
                demandParts,
                { ...options, usePersistedDemand: true },
                paths,
                'Please provide a demand, or run prepare first to save `latest-demand.txt`'
            );
            if (!demand) {
                return;
            }

            console.log(chalk.cyan('[TriadMind] Generating implementation prompt...'));
            prepareWorkspace(paths, demand);
            console.log(chalk.green(`Implementation prompt written: ${paths.implementationPromptFile}`));
            console.log(chalk.yellow(`Use ${paths.implementationPromptFile} as the working prompt for the current AI session`));
            console.log(
                chalk.yellow(
                    'The model will first complete Macro -> Meso -> Micro -> draft-protocol.json, then continue into visualizer review and implementation'
                )
            );
        });

    program
        .command('handoff')
        .description('Generate the phase-two implementation prompt from the approved protocol and latest triad-map')
        .action(() => {
            const paths = getWorkspacePaths(process.cwd());

            if (!fs.existsSync(paths.approvedProtocolFile)) {
                console.log(chalk.red(`Approved protocol not found: ${paths.approvedProtocolFile}`));
                console.log(chalk.yellow('Run `triadmind apply` first, or manually prepare `last-approved-protocol.json`'));
                process.exitCode = 1;
                return;
            }

            if (!fs.existsSync(paths.mapFile)) {
                console.log(chalk.red(`triad-map.json not found: ${paths.mapFile}`));
                process.exitCode = 1;
                return;
            }

            writeHandoffPrompt(paths.projectRoot);
            console.log(chalk.green(`Handoff prompt written: ${paths.handoffPromptFile}`));
            console.log(chalk.yellow(`Send ${paths.handoffPromptFile} to the current implementation-stage AI assistant`));
        });

    program
        .command('master')
        .description('Rebuild the unified `master-prompt.md` entry file')
        .action(() => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);
            if (!fs.existsSync(paths.mapFile)) {
                syncProjectTopology(paths);
            }

            writeMasterPrompt(paths);
            console.log(chalk.green(`Master prompt written: ${paths.masterPromptFile}`));
        });
}

function resolvePromptWorkflowDemand(
    demandParts: string[],
    options: PromptWorkflowDemandOptions,
    paths: ReturnType<typeof getWorkspacePaths>,
    errorMessage: string
) {
    const demand = options.usePersistedDemand
        ? resolveDemand(demandParts, options.demand, paths)
        : resolveDemand(demandParts, options.demand);

    if (demand) {
        return demand;
    }

    console.log(chalk.red(errorMessage));
    process.exitCode = 1;
    return '';
}
