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
exports.registerNavigatorCommands = registerNavigatorCommands;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const cliSupport_1 = require("./cliSupport");
const navigator_1 = require("./navigator");
const workflow_1 = require("./workflow");
function registerNavigatorCommands(program) {
    registerNavigatorCommand(program, 'navigate', 'Generate a pre-implementation impact map for the requested feature');
    registerNavigatorCommand(program, 'impact', 'Alias of `navigate`');
}
function registerNavigatorCommand(program, name, description) {
    program
        .command(`${name} [demand...]`)
        .description(description)
        .option('-d, --demand <text>', 'Explicit feature description text')
        .option('--llm <provider:model>', 'Generate impact protocol via a live LLM provider before rendering')
        .option('--protocol <path>', 'Use an existing impact protocol JSON instead of the default .triadmind/impact-protocol.json')
        .option('--no-open', 'Generate the impact map without opening the browser')
        .option('--view <architecture|leaf>', 'Set the initial visualizer view')
        .option('--show-isolated', 'Show isolated capability nodes in architecture view')
        .option('--full-contract-edges', 'Disable contract-edge capping in the visualizer')
        .option('--json', 'Emit machine-readable navigator result JSON')
        .action(async (demandParts, options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const demand = (0, cliSupport_1.resolveDemand)(demandParts, options.demand, paths);
        if (!demand) {
            console.log(chalk_1.default.red('Please provide a feature description, for example: triadmind navigate "add payment module"'));
            process.exitCode = 1;
            return;
        }
        if (!fs.existsSync(paths.mapFile)) {
            console.log(chalk_1.default.yellow('[TriadMind] triad-map.json is missing; running a topology sync first.'));
            (0, cliSupport_1.syncProjectTopology)(paths);
        }
        try {
            const result = await (0, navigator_1.runNavigator)(paths, demand, {
                protocolPath: options.protocol,
                llm: options.llm,
                dashboardOptions: (0, cliSupport_1.toDashboardOptions)(options)
            });
            if (result.status === 'ready' && options.open !== false) {
                try {
                    await (0, cliSupport_1.openFile)(result.impactVisualizerFile);
                }
                catch (error) {
                    console.log(chalk_1.default.yellow(`[TriadMind] failed to open browser automatically: ${error.message}`));
                }
            }
            if (options.json) {
                console.log(JSON.stringify(result, null, 2));
                return;
            }
            if (result.status === 'pending_protocol') {
                console.log(chalk_1.default.cyan('[TriadMind] navigator prompt prepared.'));
                result.summary.forEach((line) => console.log(chalk_1.default.green(`[TriadMind] ${line}`)));
                console.log(chalk_1.default.yellow(`[TriadMind] send ${result.impactPromptFile} to the current AI assistant and save the JSON to ${result.impactProtocolFile}.`));
                console.log(chalk_1.default.yellow('[TriadMind] rerun `triadmind navigate` after the protocol is ready to render the red dashed impact map.'));
                return;
            }
            result.summary.forEach((line) => console.log(chalk_1.default.green(`[TriadMind] ${line}`)));
            console.log(chalk_1.default.green('[TriadMind] Impact map generated. Review the red dashed proposed nodes and edges in the browser.'));
            console.log(chalk_1.default.yellow('[TriadMind] If the impact looks correct, continue with `triadmind apply` or hand the approved protocol to the coding assistant.'));
        }
        catch (error) {
            console.log(chalk_1.default.red(`[TriadMind] navigate failed: ${error.message}`));
            process.exitCode = 1;
        }
    });
}
//# sourceMappingURL=navigatorCommands.js.map