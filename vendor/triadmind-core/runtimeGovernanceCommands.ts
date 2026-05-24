import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { detectCycles, generateRenormalizeProtocol } from './analyzer';
import { resolveAnalyzerOptionsFromConfig } from './analyzerOptionsSupport';
import { readCurrentTriadMap, syncProjectTopology } from './cliSupport';
import {
    normalizePositiveCliInteger,
    normalizeScanModeOption,
    parseOptionalNonNegativeCliInteger,
    parseOptionalPositiveCliInteger,
    parseOptionalRatioCliNumber
} from './cliPresentationSupport';
import {
    executeConvergePlaceholder,
    refreshRuntimeAndViewArtifacts,
    reportRuntimeArtifactStatus,
    reportViewMapStatus,
    runAutoDreamAfterCommand
} from './cliWorkflowSupport';
import { loadTriadConfig } from './config';
import { formatCoverageReport, runCoverage } from './coverage';
import { formatGovernReport, runGovern } from './govern';
import { normalizeRuntimeView } from './runtime/filterRuntimeMapByView';
import { generateRuntimeDashboard } from './runtime/runtimeVisualizer';
import { watchTriadMap } from './sync';
import { generateTrendArtifacts } from './trend';
import { writeTriadizationArtifacts } from './triadization';
import { formatVerifyReport, runTopologyVerify } from './verify';
import { writeViewMapArtifacts } from './viewMap';
import { ensureTriadSpec, getWorkspacePaths } from './workflow';

export function registerRuntimeGovernanceCommands(program: Command) {
    registerSyncCommands(program);
    registerRuntimeAndGovernanceCommands(program);
    registerTopologyUtilityCommands(program);
}

function registerSyncCommands(program: Command) {
    program
        .command('sync')
        .description('Incrementally synchronize triad-map using cached file hashes')
        .option('--force', 'Force a full triad-map rebuild')
        .option('--scan-mode <leaf|capability|module|domain>', 'Temporarily override parser scan mode for this sync')
        .action(async (options: { force?: boolean; scanMode?: string }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);
            syncProjectTopology(paths, Boolean(options.force), normalizeScanModeOption(options.scanMode));
            writeTriadizationArtifacts(paths);
            const { runtimeResult, viewMapResult } = await refreshRuntimeAndViewArtifacts(paths);
            reportRuntimeArtifactStatus(paths, runtimeResult);
            reportViewMapStatus(paths, viewMapResult);
            runAutoDreamAfterCommand(paths, 'sync');
        });

    program
        .command('watch')
        .description('Watch source files and keep triad-map synchronized')
        .action(async () => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);
            watchTriadMap(paths);
        });
}

