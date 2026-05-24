import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import inquirer from 'inquirer';
import { collectProtocolSnapshotFiles, createSnapshot } from './snapshot';
import { installAlwaysOnRules } from './rules';
import {
    assertNoTopologicalDegradation,
    DashboardCliOptions,
    dispatchProtocolApply,
    normalizeInvokeDemand,
    openFile,
    prepareWorkspace,
    readCurrentTriadMap,
    resolveDemand,
    syncProjectTopology,
    toDashboardOptions,
    validateDraftProtocol,
    warnBlastRadiusIfNeeded,
    writeHandoffPrompt
} from './cliSupport';
import { generateDashboard } from './visualizer';
import {
    buildTriadizationConfirmationMessage as buildTriadizationConfirmationPrompt,
    formatTriadizationFocusState,
    hasConfirmedTriadization,
    readTriadizationSession,
    resolveTriadizationFocusState,
    TriadizationConfirmationSource,
    TriadizationReport,
    writeTriadizationArtifacts,
    writeTriadizationConfirmation
} from './triadization';
import { createDraftTemplate, ensureTriadSpec, getWorkspacePaths } from './workflow';
import { WorkspacePaths } from './workspace';

interface ExecuteApplyOptions {
    source: TriadizationConfirmationSource;
    autoConfirmTriadization?: boolean;
    triadizationReport?: TriadizationReport;
}

export interface TriadizationWorkflowHooks {
    runAutoDreamAfterCommand(paths: WorkspacePaths, trigger: string): void;
    executeConvergePlaceholder(paths: WorkspacePaths): void;
}

abstract class AbstractTriadizationCommand {
    constructor(protected readonly workflow: TriadizationWorkflowService) {}

    protected getPaths() {
        return getWorkspacePaths(process.cwd());
    }
}

abstract class AbstractTriadizationReviewCommand extends AbstractTriadizationCommand {
    protected buildReviewGraph(paths: WorkspacePaths, options: DashboardCliOptions) {
        const protocol = validateDraftProtocol(paths);
        warnBlastRadiusIfNeeded(paths, protocol);
        generateDashboard(paths.mapFile, paths.draftFile, paths.visualizerFile, toDashboardOptions(options));
        console.log(chalk.green(`[TriadMind] 演化视图已生成: ${paths.visualizerFile}`));
        return protocol;
    }

    protected async maybeOpenReviewGraph(paths: WorkspacePaths, options: { open?: boolean }) {
        if (options.open === false) {
            return;
        }

        try {
            await openFile(paths.visualizerFile);
        } catch (error: any) {
            console.log(chalk.yellow(`[TriadMind] failed to open browser automatically: ${error.message}`));
        }
    }
}

class TriadizationWorkflowService {
    constructor(private readonly hooks: TriadizationWorkflowHooks) {}

    ensureWorkspace(paths: WorkspacePaths) {
        ensureTriadSpec(paths);
    }

    ensureTopology(paths: WorkspacePaths, options: { logWhenMissing?: string; force?: boolean } = {}) {
        this.ensureWorkspace(paths);
        if (fs.existsSync(paths.mapFile)) {
            return;
        }

        if (options.logWhenMissing) {
            console.log(chalk.yellow(options.logWhenMissing));
        }

        syncProjectTopology(paths, Boolean(options.force));
    }

    refreshTriadization(paths: WorkspacePaths) {
        const report = writeTriadizationArtifacts(paths);
        reportTriadizationStatus(paths, report);
        return report;
    }

