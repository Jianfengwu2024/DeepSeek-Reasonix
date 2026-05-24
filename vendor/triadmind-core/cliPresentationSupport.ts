import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { readTextIfExists } from './artifactReaders';
import { TriadScanMode } from './config';
import { BootstrapDoctorReport, BootstrapScaffoldInitResult } from './bootstrapScaffoldService';
import { prepareWorkspace, resolveDemand } from './cliSupport';
import { getWorkspacePaths, WorkspacePaths } from './workflow';
import { normalizePath } from './workspace';

export type SplitPromptStage = 'macro' | 'meso' | 'micro';

type SplitPromptArtifacts = {
    prompt: string;
    output: string;
    label: string;
};

const DREAM_EXPLICIT_SUBCOMMANDS = new Set(['run', 'auto', 'review', 'visualize', 'daemon', 'daemon-loop', 'help']);

export function printPassPrompt(stage: SplitPromptStage, demandParts: string[], optionDemand?: string) {
    const paths = getWorkspacePaths(process.cwd());
    const demand = resolveDemand(demandParts, optionDemand, paths);

    if (!demand) {
        console.log(chalk.red('[TriadMind] please provide a demand, or run prepare/pipeline first to persist latest-demand.txt.'));
        process.exitCode = 1;
        return;
    }

    prepareWorkspace(paths, demand);
    const current = resolveSplitPromptArtifacts(paths, stage);

    console.log(chalk.cyan(`[TriadMind] preparing ${current.label} prompt...`));
    console.log(chalk.green(`[TriadMind] prompt file: ${current.prompt}`));
    console.log(chalk.green(`[TriadMind] output file: ${current.output}`));
    console.log(chalk.yellow(`[TriadMind] send ${current.prompt} to the AI assistant and write the JSON result back to ${current.output}.`));
    console.log(chalk.yellow(`[TriadMind] continue until the final protocol lands in ${paths.draftFile}.`));
}

export function reportBootstrapInitResult(paths: WorkspacePaths, result: BootstrapScaffoldInitResult) {
    const created = result.files.filter((item) => item.action === 'created').length;
    const updated = result.files.filter((item) => item.action === 'updated').length;
    const skipped = result.files.filter((item) => item.action === 'skipped').length;
    console.log(chalk.green(`[TriadMind] bootstrap init complete: created=${created}, updated=${updated}, skipped=${skipped}`));
    result.files.forEach((item) => {
        const marker =
            item.action === 'created' ? chalk.green('+') : item.action === 'updated' ? chalk.yellow('~') : chalk.gray('=');
        console.log(chalk.gray(`   ${marker} ${item.key}: ${item.path}`));
    });
    console.log(chalk.green(`[TriadMind] session verify output target: ${paths.bootstrapVerifyFile}`));
}

export function formatBootstrapDoctorReport(report: BootstrapDoctorReport) {
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

export function resolveBootstrapCliCommand(paths: WorkspacePaths) {
    const invokedScript = path.resolve(process.argv[1] ?? '');
    const projectCliTs = path.join(paths.projectRoot, 'cli.ts');
    const projectCliJs = path.join(paths.projectRoot, 'dist', 'cli.js');

    if (invokedScript && normalizePath(invokedScript) === normalizePath(projectCliTs) && fs.existsSync(projectCliTs)) {
        return 'node --import tsx cli.ts';
    }

    if (invokedScript && normalizePath(invokedScript) === normalizePath(projectCliJs) && fs.existsSync(projectCliJs)) {
        return 'node dist/cli.js';
    }

    return 'triadmind';
}

export function normalizeScanModeOption(value?: string): TriadScanMode | undefined {
    if (value === 'leaf' || value === 'capability' || value === 'module' || value === 'domain') {
        return value;
    }

    return undefined;
}

export function normalizePositiveCliInteger(value: string | undefined, fallback: number) {
    const parsed = parseOptionalCliInteger(value, (candidate) => candidate > 0);
    return parsed ?? fallback;
}

export function parseOptionalPositiveCliInteger(value: string | undefined) {
    return parseOptionalCliInteger(value, (candidate) => candidate > 0);
}

export function parseOptionalNonNegativeCliInteger(value: string | undefined) {
    return parseOptionalCliInteger(value, (candidate) => candidate >= 0);
}

export function parseOptionalRatioCliNumber(value: string | undefined) {
    const parsed = Number.parseFloat(String(value ?? ''));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
        return parsed;
    }

    return undefined;
}

export function resolveHealingInput(paths: WorkspacePaths, errorFile?: string, inlineMessage?: string) {
    if (inlineMessage?.trim()) {
        return inlineMessage.trim();
    }

    if (errorFile?.trim()) {
        const candidate = path.isAbsolute(errorFile) ? errorFile : path.join(paths.projectRoot, errorFile);
        if (!fs.existsSync(candidate)) {
            throw new Error(`Healing input file not found: ${candidate}`);
        }

        return readTextIfExists(candidate, { trim: true });
    }

    if (fs.existsSync(paths.runtimeErrorFile)) {
        return readTextIfExists(paths.runtimeErrorFile, { trim: true });
    }

    return '';
}

export function collectManualSnapshotFiles(paths: WorkspacePaths) {
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

export function normalizeDreamDefaultSubcommandArgv(argv: string[]) {
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

function resolveSplitPromptArtifacts(paths: WorkspacePaths, stage: SplitPromptStage): SplitPromptArtifacts {
    const mapping: Record<SplitPromptStage, SplitPromptArtifacts> = {
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

function parseOptionalCliInteger(
    value: string | undefined,
    predicate: (candidate: number) => boolean
) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (Number.isFinite(parsed) && predicate(parsed)) {
        return parsed;
    }

    return undefined;
}
