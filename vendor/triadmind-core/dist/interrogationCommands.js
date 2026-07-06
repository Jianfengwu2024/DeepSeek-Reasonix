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
exports.registerInterrogationCommands = registerInterrogationCommands;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const cliSupport_1 = require("./cliSupport");
const interrogation_1 = require("./interrogation");
const workflow_1 = require("./workflow");
function registerInterrogationCommands(program) {
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
        .action(async (demandParts, options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const demand = resolveInterrogationDemand(demandParts, options.demand, paths);
        if (!demand) {
            console.log(chalk_1.default.red('Please provide a demand, for example: triadmind interrogate "add a requirement clarification gate before apply"'));
            process.exitCode = 1;
            return;
        }
        if (!fs.existsSync(paths.mapFile)) {
            console.log(chalk_1.default.yellow('[TriadMind] triad-map.json is missing; running a topology sync first.'));
            (0, cliSupport_1.syncProjectTopology)(paths);
        }
        try {
            const result = await (0, interrogation_1.runInterrogation)(paths, demand, {
                answersFile: options.answersFile,
                llm: options.llm,
                dashboardOptions: (0, cliSupport_1.toDashboardOptions)(options)
            });
            if (result.status === 'impact_ready' && options.open !== false && result.impactVisualizerFile) {
                await (0, cliSupport_1.openFile)(result.impactVisualizerFile);
            }
            if (options.json) {
                console.log(JSON.stringify(result, null, 2));
                return;
            }
            result.summary.forEach((line) => console.log(chalk_1.default.green(`[TriadMind] ${line}`)));
            if (result.status === 'pending_answers') {
                console.log(chalk_1.default.yellow(`[TriadMind] answer the planned questions in ${paths.interrogationStateFile}, then rerun \`triadmind interrogate\`.`));
                return;
            }
            if (result.status === 'pending_impact_protocol') {
                console.log(chalk_1.default.yellow(`[TriadMind] interrogation is ready, but impact protocol is still pending. Review ${paths.impactPromptFile} or rerun with --llm.`));
                return;
            }
            if (result.state.status === 'approved_for_development') {
                console.log(chalk_1.default.yellow(`[TriadMind] small-impact demand auto-passed the interrogation gate. You can continue directly into apply.`));
                return;
            }
            console.log(chalk_1.default.yellow(`[TriadMind] review the shock chain in ${paths.impactVisualizerFile}, then run \`triadmind interrogate-approve\` before apply.`));
        }
        catch (error) {
            console.log(chalk_1.default.red(`[TriadMind] interrogate failed: ${error.message}`));
            process.exitCode = 1;
        }
    });
    program
        .command('interrogate-review')
        .description('Print the current interrogation state artifact')
        .option('--json', 'Emit machine-readable interrogation state JSON')
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const state = (0, interrogation_1.reviewInterrogation)(paths);
        if (!state) {
            console.log(chalk_1.default.red(`No interrogation state found: ${paths.interrogationStateFile}`));
            process.exitCode = 1;
            return;
        }
        if (options.json) {
            console.log(JSON.stringify(state, null, 2));
            return;
        }
        console.log(chalk_1.default.green(`[TriadMind] interrogation state: ${paths.interrogationStateFile}`));
        console.log(chalk_1.default.green(`[TriadMind] status=${state.status}, workflowStage=${state.workflowStage}`));
        if (state.clarifiedRequirement?.summary) {
            console.log(chalk_1.default.gray(`   - summary: ${state.clarifiedRequirement.summary}`));
        }
        if (state.impactFiles?.impactVisualizerFile) {
            console.log(chalk_1.default.gray(`   - impact visualizer: ${state.impactFiles.impactVisualizerFile}`));
        }
    });
    program
        .command('interrogate-approve')
        .description('Approve the current interrogation result so apply can continue')
        .option('--json', 'Emit machine-readable approved interrogation state JSON')
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        try {
            const state = (0, interrogation_1.approveInterrogation)(paths);
            if (options.json) {
                console.log(JSON.stringify(state, null, 2));
                return;
            }
            console.log(chalk_1.default.green(`[TriadMind] interrogation approved: ${paths.interrogationStateFile}`));
            if (state.approvedAt) {
                console.log(chalk_1.default.gray(`   - approvedAt: ${state.approvedAt}`));
            }
        }
        catch (error) {
            console.log(chalk_1.default.red(`[TriadMind] interrogation approval failed: ${error.message}`));
            process.exitCode = 1;
        }
    });
}
function resolveInterrogationDemand(demandParts, explicitDemand, paths) {
    const resolvedExplicitDemand = (0, cliSupport_1.resolveDemand)(demandParts, explicitDemand);
    if (resolvedExplicitDemand) {
        return resolvedExplicitDemand;
    }
    const existingState = (0, interrogation_1.reviewInterrogation)(paths);
    if (existingState?.userDemand?.trim()) {
        return existingState.userDemand.trim();
    }
    return (0, cliSupport_1.resolveDemand)([], undefined, paths);
}
//# sourceMappingURL=interrogationCommands.js.map