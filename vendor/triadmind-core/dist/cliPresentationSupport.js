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
exports.printPassPrompt = printPassPrompt;
exports.reportBootstrapInitResult = reportBootstrapInitResult;
exports.formatBootstrapDoctorReport = formatBootstrapDoctorReport;
exports.resolveBootstrapCliCommand = resolveBootstrapCliCommand;
exports.normalizeScanModeOption = normalizeScanModeOption;
exports.normalizePositiveCliInteger = normalizePositiveCliInteger;
exports.parseOptionalPositiveCliInteger = parseOptionalPositiveCliInteger;
exports.parseOptionalNonNegativeCliInteger = parseOptionalNonNegativeCliInteger;
exports.parseOptionalRatioCliNumber = parseOptionalRatioCliNumber;
exports.resolveHealingInput = resolveHealingInput;
exports.collectManualSnapshotFiles = collectManualSnapshotFiles;
exports.normalizeDreamDefaultSubcommandArgv = normalizeDreamDefaultSubcommandArgv;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const artifactReaders_1 = require("./artifactReaders");
const cliSupport_1 = require("./cliSupport");
const workflow_1 = require("./workflow");
const workspace_1 = require("./workspace");
const DREAM_EXPLICIT_SUBCOMMANDS = new Set(['run', 'auto', 'review', 'visualize', 'daemon', 'daemon-loop', 'help']);
function printPassPrompt(stage, demandParts, optionDemand) {
    const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
    const demand = (0, cliSupport_1.resolveDemand)(demandParts, optionDemand, paths);
    if (!demand) {
        console.log(chalk_1.default.red('[TriadMind] please provide a demand, or run prepare/pipeline first to persist latest-demand.txt.'));
        process.exitCode = 1;
        return;
    }
    (0, cliSupport_1.prepareWorkspace)(paths, demand);
    const current = resolveSplitPromptArtifacts(paths, stage);
    console.log(chalk_1.default.cyan(`[TriadMind] preparing ${current.label} prompt...`));
    console.log(chalk_1.default.green(`[TriadMind] prompt file: ${current.prompt}`));
    console.log(chalk_1.default.green(`[TriadMind] output file: ${current.output}`));
    console.log(chalk_1.default.yellow(`[TriadMind] send ${current.prompt} to the AI assistant and write the JSON result back to ${current.output}.`));
    console.log(chalk_1.default.yellow(`[TriadMind] continue until the final protocol lands in ${paths.draftFile}.`));
}
function reportBootstrapInitResult(paths, result) {
    const created = result.files.filter((item) => item.action === 'created').length;
    const updated = result.files.filter((item) => item.action === 'updated').length;
    const skipped = result.files.filter((item) => item.action === 'skipped').length;
    console.log(chalk_1.default.green(`[TriadMind] bootstrap init complete: created=${created}, updated=${updated}, skipped=${skipped}`));
    result.files.forEach((item) => {
        const marker = item.action === 'created' ? chalk_1.default.green('+') : item.action === 'updated' ? chalk_1.default.yellow('~') : chalk_1.default.gray('=');
        console.log(chalk_1.default.gray(`   ${marker} ${item.key}: ${item.path}`));
    });
    console.log(chalk_1.default.green(`[TriadMind] session verify output target: ${paths.bootstrapVerifyFile}`));
}
function formatBootstrapDoctorReport(report) {
    const summary = report.passed ? 'PASS' : 'FAIL';
    const lines = [
        `TriadMind Bootstrap Doctor (${summary})`,
        `generatedAt=${report.generatedAt}`,
        `pass=${report.summary.passCount}, fail=${report.summary.failCount}`
    ];
    for (const file of report.files) {
        const icon = file.status === 'pass' ? 'PASS' : 'FAIL';
        lines.push(`[${icon}] ${file.key} | ${file.message}`);
        if (file.recommendedAction) {
            lines.push(`   action: ${file.recommendedAction}`);
        }
    }
    return lines.join('\n');
}
function resolveBootstrapCliCommand(paths) {
    const invokedScript = path.resolve(process.argv[1] ?? '');
    const projectCliTs = path.join(paths.projectRoot, 'cli.ts');
    const projectCliJs = path.join(paths.projectRoot, 'dist', 'cli.js');
    if (invokedScript && (0, workspace_1.normalizePath)(invokedScript) === (0, workspace_1.normalizePath)(projectCliTs) && fs.existsSync(projectCliTs)) {
        return 'node --import tsx cli.ts';
    }
    if (invokedScript && (0, workspace_1.normalizePath)(invokedScript) === (0, workspace_1.normalizePath)(projectCliJs) && fs.existsSync(projectCliJs)) {
        return 'node dist/cli.js';
    }
    return 'triadmind';
}
function normalizeScanModeOption(value) {
    if (value === 'leaf' || value === 'capability' || value === 'module' || value === 'domain') {
        return value;
    }
    return undefined;
}
function normalizePositiveCliInteger(value, fallback) {
    const parsed = parseOptionalCliInteger(value, (candidate) => candidate > 0);
    return parsed ?? fallback;
}
function parseOptionalPositiveCliInteger(value) {
    return parseOptionalCliInteger(value, (candidate) => candidate > 0);
}
function parseOptionalNonNegativeCliInteger(value) {
    return parseOptionalCliInteger(value, (candidate) => candidate >= 0);
}
function parseOptionalRatioCliNumber(value) {
    const parsed = Number.parseFloat(String(value ?? ''));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
        return parsed;
    }
    return undefined;
}
function resolveHealingInput(paths, errorFile, inlineMessage) {
    if (inlineMessage?.trim()) {
        return inlineMessage.trim();
    }
    if (errorFile?.trim()) {
        const candidate = path.isAbsolute(errorFile) ? errorFile : path.join(paths.projectRoot, errorFile);
        if (!fs.existsSync(candidate)) {
            throw new Error(`Healing input file not found: ${candidate}`);
        }
        return (0, artifactReaders_1.readTextIfExists)(candidate, { trim: true });
    }
    if (fs.existsSync(paths.runtimeErrorFile)) {
        return (0, artifactReaders_1.readTextIfExists)(paths.runtimeErrorFile, { trim: true });
    }
    return '';
}
function collectManualSnapshotFiles(paths) {
    return [
        path.relative(paths.projectRoot, paths.configFile),
        path.relative(paths.projectRoot, paths.mapFile),
        path.relative(paths.projectRoot, paths.draftFile),
        path.relative(paths.projectRoot, paths.approvedProtocolFile),
        path.relative(paths.projectRoot, paths.handoffPromptFile),
        path.relative(paths.projectRoot, paths.healingReportFile),
        path.relative(paths.projectRoot, paths.healingPromptFile),
        path.relative(paths.projectRoot, paths.runtimeErrorFile)
    ];
}
function normalizeDreamDefaultSubcommandArgv(argv) {
    if (!Array.isArray(argv) || argv.length < 3) {
        return argv;
    }
    const normalized = [...argv];
    const dreamIndex = normalized.findIndex((value, index) => index >= 2 && value === 'dream');
    if (dreamIndex < 0) {
        return normalized;
    }
    const nextToken = normalized[dreamIndex + 1];
    if (!nextToken) {
        normalized.splice(dreamIndex + 1, 0, 'run');
        return normalized;
    }
    if (DREAM_EXPLICIT_SUBCOMMANDS.has(nextToken) || nextToken === '-h' || nextToken === '--help') {
        return normalized;
    }
    if (nextToken.startsWith('-')) {
        normalized.splice(dreamIndex + 1, 0, 'run');
    }
    return normalized;
}
function resolveSplitPromptArtifacts(paths, stage) {
    const mapping = {
        macro: {
            prompt: paths.macroPromptFile,
            output: paths.macroSplitFile,
            label: 'Macro-Split'
        },
        meso: {
            prompt: paths.mesoPromptFile,
            output: paths.mesoSplitFile,
            label: 'Meso-Split'
        },
        micro: {
            prompt: paths.microPromptFile,
            output: paths.microSplitFile,
            label: 'Micro-Split'
        }
    };
    return mapping[stage];
}
function parseOptionalCliInteger(value, predicate) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (Number.isFinite(parsed) && predicate(parsed)) {
        return parsed;
    }
    return undefined;
}
//# sourceMappingURL=cliPresentationSupport.js.map