    async ensureTriadizationConfirmation(
        paths: WorkspacePaths,
        report: TriadizationReport,
        source: TriadizationConfirmationSource,
        autoConfirm = false
    ) {
        if (!report.primaryProposal) {
            return true;
        }

        if (hasConfirmedTriadization(paths, report)) {
            return true;
        }

        let confirmed = autoConfirm;
        if (!confirmed) {
            const answer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: buildTriadizationConfirmationPrompt(report),
                    default: false
                }
            ]);
            confirmed = answer.confirm;
        }

        if (!confirmed) {
            return false;
        }

        writeTriadizationConfirmation(paths, report, source);
        return true;
    }

    async executeApply(projectRoot: string, options: ExecuteApplyOptions) {
        const paths = getWorkspacePaths(projectRoot);

        try {
            if (!fs.existsSync(paths.mapFile)) {
                syncProjectTopology(paths);
            }

            const triadizationReport = options.triadizationReport ?? this.refreshTriadization(paths);
            if (options.triadizationReport) {
                reportTriadizationStatus(paths, triadizationReport);
            }

            const confirmed = await this.ensureTriadizationConfirmation(
                paths,
                triadizationReport,
                options.source,
                Boolean(options.autoConfirmTriadization)
            );
            if (!confirmed) {
                console.log(chalk.red('[TriadMind] apply cancelled because the triadization session is not confirmed.'));
                return;
            }

            const previousMap = readCurrentTriadMap(paths);
            const protocol = validateDraftProtocol(paths);
            const snapshot = createSnapshot(paths, 'before-apply', collectProtocolSnapshotFiles(paths, protocol));
            console.log(chalk.gray(`   - [Snapshot] created ${snapshot.id}`));
            console.log(chalk.cyan('[TriadMind] applying approved protocol...'));
            const approvedProtocolJson = JSON.stringify(protocol, null, 2);
            fs.writeFileSync(paths.approvedProtocolFile, approvedProtocolJson, 'utf-8');

            const result = dispatchProtocolApply(projectRoot, protocol);
            console.log(chalk.gray(`   - [Adapter] detected ${result.language} -> ${result.displayName}`));
            syncProjectTopology(paths, true);
            assertNoTopologicalDegradation(paths, previousMap, 'apply');
            writeHandoffPrompt(projectRoot, result.changedFiles, approvedProtocolJson);
            this.hooks.runAutoDreamAfterCommand(paths, 'apply');

            if (fs.existsSync(paths.draftFile)) {
                fs.unlinkSync(paths.draftFile);
            }

            console.log(chalk.green(`[TriadMind] apply completed; triad-map refreshed: ${paths.mapFile}`));
            console.log(chalk.green(`[TriadMind] handoff prompt written: ${paths.handoffPromptFile}`));
        } catch (error: any) {
            console.log(chalk.red(`[TriadMind] apply failed: ${error.message}`));
            process.exitCode = 1;
        }
    }

    runAutoDream(paths: WorkspacePaths, trigger: string) {
        this.hooks.runAutoDreamAfterCommand(paths, trigger);
    }

    executeConverge(paths: WorkspacePaths) {
        this.hooks.executeConvergePlaceholder(paths);
    }
}

class TriadizeCommand extends AbstractTriadizationCommand {
    register(program: Command) {
        program
            .command('triadize')
            .description('Analyze current topology and emit triadization diagnosis/task artifacts')
            .option('--json', 'Emit machine-readable triadization report JSON')
            .option('--confirm', 'Record the current primary triadization proposal as confirmed')
            .action(async (options: { json?: boolean; confirm?: boolean }) => {
                const paths = this.getPaths();
                this.workflow.ensureTopology(paths);
                const report = this.workflow.refreshTriadization(paths);

                if (options.confirm) {
                    const confirmed = await this.workflow.ensureTriadizationConfirmation(paths, report, 'triadize', false);
                    if (!confirmed) {
                        console.log(chalk.red('[TriadMind] triadization confirmation cancelled.'));
                        process.exitCode = 1;
                        return;
                    }
                }

                if (options.json) {
                    console.log(JSON.stringify(report, null, 2));
                }
            });
    }
}

