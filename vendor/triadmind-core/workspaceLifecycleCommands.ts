import { Command } from 'commander';
import chalk from 'chalk';
import { getAvailableAdapters, resolveAdapter } from './adapter';
import { writeSelfBootstrapProtocol, writeSelfBootstrapReport } from './bootstrap';
import { BootstrapScaffoldService } from './bootstrapScaffoldService';
import {
    assertNoTopologicalDegradation,
    readCurrentTriadMap,
    syncProjectTopology,
    validateDraftProtocol
} from './cliSupport';
import {
    formatBootstrapDoctorReport,
    reportBootstrapInitResult,
    resolveBootstrapCliCommand
} from './cliPresentationSupport';
import {
    refreshRuntimeAndViewArtifacts,
    reportRuntimeArtifactStatus,
    reportViewMapStatus,
    runAutoDreamAfterCommand
} from './cliWorkflowSupport';
import { installAlwaysOnRules } from './rules';
import { writeTriadizationArtifacts } from './triadization';
import { generateDashboard } from './visualizer';
import { ensureTriadSpec, getWorkspacePaths, writeMasterPrompt, WorkspacePaths } from './workflow';

interface WorkspaceLifecycleRegistrarOptions {
    bootstrapScaffoldService?: BootstrapScaffoldService;
}

class WorkspaceLifecycleService {
    constructor(private readonly bootstrapScaffoldService: BootstrapScaffoldService) {}

    getPaths() {
        return getWorkspacePaths(process.cwd());
    }

    async initializeWorkspace(options: { skipBootstrap?: boolean } = {}) {
        const paths = this.getPaths();
        const previousMap = readCurrentTriadMap(paths);

        console.log(chalk.cyan('[TriadMind] Initializing workspace...'));
        ensureTriadSpec(paths);

        if (!options.skipBootstrap) {
            const bootstrapResult = this.bootstrapScaffoldService.init(paths, {
                nonInteractive: true,
                triadmindCommand: this.resolveBootstrapCommand(paths)
            });
            reportBootstrapInitResult(paths, bootstrapResult);
        }

        syncProjectTopology(paths, true);
        writeTriadizationArtifacts(paths);
        const { runtimeResult, viewMapResult } = await refreshRuntimeAndViewArtifacts(paths);
        assertNoTopologicalDegradation(paths, previousMap, 'init');
        installAlwaysOnRules(paths);
        writeMasterPrompt(paths);
        reportRuntimeArtifactStatus(paths, runtimeResult);
        reportViewMapStatus(paths, viewMapResult);
        runAutoDreamAfterCommand(paths, 'init');

        return { paths };
    }

    initializeBootstrapScaffold(options: { force?: boolean; nonInteractive?: boolean } = {}) {
        const paths = this.getPaths();
        ensureTriadSpec(paths);

        const result = this.bootstrapScaffoldService.init(paths, {
            force: Boolean(options.force),
            nonInteractive: Boolean(options.nonInteractive),
            triadmindCommand: this.resolveBootstrapCommand(paths)
        });

        return { paths, result };
    }

    doctorBootstrap() {
        const paths = this.getPaths();
        ensureTriadSpec(paths);

        const report = this.bootstrapScaffoldService.doctor(paths, {
            triadmindCommand: this.resolveBootstrapCommand(paths)
        });

        return { paths, report };
    }

    installRules() {
        const paths = this.getPaths();
        ensureTriadSpec(paths);
        installAlwaysOnRules(paths);
        return { paths };
    }

    runSelfBootstrap() {
        const paths = this.getPaths();
        ensureTriadSpec(paths);
        syncProjectTopology(paths, true);

        const protocol = writeSelfBootstrapProtocol(paths);
        validateDraftProtocol(paths);
        generateDashboard(paths.mapFile, paths.draftFile, paths.visualizerFile);
        const reportPath = writeSelfBootstrapReport(paths);
        writeMasterPrompt(paths);
        installAlwaysOnRules(paths);

        return {
            paths,
            reportPath,
            reusedVertexCount: protocol.actions.length
        };
    }

    inspectAdapters() {
        const paths = this.getPaths();
        ensureTriadSpec(paths);

        try {
            return {
                paths,
                adapters: getAvailableAdapters(),
                currentAdapter: resolveAdapter(paths)
            };
        } catch (error: any) {
            return {
                paths,
                adapters: getAvailableAdapters(),
                currentAdapter: undefined,
                currentAdapterError: error?.message ? String(error.message) : String(error)
            };
        }
    }

    private resolveBootstrapCommand(paths: WorkspacePaths) {
        return resolveBootstrapCliCommand(paths);
    }
}

abstract class AbstractWorkspaceLifecycleCommand {
    constructor(protected readonly workflow: WorkspaceLifecycleService) {}
}

