import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { openFile, resolveDemand, syncProjectTopology, toDashboardOptions } from './cliSupport';
import { approveInterrogation, reviewInterrogation, runInterrogation } from './interrogation';
import { ensureTriadSpec, getWorkspacePaths } from './workflow';

type InterrogationCliOptions = {
    demand?: string;
    answersFile?: string;
    llm?: string;
    open?: boolean;
    json?: boolean;
    view?: string;
    showIsolated?: boolean;
    fullContractEdges?: boolean;
};

export function registerInterrogationCommands(program: Command) {
    program
        .command('interrogate [demand...]')
        .description('Run requirement interrogation before impact review and apply')
        .option('-d, --demand <text>', 'Explicit user demand text')
        .option('--answers-file <path>', 'Merge question answers from a JSON object or array into interrogation-state.json')
        .option('--llm <provider:model>', 'Pass through to navigator impact generation when the interrogation reaches impact review')
        .option('--no-open', 'Generate artifacts without opening the browser')
        .option('--view <architecture|leaf>', 'Set the initial visualizer view for generated impact maps')
        .option('--show-isolated', 'Show isolated capability nodes in architecture view')
        .option('--full-contract-edges', 'Disable contract-edge capping in the visualizer')
        .option('--json', 'Emit machine-readable interrogation result JSON')
        .action(async (demandParts: string[], options: InterrogationCliOptions) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            const demand = resolveInterrogationDemand(demandParts, options.demand, paths);
            if (!demand) {
                console.log(
                    chalk.red(
                        'Please provide a demand, for example: triadmind interrogate "add a requirement clarification gate before apply"'
                    )
                );
                process.exitCode = 1;
                return;
            }

            if (!fs.existsSync(paths.mapFile)) {
                console.log(chalk.yellow('[TriadMind] triad-map.json is missing; running a topology sync first.'));
                syncProjectTopology(paths);
            }

            try {
                const result = await runInterrogation(paths, demand, {
                    answersFile: options.answersFile,
                    llm: options.llm,
                    dashboardOptions: toDashboardOptions(options)
                });

                if (result.status === 'impact_ready' && options.open !== false && result.impactVisualizerFile) {
                    await openFile(result.impactVisualizerFile);
                }

                if (options.json) {
                    console.log(JSON.stringify(result, null, 2));
                    return;
                }

                result.summary.forEach((line) => console.log(chalk.green(`[TriadMind] ${line}`)));
                if (result.status === 'pending_answers') {
                    console.log(
                        chalk.yellow(
                            `[TriadMind] answer the planned questions in ${paths.interrogationStateFile}, then rerun \`triadmind interrogate\`.`
                        )
                    );
                    return;
                }

                if (result.status === 'pending_impact_protocol') {
                    console.log(
                        chalk.yellow(
                            `[TriadMind] interrogation is ready, but impact protocol is still pending. Review ${paths.impactPromptFile} or rerun with --llm.`
                        )
                    );
                    return;
                }

                if (result.state.status === 'approved_for_development') {
                    console.log(
                        chalk.yellow(
                            `[TriadMind] small-impact demand auto-passed the interrogation gate. You can continue directly into apply.`
                        )
                    );
                    return;
                }

                console.log(
                    chalk.yellow(
                        `[TriadMind] review the shock chain in ${paths.impactVisualizerFile}, then run \`triadmind interrogate-approve\` before apply.`
                    )
                );
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] interrogate failed: ${error.message}`));
                process.exitCode = 1;
            }
        });

    program
        .command('interrogate-review')
        .description('Print the current interrogation state artifact')
        .option('--json', 'Emit machine-readable interrogation state JSON')
        .action((options: { json?: boolean }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);
            const state = reviewInterrogation(paths);
            if (!state) {
                console.log(chalk.red(`No interrogation state found: ${paths.interrogationStateFile}`));
                process.exitCode = 1;
                return;
            }

            if (options.json) {
                console.log(JSON.stringify(state, null, 2));
                return;
            }

            console.log(chalk.green(`[TriadMind] interrogation state: ${paths.interrogationStateFile}`));
            console.log(chalk.green(`[TriadMind] status=${state.status}, workflowStage=${state.workflowStage}`));
            if (state.clarifiedRequirement?.summary) {
                console.log(chalk.gray(`   - summary: ${state.clarifiedRequirement.summary}`));
            }
            if (state.impactFiles?.impactVisualizerFile) {
                console.log(chalk.gray(`   - impact visualizer: ${state.impactFiles.impactVisualizerFile}`));
            }
        });

    program
        .command('interrogate-approve')
        .description('Approve the current interrogation result so apply can continue')
        .option('--json', 'Emit machine-readable approved interrogation state JSON')
        .action((options: { json?: boolean }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            try {
                const state = approveInterrogation(paths);
                if (options.json) {
                    console.log(JSON.stringify(state, null, 2));
                    return;
                }

                console.log(chalk.green(`[TriadMind] interrogation approved: ${paths.interrogationStateFile}`));
                if (state.approvedAt) {
                    console.log(chalk.gray(`   - approvedAt: ${state.approvedAt}`));
                }
            } catch (error: any) {
                console.log(chalk.red(`[TriadMind] interrogation approval failed: ${error.message}`));
                process.exitCode = 1;
            }
        });
}

function resolveInterrogationDemand(demandParts: string[], explicitDemand: string | undefined, paths: ReturnType<typeof getWorkspacePaths>) {
    const resolvedExplicitDemand = resolveDemand(demandParts, explicitDemand);
    if (resolvedExplicitDemand) {
        return resolvedExplicitDemand;
    }

    const existingState = reviewInterrogation(paths);
    if (existingState?.userDemand?.trim()) {
        return existingState.userDemand.trim();
    }

    return resolveDemand([], undefined, paths);
}