class PlanCommand extends AbstractTriadizationReviewCommand {
    register(program: Command) {
        program
            .command('plan')
            .description('Validate draft-protocol.json, generate visualizer.html, and optionally apply the protocol')
            .option('--apply', 'Skip the extra prompt and continue straight into apply')
            .option('--no-open', 'Generate visualizer.html without opening the browser')
            .option('--view <architecture|leaf>', 'Set the initial visualizer view')
            .option('--show-isolated', 'Show isolated capability nodes in architecture view')
            .option('--full-contract-edges', 'Disable contract-edge capping in the visualizer')
            .action(async (options: { apply?: boolean; open?: boolean } & DashboardCliOptions) => {
                const paths = this.getPaths();

                console.log(chalk.cyan('[TriadMind] preparing topology review graph...'));
                this.workflow.ensureTopology(paths, {
                    logWhenMissing: '[TriadMind] triad-map.json is missing; running a topology sync first.'
                });

                const triadizationReport = this.workflow.refreshTriadization(paths);

                if (!fs.existsSync(paths.draftFile)) {
                    createDraftTemplate(paths);
                    console.log(chalk.yellow(`[TriadMind] draft-protocol.json was missing; a template was created: ${paths.draftFile}`));
                    console.log(
                        chalk.yellow(
                            `[TriadMind] review ${paths.triadizationReportFile} and ${paths.triadizationTaskFile}, confirm the current triadization focus, then generate the draft protocol.`
                        )
                    );
                    console.log(chalk.yellow(`[TriadMind] use ${paths.promptFile} to ask the AI assistant for the draft protocol.`));
                    return;
                }

                try {
                    this.buildReviewGraph(paths, options);
                } catch (error: any) {
                    console.log(chalk.red(`Draft protocol validation failed: ${error.message}`));
                    process.exitCode = 1;
                    return;
                }

                this.workflow.runAutoDream(paths, 'plan');
                await this.maybeOpenReviewGraph(paths, options);

                if (options.open === false && !options.apply) {
                    return;
                }

                let shouldApply = Boolean(options.apply);
                if (!shouldApply) {
                    const answer = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'confirm',
                            message: buildTriadizationConfirmationPrompt(triadizationReport),
                            default: false
                        }
                    ]);
                    shouldApply = answer.confirm;
                }

                if (!shouldApply) {
                    console.log(chalk.red('[TriadMind] apply cancelled; no source files were changed.'));
                    return;
                }

                await this.workflow.executeApply(paths.projectRoot, {
                    source: 'plan',
                    autoConfirmTriadization: Boolean(options.apply),
                    triadizationReport
                });
            });
    }
}

class InvokeCommand extends AbstractTriadizationReviewCommand {
    register(program: Command) {
        program
            .command('invoke [demand...]')
            .description('One-click entry for AI assistants, compatible with "@triadmind <demand>" inputs')
            .option('-d, --demand <text>', 'Provide the user demand explicitly')
            .option('--apply', 'If draft-protocol.json is ready, continue straight into plan/apply')
            .option('--view <architecture|leaf>', 'Set the initial visualizer view for the generated review graph')
            .option('--show-isolated', 'Show isolated capability nodes in architecture view')
            .option('--full-contract-edges', 'Disable contract-edge capping in the visualizer')
            .action(async (demandParts: string[], options: { demand?: string; apply?: boolean } & DashboardCliOptions) => {
                const paths = this.getPaths();
                const rawDemand = resolveDemand(demandParts, options.demand, paths);
                const demand = normalizeInvokeDemand(rawDemand);

                if (!demand) {
                    console.log(chalk.red('[TriadMind] please provide a demand, for example: triadmind invoke "@triadmind add CSV export".'));
                    process.exitCode = 1;
                    return;
                }

                console.log(chalk.cyan('[TriadMind] preparing invoke workflow...'));
                if (isConvergeDirective(demand)) {
                    this.workflow.executeConverge(paths);
                    return;
                }

                prepareWorkspace(paths, demand);
                installAlwaysOnRules(paths);
                const triadizationReport = this.workflow.refreshTriadization(paths);

                console.log(chalk.green(`[TriadMind] implementation prompt ready: ${paths.implementationPromptFile}`));
                console.log(chalk.green(`[TriadMind] protocol task prompt: ${paths.protocolTaskFile}`));
                console.log(chalk.green(`[TriadMind] draft protocol target: ${paths.draftFile}`));

                if (!options.apply) {
                    console.log(chalk.yellow('[TriadMind] let the AI assistant read implementation-prompt.md and silently complete Macro/Meso/Micro/Protocol first.'));
                    console.log(chalk.yellow('[TriadMind] after saving the protocol, rerun "npm run invoke -- --apply" or "npm run plan -- --no-open --apply".'));
                    return;
                }

                try {
                    this.buildReviewGraph(paths, options);
                } catch (error: any) {
                    console.log(chalk.red(`[TriadMind] draft-protocol.json is not ready to land yet: ${error.message}`));
                    console.log(
                        chalk.yellow(
                            `[TriadMind] ask the AI assistant to write the full protocol into ${paths.draftFile}, then rerun "invoke --apply".`
                        )
                    );
                    process.exitCode = 1;
                    return;
                }

                console.log(chalk.green(`[TriadMind] silent review graph generated: ${paths.visualizerFile}`));
                await this.workflow.executeApply(paths.projectRoot, {
                    source: 'invoke',
                    autoConfirmTriadization: true,
                    triadizationReport
                });
            });
    }
}