class InitCommand extends AbstractWorkspaceLifecycleCommand {
    register(program: Command) {
        program
            .command('init')
            .description('Initialize the `.triadmind` workspace and regenerate `triad-map.json`')
            .option('--skip-bootstrap', 'Skip session bootstrap scaffold generation')
            .action(async (options: { skipBootstrap?: boolean }) => {
                const { paths } = await this.workflow.initializeWorkspace(options);
                console.log(chalk.green(`triad-map written: ${paths.mapFile}`));
                console.log(chalk.green(`triad.md written: ${paths.triadSpecFile}`));
                console.log(chalk.green(`Master prompt written: ${paths.masterPromptFile}`));
            });
    }
}

class BootstrapCommandGroup extends AbstractWorkspaceLifecycleCommand {
    register(program: Command) {
        const bootstrapCommand = program
            .command('bootstrap')
            .description('Session bootstrap scaffolding for AGENTS/skills/bootstrap scripts');

        bootstrapCommand
            .command('init')
            .description('Create or update TriadMind session bootstrap files')
            .option('--force', 'Overwrite scaffold files that already exist')
            .option('--non-interactive', 'Run without interactive prompts')
            .action((options: { force?: boolean; nonInteractive?: boolean }) => {
                const { paths, result } = this.workflow.initializeBootstrapScaffold(options);
                reportBootstrapInitResult(paths, result);
            });

        bootstrapCommand
            .command('doctor')
            .description('Check bootstrap scaffold health and template freshness')
            .option('--json', 'Emit machine-readable JSON report')
            .action((options: { json?: boolean }) => {
                const { report } = this.workflow.doctorBootstrap();

                if (options.json) {
                    console.log(JSON.stringify(report, null, 2));
                } else {
                    console.log(formatBootstrapDoctorReport(report));
                }

                if (!report.passed) {
                    process.exitCode = 1;
                }
            });
    }
}

class RulesCommand extends AbstractWorkspaceLifecycleCommand {
    register(program: Command) {
        program
            .command('rules')
            .description('Install always-on TriadMind rules for AGENTS.md and Cursor')
            .action(() => {
                const { paths } = this.workflow.installRules();
                console.log(chalk.green(`Always-on rules written: ${paths.agentRulesFile}`));
                console.log(chalk.green(`Cursor rule written: ${paths.cursorRuleFile}`));
            });
    }
}

class SelfBootstrapCommand extends AbstractWorkspaceLifecycleCommand {
    register(program: Command) {
        program
            .command('self')
            .description('Bootstrap triadmind-core with its own TriadMind topology protocol and self-architecture report')
            .action(() => {
                const { paths, reportPath, reusedVertexCount } = this.workflow.runSelfBootstrap();
                console.log(chalk.green(`Self-bootstrap report written: ${reportPath}`));
                console.log(chalk.green(`Self-bootstrap protocol written: ${paths.selfBootstrapProtocolFile}`));
                console.log(chalk.green(`Review graph written: ${paths.visualizerFile}`));
                console.log(
                    chalk.yellow(
                        `Reused ${reusedVertexCount} existing TriadMind vertices; no source files were changed.`
                    )
                );
            });
    }
}

class AdaptersCommand extends AbstractWorkspaceLifecycleCommand {
    register(program: Command) {
        program
            .command('adapters')
            .description('Show TriadMind adapter registry and current project adapter')
            .action(() => {
                const { adapters, currentAdapter, currentAdapterError } = this.workflow.inspectAdapters();

                console.log(chalk.cyan('[TriadMind] Available language adapters'));
                for (const adapter of adapters) {
                    const marker = adapter.status === 'stable' ? chalk.green('stable') : chalk.yellow('planned');
                    console.log(
                        `- ${adapter.displayName} (${adapter.language}) | parser=${adapter.parserEngine} | package=${adapter.adapterPackage} | ${marker}`
                    );
                }

                if (currentAdapter) {
                    console.log(
                        chalk.green(`Current project adapter: ${currentAdapter.displayName} (${currentAdapter.language})`)
                    );
                    return;
                }

                if (currentAdapterError) {
                    console.log(chalk.yellow(`Current project adapter status: ${currentAdapterError}`));
                }
            });
    }
}

export function registerWorkspaceLifecycleCommands(
    program: Command,
    options: WorkspaceLifecycleRegistrarOptions = {}
) {
    const workflow = new WorkspaceLifecycleService(
        options.bootstrapScaffoldService ?? new BootstrapScaffoldService()
    );

    new InitCommand(workflow).register(program);
    new BootstrapCommandGroup(workflow).register(program);
    new RulesCommand(workflow).register(program);
    new SelfBootstrapCommand(workflow).register(program);
    new AdaptersCommand(workflow).register(program);
}
