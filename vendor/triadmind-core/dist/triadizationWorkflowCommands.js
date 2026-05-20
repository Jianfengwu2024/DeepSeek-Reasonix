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
exports.registerTriadizationWorkflowCommands = registerTriadizationWorkflowCommands;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const inquirer_1 = __importDefault(require("inquirer"));
const snapshot_1 = require("./snapshot");
const rules_1 = require("./rules");
const cliSupport_1 = require("./cliSupport");
const visualizer_1 = require("./visualizer");
const triadization_1 = require("./triadization");
const workflow_1 = require("./workflow");
class AbstractTriadizationCommand {
    workflow;
    constructor(workflow) {
        this.workflow = workflow;
    }
    getPaths() {
        return (0, workflow_1.getWorkspacePaths)(process.cwd());
    }
}
class AbstractTriadizationReviewCommand extends AbstractTriadizationCommand {
    buildReviewGraph(paths, options) {
        const protocol = (0, cliSupport_1.validateDraftProtocol)(paths);
        (0, cliSupport_1.warnBlastRadiusIfNeeded)(paths, protocol);
        (0, visualizer_1.generateDashboard)(paths.mapFile, paths.draftFile, paths.visualizerFile, (0, cliSupport_1.toDashboardOptions)(options));
        console.log(chalk_1.default.green(`[TriadMind] 演化视图已生成: ${paths.visualizerFile}`));
        return protocol;
    }
    async maybeOpenReviewGraph(paths, options) {
        if (options.open === false) {
            return;
        }
        try {
            await (0, cliSupport_1.openFile)(paths.visualizerFile);
        }
        catch (error) {
            console.log(chalk_1.default.yellow(`[TriadMind] failed to open browser automatically: ${error.message}`));
        }
    }
}
class TriadizationWorkflowService {
    hooks;
    constructor(hooks) {
        this.hooks = hooks;
    }
    ensureWorkspace(paths) {
        (0, workflow_1.ensureTriadSpec)(paths);
    }
    ensureTopology(paths, options = {}) {
        this.ensureWorkspace(paths);
        if (fs.existsSync(paths.mapFile)) {
            return;
        }
        if (options.logWhenMissing) {
            console.log(chalk_1.default.yellow(options.logWhenMissing));
        }
        (0, cliSupport_1.syncProjectTopology)(paths, Boolean(options.force));
    }
    refreshTriadization(paths) {
        const report = (0, triadization_1.writeTriadizationArtifacts)(paths);
        reportTriadizationStatus(paths, report);
        return report;
    }
    async ensureTriadizationConfirmation(paths, report, source, autoConfirm = false) {
        if (!report.primaryProposal) {
            return true;
        }
        if ((0, triadization_1.hasConfirmedTriadization)(paths, report)) {
            return true;
        }
        let confirmed = autoConfirm;
        if (!confirmed) {
            const answer = await inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: (0, triadization_1.buildTriadizationConfirmationMessage)(report),
                    default: false
                }
            ]);
            confirmed = answer.confirm;
        }
        if (!confirmed) {
            return false;
        }
        (0, triadization_1.writeTriadizationConfirmation)(paths, report, source);
        return true;
    }
    async executeApply(projectRoot, options) {
        const paths = (0, workflow_1.getWorkspacePaths)(projectRoot);
        try {
            if (!fs.existsSync(paths.mapFile)) {
                (0, cliSupport_1.syncProjectTopology)(paths);
            }
            const triadizationReport = options.triadizationReport ?? this.refreshTriadization(paths);
            if (options.triadizationReport) {
                reportTriadizationStatus(paths, triadizationReport);
            }
            const confirmed = await this.ensureTriadizationConfirmation(paths, triadizationReport, options.source, Boolean(options.autoConfirmTriadization));
            if (!confirmed) {
                console.log(chalk_1.default.red('[TriadMind] apply cancelled because the triadization session is not confirmed.'));
                return;
            }
            const previousMap = (0, cliSupport_1.readCurrentTriadMap)(paths);
            const protocol = (0, cliSupport_1.validateDraftProtocol)(paths);
            const snapshot = (0, snapshot_1.createSnapshot)(paths, 'before-apply', (0, snapshot_1.collectProtocolSnapshotFiles)(paths, protocol));
            console.log(chalk_1.default.gray(`   - [Snapshot] created ${snapshot.id}`));
            console.log(chalk_1.default.cyan('[TriadMind] applying approved protocol...'));
            const approvedProtocolJson = JSON.stringify(protocol, null, 2);
            fs.writeFileSync(paths.approvedProtocolFile, approvedProtocolJson, 'utf-8');
            const result = (0, cliSupport_1.dispatchProtocolApply)(projectRoot, protocol);
            console.log(chalk_1.default.gray(`   - [Adapter] detected ${result.language} -> ${result.displayName}`));
            (0, cliSupport_1.syncProjectTopology)(paths, true);
            (0, cliSupport_1.assertNoTopologicalDegradation)(paths, previousMap, 'apply');
            (0, cliSupport_1.writeHandoffPrompt)(projectRoot, result.changedFiles, approvedProtocolJson);
            this.hooks.runAutoDreamAfterCommand(paths, 'apply');
            if (fs.existsSync(paths.draftFile)) {
                fs.unlinkSync(paths.draftFile);
            }
            console.log(chalk_1.default.green(`[TriadMind] apply completed; triad-map refreshed: ${paths.mapFile}`));
            console.log(chalk_1.default.green(`[TriadMind] handoff prompt written: ${paths.handoffPromptFile}`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`[TriadMind] apply failed: ${error.message}`));
            process.exitCode = 1;
        }
    }
    runAutoDream(paths, trigger) {
        this.hooks.runAutoDreamAfterCommand(paths, trigger);
    }
    executeConverge(paths) {
        this.hooks.executeConvergePlaceholder(paths);
    }
}
class TriadizeCommand extends AbstractTriadizationCommand {
    register(program) {
        program
            .command('triadize')
            .description('Analyze current topology and emit triadization diagnosis/task artifacts')
            .option('--json', 'Emit machine-readable triadization report JSON')
            .option('--confirm', 'Record the current primary triadization proposal as confirmed')
            .action(async (options) => {
            const paths = this.getPaths();
            this.workflow.ensureTopology(paths);
            const report = this.workflow.refreshTriadization(paths);
            if (options.confirm) {
                const confirmed = await this.workflow.ensureTriadizationConfirmation(paths, report, 'triadize', false);
                if (!confirmed) {
                    console.log(chalk_1.default.red('[TriadMind] triadization confirmation cancelled.'));
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
    register(program) {
        program
            .command('plan')
            .description('Validate draft-protocol.json, generate visualizer.html, and optionally apply the protocol')
            .option('--apply', 'Skip the extra prompt and continue straight into apply')
            .option('--no-open', 'Generate visualizer.html without opening the browser')
            .option('--view <architecture|leaf>', 'Set the initial visualizer view')
            .option('--show-isolated', 'Show isolated capability nodes in architecture view')
            .option('--full-contract-edges', 'Disable contract-edge capping in the visualizer')
            .action(async (options) => {
            const paths = this.getPaths();
            console.log(chalk_1.default.cyan('[TriadMind] preparing topology review graph...'));
            this.workflow.ensureTopology(paths, {
                logWhenMissing: '[TriadMind] triad-map.json is missing; running a topology sync first.'
            });
            const triadizationReport = this.workflow.refreshTriadization(paths);
            if (!fs.existsSync(paths.draftFile)) {
                (0, workflow_1.createDraftTemplate)(paths);
                console.log(chalk_1.default.yellow(`[TriadMind] draft-protocol.json was missing; a template was created: ${paths.draftFile}`));
                console.log(chalk_1.default.yellow(`[TriadMind] review ${paths.triadizationReportFile} and ${paths.triadizationTaskFile}, confirm the current triadization focus, then generate the draft protocol.`));
                console.log(chalk_1.default.yellow(`[TriadMind] use ${paths.promptFile} to ask the AI assistant for the draft protocol.`));
                return;
            }
            try {
                this.buildReviewGraph(paths, options);
            }
            catch (error) {
                console.log(chalk_1.default.red(`Draft protocol validation failed: ${error.message}`));
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
                const answer = await inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: (0, triadization_1.buildTriadizationConfirmationMessage)(triadizationReport),
                        default: false
                    }
                ]);
                shouldApply = answer.confirm;
            }
            if (!shouldApply) {
                console.log(chalk_1.default.red('[TriadMind] apply cancelled; no source files were changed.'));
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
    register(program) {
        program
            .command('invoke [demand...]')
            .description('One-click entry for AI assistants, compatible with "@triadmind <demand>" inputs')
            .option('-d, --demand <text>', 'Provide the user demand explicitly')
            .option('--apply', 'If draft-protocol.json is ready, continue straight into plan/apply')
            .option('--view <architecture|leaf>', 'Set the initial visualizer view for the generated review graph')
            .option('--show-isolated', 'Show isolated capability nodes in architecture view')
            .option('--full-contract-edges', 'Disable contract-edge capping in the visualizer')
            .action(async (demandParts, options) => {
            const paths = this.getPaths();
            const rawDemand = (0, cliSupport_1.resolveDemand)(demandParts, options.demand, paths);
            const demand = (0, cliSupport_1.normalizeInvokeDemand)(rawDemand);
            if (!demand) {
                console.log(chalk_1.default.red('[TriadMind] please provide a demand, for example: triadmind invoke "@triadmind add CSV export".'));
                process.exitCode = 1;
                return;
            }
            console.log(chalk_1.default.cyan('[TriadMind] preparing invoke workflow...'));
            if (isConvergeDirective(demand)) {
                this.workflow.executeConverge(paths);
                return;
            }
            (0, cliSupport_1.prepareWorkspace)(paths, demand);
            (0, rules_1.installAlwaysOnRules)(paths);
            const triadizationReport = this.workflow.refreshTriadization(paths);
            console.log(chalk_1.default.green(`[TriadMind] implementation prompt ready: ${paths.implementationPromptFile}`));
            console.log(chalk_1.default.green(`[TriadMind] protocol task prompt: ${paths.protocolTaskFile}`));
            console.log(chalk_1.default.green(`[TriadMind] draft protocol target: ${paths.draftFile}`));
            if (!options.apply) {
                console.log(chalk_1.default.yellow('[TriadMind] let the AI assistant read implementation-prompt.md and silently complete Macro/Meso/Micro/Protocol first.'));
                console.log(chalk_1.default.yellow('[TriadMind] after saving the protocol, rerun "npm run invoke -- --apply" or "npm run plan -- --no-open --apply".'));
                return;
            }
            try {
                this.buildReviewGraph(paths, options);
            }
            catch (error) {
                console.log(chalk_1.default.red(`[TriadMind] draft-protocol.json is not ready to land yet: ${error.message}`));
                console.log(chalk_1.default.yellow(`[TriadMind] ask the AI assistant to write the full protocol into ${paths.draftFile}, then rerun "invoke --apply".`));
                process.exitCode = 1;
                return;
            }
            console.log(chalk_1.default.green(`[TriadMind] silent review graph generated: ${paths.visualizerFile}`));
            await this.workflow.executeApply(paths.projectRoot, {
                source: 'invoke',
                autoConfirmTriadization: true,
                triadizationReport
            });
        });
    }
}
class ApplyCommand extends AbstractTriadizationCommand {
    register(program) {
        program
            .command('apply')
            .description('Execute draft-protocol.json directly and refresh triad-map.json')
            .action(async () => {
            const paths = this.getPaths();
            if (!fs.existsSync(paths.draftFile)) {
                console.log(chalk_1.default.red(`[TriadMind] draft protocol file not found: ${paths.draftFile}`));
                process.exitCode = 1;
                return;
            }
            await this.workflow.executeApply(paths.projectRoot, {
                source: 'apply'
            });
        });
    }
}
function registerTriadizationWorkflowCommands(program, hooks) {
    const workflow = new TriadizationWorkflowService(hooks);
    new TriadizeCommand(workflow).register(program);
    new PlanCommand(workflow).register(program);
    new InvokeCommand(workflow).register(program);
    new ApplyCommand(workflow).register(program);
}
function reportTriadizationStatus(paths, report) {
    const session = (0, triadization_1.readTriadizationSession)(paths);
    const focusState = (0, triadization_1.resolveTriadizationFocusState)({
        session,
        report
    });
    if (!report.primaryProposal) {
        console.log(chalk_1.default.yellow('[TriadMind] no actionable triadization proposal was found in the current topology.'));
        console.log(chalk_1.default.green(`[TriadMind] triadization report written: ${paths.triadizationReportFile}`));
        console.log(chalk_1.default.green(`[TriadMind] triadization task written: ${paths.triadizationTaskFile}`));
        return;
    }
    const proposal = report.primaryProposal;
    const exactFocus = (0, triadization_1.formatTriadizationFocusState)(focusState) ?? `${proposal.targetNodeId} -> ${proposal.recommendedOperation}`;
    console.log(chalk_1.default.cyan(`[TriadMind] triadization focus: ${exactFocus} (${proposal.diagnosis.join(', ')})`));
    console.log(chalk_1.default.gray(`   - rationale: ${proposal.rationale}`));
    if (proposal.blastRadius.impactedNodeCount > 0) {
        console.log(chalk_1.default.gray(`   - blast radius: ${proposal.blastRadius.impactedNodeCount} downstream node(s) (${proposal.blastRadius.impactedNodeIds
            .slice(0, 8)
            .join(', ')})`));
    }
    if (session && session.proposalId === proposal.proposalId) {
        const statusLabel = session.status === 'confirmed' ? 'confirmed' : 'proposed';
        console.log(chalk_1.default.gray(`   - session: ${session.sessionId} [${statusLabel}]`));
    }
    console.log(chalk_1.default.green(`[TriadMind] triadization session written: ${paths.triadizationSessionFile}`));
    console.log(chalk_1.default.green(`[TriadMind] triadization report written: ${paths.triadizationReportFile}`));
    console.log(chalk_1.default.green(`[TriadMind] triadization task written: ${paths.triadizationTaskFile}`));
}
function isConvergeDirective(value) {
    const normalized = value.trim().toLowerCase();
    return normalized === 'converge' || normalized === 'renormalize --deep' || normalized === '@triadmind converge';
}
//# sourceMappingURL=triadizationWorkflowCommands.js.map