function registerRuntimeAndGovernanceCommands(program: Command) {
    program
        .command('check')
        .description('Shortcut: sync --force -> verify --strict --json')
        .option('--focus <full|impact>', 'Verification scope (default: full)')
        .action((options: { focus?: string }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);
            syncProjectTopology(paths, true);
            writeTriadizationArtifacts(paths);
            const report = runTopologyVerify(paths, {
                strict: true,
                focus: options.focus === 'impact' ? 'impact' : 'full'
            });
            console.log(JSON.stringify(report, null, 2));
            runAutoDreamAfterCommand(paths, 'check');
            if (!report.passed) {
                process.exitCode = 1;
            }
        });

    program
        .command('ci')
        .description('Shortcut: sync --force -> runtime full -> verify --strict --json -> govern ci')
        .option('--scope <full|impact>', 'Governance and verify scope (default: config/full)')
        .action(async (options: { scope?: string }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);
            const scope = options.scope === 'impact' ? 'impact' : undefined;
            syncProjectTopology(paths, true);
            writeTriadizationArtifacts(paths);
            const { runtimeResult, viewMapResult } = await refreshRuntimeAndViewArtifacts(paths, {
                view: 'full'
            });
            reportRuntimeArtifactStatus(paths, runtimeResult);
            reportViewMapStatus(paths, viewMapResult);
            const verifyReport = runTopologyVerify(paths, {
                strict: true,
                focus: scope ?? 'full'
            });
            console.log(JSON.stringify(verifyReport, null, 2));
            const governResult = runGovern(paths, {
                mode: 'ci',
                scope
            });
            console.log(formatGovernReport(governResult.report));
            runAutoDreamAfterCommand(paths, 'ci');
            if (!verifyReport.passed || governResult.exitCode !== 0) {
                process.exitCode = governResult.exitCode || 1;
            }
        });

    program
        .command('runtime')
        .description('Extract runtime topology: frontend/API/service/workflow/worker/resource graph')
        .option('--visualize', 'Generate runtime-visualizer.html after extraction')
        .option('--view <workflow|request-flow|resources|events|infra|full>', 'Runtime topology view', 'full')
        .option('--include-frontend', 'Enable frontend API call extraction')
        .option('--include-infra', 'Enable docker/env/deployment extraction')
        .option('--framework <name>', 'Hint framework extractor, e.g. fastapi, express, celery')
        .option('--interactive', 'Generate interactive runtime topology visualizer', true)
        .option('--layout <leaf-force|dagre>', 'Runtime visualizer layout (legacy "force" maps to leaf-force)', 'leaf-force')
        .option('--trace-depth <n>', 'Default runtime trace depth', '2')
        .option('--max-render-edges <n>', 'Optional runtime visualizer edge cap (default: no cap)')
        .option('--hide-isolated', 'Hide isolated runtime nodes in the visualizer')
        .option('--theme <leaf-like|runtime-dark>', 'Runtime visualizer theme', 'leaf-like')
        .action(async (options: {
            visualize?: boolean;
            view?: string;
            includeFrontend?: boolean;
            includeInfra?: boolean;
            framework?: string;
            interactive?: boolean;
            layout?: string;
            traceDepth?: string;
            maxRenderEdges?: string;
            hideIsolated?: boolean;
            theme?: string;
        }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);

            const config = loadTriadConfig(paths);
            if (!config.runtime.enabled) {
                console.log(chalk.red('Runtime topology extraction is disabled in `.triadmind/config.json`.'));
                process.exitCode = 1;
                return;
            }

            const { runtimeResult, viewMapResult } = await refreshRuntimeAndViewArtifacts(paths, {
                view: normalizeRuntimeView(options.view, config.runtime.defaultView),
                includeFrontend: options.includeFrontend ?? config.runtime.includeFrontend,
                includeInfra: options.includeInfra ?? config.runtime.includeInfra,
                frameworkHint: options.framework
            });

            reportRuntimeArtifactStatus(paths, runtimeResult);
            reportViewMapStatus(paths, viewMapResult);
            runAutoDreamAfterCommand(paths, 'runtime');

            if (options.visualize) {
                generateRuntimeDashboard(paths.runtimeMapFile, paths.runtimeVisualizerFile, {
                    interactive: options.interactive !== false,
                    layout: options.layout === 'dagre' ? 'dagre' : 'leaf-force',
                    traceDepth: normalizePositiveCliInteger(options.traceDepth, 2),
                    maxRenderEdges: parseOptionalPositiveCliInteger(options.maxRenderEdges),
                    hideIsolated: Boolean(options.hideIsolated),
                    theme: options.theme === 'runtime-dark' ? 'runtime-dark' : 'leaf-like'
                });
                console.log(chalk.green(`Runtime visualizer written: ${paths.runtimeVisualizerFile}`));
            }
        });

    program
        .command('coverage')
        .description('Measure triad/runtime/combined topology coverage by category root')
        .option('--json', 'Emit machine-readable coverage JSON report')
        .action((options: { json?: boolean }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);
            const report = runCoverage(paths);

            if (options.json) {
                console.log(JSON.stringify(report, null, 2));
            } else {
                console.log(formatCoverageReport(report));
                console.log(chalk.gray(`[TriadMind] coverage report written: ${paths.coverageReportFile}`));
            }
        });

    program
        .command('verify')
        .description(
            'Verify topology quality gates (diagnostics, execute-like ratio, ghost ratio, runtime rendering consistency)'
        )
        .option('--json', 'Emit machine-readable JSON report')
        .option('--strict', 'Exit with code 1 when any configured check fails')
        .option('--focus <full|impact>', 'Verification scope (default: full)')
        .option('--full', 'Force full-project verification scope')
        .option(
            '--baseline <path>',
            'Baseline file for runtime unmatched route threshold (default: .triadmind/verify-baseline.json)'
        )
        .option('--update-baseline', 'Write current runtime_unmatched_route_count into baseline file')
        .option('--max-execute-like-ratio <n>', 'Threshold for execute-like capability ratio (default: 0.10)')
        .option('--max-ghost-ratio <n>', 'Threshold for ghost demand node ratio (default: 0.40)')
        .option('--max-unmatched-routes <n>', 'Threshold for runtime unmatched frontend routes (default: baseline + 10%)')
        .option('--max-render-edges <n>', 'Optional edge cap used only for rendered edge consistency check')
        .option('--fail-on-new-regressions', 'With baseline, only fail strict verify when a checked metric regresses')
        .action(
            (options: {
                json?: boolean;
                strict?: boolean;
                focus?: string;
                full?: boolean;
                baseline?: string;
                updateBaseline?: boolean;
                maxExecuteLikeRatio?: string;
                maxGhostRatio?: string;
                maxUnmatchedRoutes?: string;
                maxRenderEdges?: string;
                failOnNewRegressions?: boolean;
            }) => {
                const paths = getWorkspacePaths(process.cwd());
                ensureTriadSpec(paths);
                const report = runTopologyVerify(paths, {
                    strict: Boolean(options.strict),
                    focus: options.full ? 'full' : options.focus === 'impact' ? 'impact' : 'full',
                    baselinePath: options.baseline,
                    updateBaseline: Boolean(options.updateBaseline),
                    maxExecuteLikeRatio: parseOptionalRatioCliNumber(options.maxExecuteLikeRatio),
                    maxGhostRatio: parseOptionalRatioCliNumber(options.maxGhostRatio),
                    maxUnmatchedRouteCount: parseOptionalNonNegativeCliInteger(options.maxUnmatchedRoutes),
                    maxRenderEdges: parseOptionalPositiveCliInteger(options.maxRenderEdges),
                    failOnNewRegressions: Boolean(options.failOnNewRegressions)
                });

                if (options.json) {
                    console.log(JSON.stringify(report, null, 2));
                } else {
                    console.log(formatVerifyReport(report));
                    if (report.baseline) {
                        console.log(chalk.gray(`[TriadMind] verify baseline: ${report.baseline.path}`));
                    }
                }
                runAutoDreamAfterCommand(paths, 'verify');

                if (options.strict && !report.passed) {
                    process.exitCode = 1;
                }
            }
        );

    const governCommand = program
        .command('govern')
        .description('Hard-gate governance workflow (fail-closed checks, CI gates, fix planning)');

    governCommand
        .command('check')
        .description('Run hard governance checks using policy rules and emit govern artifacts')
        .option('--policy <path>', 'Govern policy file path (default: .triadmind/govern-policy.json)')
        .option('--json', 'Emit machine-readable govern report JSON')
        .option('--scope <full|impact>', 'Governance scope for verify-backed metrics')
        .action((options: { policy?: string; json?: boolean; scope?: string }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);
            const result = runGovern(paths, {
                mode: 'check',
                policyPath: options.policy,
                scope: options.scope === 'impact' ? 'impact' : undefined
            });

            if (options.json) {
                console.log(JSON.stringify(result.report, null, 2));
            } else {
                console.log(formatGovernReport(result.report));
            }
            runAutoDreamAfterCommand(paths, 'govern');

            if (result.exitCode !== 0) {
                process.exitCode = result.exitCode;
            }
        });

    governCommand
        .command('ci')
        .description('CI fail-fast gate: run hard governance checks without interactive flow')
        .option('--policy <path>', 'Govern policy file path (default: .triadmind/govern-policy.json)')
        .option('--json', 'Emit machine-readable govern report JSON')
        .option('--scope <full|impact>', 'Governance scope for verify-backed metrics')
        .action((options: { policy?: string; json?: boolean; scope?: string }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);
            const result = runGovern(paths, {
                mode: 'ci',
                policyPath: options.policy,
                scope: options.scope === 'impact' ? 'impact' : undefined
            });

            if (options.json) {
                console.log(JSON.stringify(result.report, null, 2));
            } else {
                console.log(formatGovernReport(result.report));
            }
            runAutoDreamAfterCommand(paths, 'govern');

            if (result.exitCode !== 0) {
                process.exitCode = result.exitCode;
            }
        });

    governCommand
        .command('fix')
        .description('Generate govern fix patch plan under hard policy constraints')
        .option('--policy <path>', 'Govern policy file path (default: .triadmind/govern-policy.json)')
        .option('--llm <provider:model>', 'LLM backend descriptor for fix planning')
        .option('--max-iterations <n>', 'Max fix iterations for future auto-fix backends', '3')
        .option('--dry-run', 'Only emit govern-fixes.patch without applying any fix')
        .option('--json', 'Emit machine-readable govern report JSON')
        .action(
            (options: { policy?: string; llm?: string; maxIterations?: string; dryRun?: boolean; json?: boolean }) => {
                const paths = getWorkspacePaths(process.cwd());
                ensureTriadSpec(paths);
                const result = runGovern(paths, {
                    mode: 'fix',
                    policyPath: options.policy,
                    llm: options.llm,
                    maxIterations: normalizePositiveCliInteger(options.maxIterations, 3),
                    dryRun: Boolean(options.dryRun)
                });

                if (options.json) {
                    console.log(JSON.stringify(result.report, null, 2));
                } else {
                    console.log(formatGovernReport(result.report));
                }
                runAutoDreamAfterCommand(paths, 'govern');

                if (result.exitCode !== 0) {
                    process.exitCode = result.exitCode;
                }
            }
        );

    program
        .command('trend')
        .description('Generate architecture drift trend artifacts (trend.json + trend-report.md)')
        .option('--window <n>', 'Maximum snapshots kept in trend history', '26')
        .option('--max-edge-diff <n>', 'Max added/removed edge rows kept in report', '50')
        .option('--json', 'Emit machine-readable trend report JSON')
        .action((options: { window?: string; maxEdgeDiff?: string; json?: boolean }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);
            const result = generateTrendArtifacts(paths, {
                historyWindow: normalizePositiveCliInteger(options.window, 26),
                maxEdgeDiff: normalizePositiveCliInteger(options.maxEdgeDiff, 50)
            });
            runAutoDreamAfterCommand(paths, 'trend');

            if (options.json) {
                console.log(
                    JSON.stringify(
                        {
                            trendFile: paths.trendFile,
                            trendReportFile: paths.trendReportFile,
                            report: result.report
                        },
                        null,
                        2
                    )
                );
                return;
            }

            console.log(chalk.green(`Trend history written: ${paths.trendFile}`));
            console.log(chalk.green(`Trend report written: ${paths.trendReportFile}`));
            result.report.summary.forEach((entry) => console.log(chalk.gray(`   - ${entry}`)));
        });
}

