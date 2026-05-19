"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWorkspaceLifecycleCommands = registerWorkspaceLifecycleCommands;
const chalk_1 = __importDefault(require("chalk"));
const adapter_1 = require("./adapter");
const bootstrap_1 = require("./bootstrap");
const bootstrapScaffoldService_1 = require("./bootstrapScaffoldService");
const cliSupport_1 = require("./cliSupport");
const cliPresentationSupport_1 = require("./cliPresentationSupport");
const cliWorkflowSupport_1 = require("./cliWorkflowSupport");
const rules_1 = require("./rules");
const triadization_1 = require("./triadization");
const visualizer_1 = require("./visualizer");
const workflow_1 = require("./workflow");
class WorkspaceLifecycleService {
    bootstrapScaffoldService;
    constructor(bootstrapScaffoldService) {
        this.bootstrapScaffoldService = bootstrapScaffoldService;
    }
    getPaths() {
        return (0, workflow_1.getWorkspacePaths)(process.cwd());
    }
    async initializeWorkspace(options = {}) {
        const paths = this.getPaths();
        const previousMap = (0, cliSupport_1.readCurrentTriadMap)(paths);
        console.log(chalk_1.default.cyan('[TriadMind] Initializing workspace...'));
        (0, workflow_1.ensureTriadSpec)(paths);
        if (!options.skipBootstrap) {
            const bootstrapResult = this.bootstrapScaffoldService.init(paths, {
                nonInteractive: true,
                triadmindCommand: this.resolveBootstrapCommand(paths)
            });
            (0, cliPresentationSupport_1.reportBootstrapInitResult)(paths, bootstrapResult);
        }
        (0, cliSupport_1.syncProjectTopology)(paths, true);
        (0, triadization_1.writeTriadizationArtifacts)(paths);
        const { runtimeResult, viewMapResult } = await (0, cliWorkflowSupport_1.refreshRuntimeAndViewArtifacts)(paths);
        (0, cliSupport_1.assertNoTopologicalDegradation)(paths, previousMap, 'init');
        (0, rules_1.installAlwaysOnRules)(paths);
        (0, workflow_1.writeMasterPrompt)(paths);
        (0, cliWorkflowSupport_1.reportRuntimeArtifactStatus)(paths, runtimeResult);
        (0, cliWorkflowSupport_1.reportViewMapStatus)(paths, viewMapResult);
        (0, cliWorkflowSupport_1.runAutoDreamAfterCommand)(paths, 'init');
        return { paths };
    }
    initializeBootstrapScaffold(options = {}) {
        const paths = this.getPaths();
        (0, workflow_1.ensureTriadSpec)(paths);
        const result = this.bootstrapScaffoldService.init(paths, {
            force: Boolean(options.force),
            nonInteractive: Boolean(options.nonInteractive),
            triadmindCommand: this.resolveBootstrapCommand(paths)
        });
        return { paths, result };
    }
    doctorBootstrap() {
        const paths = this.getPaths();
        (0, workflow_1.ensureTriadSpec)(paths);
        const report = this.bootstrapScaffoldService.doctor(paths, {
            triadmindCommand: this.resolveBootstrapCommand(paths)
        });
        return { paths, report };
    }
    installRules() {
        const paths = this.getPaths();
        (0, workflow_1.ensureTriadSpec)(paths);
        (0, rules_1.installAlwaysOnRules)(paths);
        return { paths };
    }
    runSelfBootstrap() {
        const paths = this.getPaths();
        (0, workflow_1.ensureTriadSpec)(paths);
        (0, cliSupport_1.syncProjectTopology)(paths, true);
        const protocol = (0, bootstrap_1.writeSelfBootstrapProtocol)(paths);
        (0, cliSupport_1.validateDraftProtocol)(paths);
        (0, visualizer_1.generateDashboard)(paths.mapFile, paths.draftFile, paths.visualizerFile);
        const reportPath = (0, bootstrap_1.writeSelfBootstrapReport)(paths);
        (0, workflow_1.writeMasterPrompt)(paths);
        (0, rules_1.installAlwaysOnRules)(paths);
        return {
            paths,
            reportPath,
            reusedVertexCount: protocol.actions.length
        };
    }
    inspectAdapters() {
        const paths = this.getPaths();
        (0, workflow_1.ensureTriadSpec)(paths);
        try {
            return {
                paths,
                adapters: (0, adapter_1.getAvailableAdapters)(),
                currentAdapter: (0, adapter_1.resolveAdapter)(paths)
            };
        }
        catch (error) {
            return {
                paths,
                adapters: (0, adapter_1.getAvailableAdapters)(),
                currentAdapter: undefined,
                currentAdapterError: error?.message ? String(error.message) : String(error)
            };
        }
    }
    resolveBootstrapCommand(paths) {
        return (0, cliPresentationSupport_1.resolveBootstrapCliCommand)(paths);
    }
}
class AbstractWorkspaceLifecycleCommand {
    workflow;
    constructor(workflow) {
        this.workflow = workflow;
    }
}
class InitCommand extends AbstractWorkspaceLifecycleCommand {
    register(program) {
        program
            .command('init')
            .description('Initialize the `.triadmind` workspace and regenerate `triad-map.json`')
            .option('--skip-bootstrap', 'Skip session bootstrap scaffold generation')
            .action(async (options) => {
            const { paths } = await this.workflow.initializeWorkspace(options);
            console.log(chalk_1.default.green(`triad-map written: ${paths.mapFile}`));
            console.log(chalk_1.default.green(`triad.md written: ${paths.triadSpecFile}`));
            console.log(chalk_1.default.green(`Master prompt written: ${paths.masterPromptFile}`));
        });
    }
}
class BootstrapCommandGroup extends AbstractWorkspaceLifecycleCommand {
    register(program) {
        const bootstrapCommand = program
            .command('bootstrap')
            .description('Session bootstrap scaffolding for AGENTS/skills/bootstrap scripts');
        bootstrapCommand
            .command('init')
            .description('Create or update TriadMind session bootstrap files')
            .option('--force', 'Overwrite scaffold files that already exist')
            .option('--non-interactive', 'Run without interactive prompts')
            .action((options) => {
            const { paths, result } = this.workflow.initializeBootstrapScaffold(options);
            (0, cliPresentationSupport_1.reportBootstrapInitResult)(paths, result);
        });
        bootstrapCommand
            .command('doctor')
            .description('Check bootstrap scaffold health and template freshness')
            .option('--json', 'Emit machine-readable JSON report')
            .action((options) => {
            const { report } = this.workflow.doctorBootstrap();
            if (options.json) {
                console.log(JSON.stringify(report, null, 2));
            }
            else {
                console.log((0, cliPresentationSupport_1.formatBootstrapDoctorReport)(report));
            }
            if (!report.passed) {
                process.exitCode = 1;
            }
        });
    }
}
class RulesCommand extends AbstractWorkspaceLifecycleCommand {
    register(program) {
        program
            .command('rules')
            .description('Install always-on TriadMind rules for AGENTS.md and Cursor')
            .action(() => {
            const { paths } = this.workflow.installRules();
            console.log(chalk_1.default.green(`Always-on rules written: ${paths.agentRulesFile}`));
            console.log(chalk_1.default.green(`Cursor rule written: ${paths.cursorRuleFile}`));
        });
    }
}
class SelfBootstrapCommand extends AbstractWorkspaceLifecycleCommand {
    register(program) {
        program
            .command('self')
            .description('Bootstrap triadmind-core with its own TriadMind topology protocol and self-architecture report')
            .action(() => {
            const { paths, reportPath, reusedVertexCount } = this.workflow.runSelfBootstrap();
            console.log(chalk_1.default.green(`Self-bootstrap report written: ${reportPath}`));
            console.log(chalk_1.default.green(`Self-bootstrap protocol written: ${paths.selfBootstrapProtocolFile}`));
            console.log(chalk_1.default.green(`Review graph written: ${paths.visualizerFile}`));
            console.log(chalk_1.default.yellow(`Reused ${reusedVertexCount} existing TriadMind vertices; no source files were changed.`));
        });
    }
}
class AdaptersCommand extends AbstractWorkspaceLifecycleCommand {
    register(program) {
        program
            .command('adapters')
            .description('Show TriadMind adapter registry and current project adapter')
            .action(() => {
            const { adapters, currentAdapter, currentAdapterError } = this.workflow.inspectAdapters();
            console.log(chalk_1.default.cyan('[TriadMind] Available language adapters'));
            for (const adapter of adapters) {
                const marker = adapter.status === 'stable' ? chalk_1.default.green('stable') : chalk_1.default.yellow('planned');
                console.log(`- ${adapter.displayName} (${adapter.language}) | parser=${adapter.parserEngine} | package=${adapter.adapterPackage} | ${marker}`);
            }
            if (currentAdapter) {
                console.log(chalk_1.default.green(`Current project adapter: ${currentAdapter.displayName} (${currentAdapter.language})`));
                return;
            }
            if (currentAdapterError) {
                console.log(chalk_1.default.yellow(`Current project adapter status: ${currentAdapterError}`));
            }
        });
    }
}
function registerWorkspaceLifecycleCommands(program, options = {}) {
    const workflow = new WorkspaceLifecycleService(options.bootstrapScaffoldService ?? new bootstrapScaffoldService_1.BootstrapScaffoldService());
    new InitCommand(workflow).register(program);
    new BootstrapCommandGroup(workflow).register(program);
    new RulesCommand(workflow).register(program);
    new SelfBootstrapCommand(workflow).register(program);
    new AdaptersCommand(workflow).register(program);
}
//# sourceMappingURL=workspaceLifecycleCommands.js.map