class ApplyCommand extends AbstractTriadizationCommand {
    register(program: Command) {
        program
            .command('apply')
            .description('Execute draft-protocol.json directly and refresh triad-map.json')
            .action(async () => {
                const paths = this.getPaths();

                if (!fs.existsSync(paths.draftFile)) {
                    console.log(chalk.red(`[TriadMind] draft protocol file not found: ${paths.draftFile}`));
                    process.exitCode = 1;
                    return;
                }

                await this.workflow.executeApply(paths.projectRoot, {
                    source: 'apply'
                });
            });
    }
}

export function registerTriadizationWorkflowCommands(program: Command, hooks: TriadizationWorkflowHooks) {
    const workflow = new TriadizationWorkflowService(hooks);
    new TriadizeCommand(workflow).register(program);
    new PlanCommand(workflow).register(program);
    new InvokeCommand(workflow).register(program);
    new ApplyCommand(workflow).register(program);
}

function reportTriadizationStatus(paths: WorkspacePaths, report: TriadizationReport) {
    const session = readTriadizationSession(paths);
    const focusState = resolveTriadizationFocusState({
        session,
        report
    });

    if (!report.primaryProposal) {
        console.log(chalk.yellow('[TriadMind] no actionable triadization proposal was found in the current topology.'));
        console.log(chalk.green(`[TriadMind] triadization report written: ${paths.triadizationReportFile}`));
        console.log(chalk.green(`[TriadMind] triadization task written: ${paths.triadizationTaskFile}`));
        return;
    }

    const proposal = report.primaryProposal;
    const exactFocus = formatTriadizationFocusState(focusState) ?? `${proposal.targetNodeId} -> ${proposal.recommendedOperation}`;
    console.log(
        chalk.cyan(
            `[TriadMind] triadization focus: ${exactFocus} (${proposal.diagnosis.join(', ')})`
        )
    );
    console.log(chalk.gray(`   - rationale: ${proposal.rationale}`));
    if (proposal.blastRadius.impactedNodeCount > 0) {
        console.log(
            chalk.gray(
                `   - blast radius: ${proposal.blastRadius.impactedNodeCount} downstream node(s) (${proposal.blastRadius.impactedNodeIds
                    .slice(0, 8)
                    .join(', ')})`
            )
        );
    }
    if (session && session.proposalId === proposal.proposalId) {
        const statusLabel = session.status === 'confirmed' ? 'confirmed' : 'proposed';
        console.log(chalk.gray(`   - session: ${session.sessionId} [${statusLabel}]`));
    }
    console.log(chalk.green(`[TriadMind] triadization session written: ${paths.triadizationSessionFile}`));
    console.log(chalk.green(`[TriadMind] triadization report written: ${paths.triadizationReportFile}`));
    console.log(chalk.green(`[TriadMind] triadization task written: ${paths.triadizationTaskFile}`));
}

function isConvergeDirective(value: string) {
    const normalized = value.trim().toLowerCase();
    return normalized === 'converge' || normalized === 'renormalize --deep' || normalized === '@triadmind converge';
}