function registerTopologyUtilityCommands(program: Command) {
    program
        .command('view-map')
        .description('Generate cross-view mapping artifacts (runtime -> capability -> leaf)')
        .option('--max-candidates <n>', 'Max capability candidates retained per runtime node', '3')
        .option('--json', 'Emit machine-readable view-map JSON payload')
        .action((options: { maxCandidates?: string; json?: boolean }) => {
            const paths = getWorkspacePaths(process.cwd());
            ensureTriadSpec(paths);
            const viewMap = writeViewMapArtifacts(paths, {
                maxCandidatesPerRuntimeNode: normalizePositiveCliInteger(options.maxCandidates, 3)
            });
            reportViewMapStatus(paths, {
                recovered: false,
                viewMap
            });
            if (options.json) {
                console.log(JSON.stringify(viewMap, null, 2));
            }
        });

    program
        .command('renormalize')
        .description('Detect cyclic dependencies and emit a language-agnostic renormalization protocol')
        .option('--deep', 'Reserve recursive fanout convergence and emit a TODO governance task')
        .action((options: { deep?: boolean }) => {
            if (options.deep) {
                executeConvergePlaceholder(getWorkspacePaths(process.cwd()));
                return;
            }

            const paths = getWorkspacePaths(process.cwd());
            const config = loadTriadConfig(paths);
            const renormalizeProtocolFile = path.join(paths.triadDir, 'renormalize-protocol.json');
            const analyzerOptions = resolveAnalyzerOptionsFromConfig(config);

            ensureTriadSpec(paths);
            if (!fs.existsSync(paths.mapFile)) {
                syncProjectTopology(paths, true);
            }

            const map = readCurrentTriadMap(paths);
            const cycles = detectCycles(map, analyzerOptions);

            if (cycles.length === 0) {
                console.log(chalk.green('No cyclic dependencies found; renormalization is not required.'));
                if (fs.existsSync(renormalizeProtocolFile)) {
                    fs.unlinkSync(renormalizeProtocolFile);
                }
                return;
            }

            const protocol = generateRenormalizeProtocol(map, cycles, analyzerOptions);
            fs.writeFileSync(renormalizeProtocolFile, JSON.stringify(protocol, null, 2), 'utf-8');

            console.log(chalk.yellow(`Detected ${cycles.length} cyclic component(s).`));
            cycles.forEach((cycle, index) => {
                console.log(chalk.yellow(`   ${index + 1}. ${cycle.join(' -> ')}`));
            });
            console.log(chalk.green(`Renormalization protocol written: ${renormalizeProtocolFile}`));
        });

    program
        .command('converge')
        .description('Reserve iterative recursive renormalization for high-fanout nodes and emit a TODO governance task')
        .action(async () => {
            executeConvergePlaceholder(getWorkspacePaths(process.cwd()));
        });
}
