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
exports.registerRuntimeGovernanceCommands = registerRuntimeGovernanceCommands;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const analyzer_1 = require("./analyzer");
const analyzerOptionsSupport_1 = require("./analyzerOptionsSupport");
const cliSupport_1 = require("./cliSupport");
const cliPresentationSupport_1 = require("./cliPresentationSupport");
const cliWorkflowSupport_1 = require("./cliWorkflowSupport");
const config_1 = require("./config");
const coverage_1 = require("./coverage");
const govern_1 = require("./govern");
const filterRuntimeMapByView_1 = require("./runtime/filterRuntimeMapByView");
const runtimeVisualizer_1 = require("./runtime/runtimeVisualizer");
const sync_1 = require("./sync");
const trend_1 = require("./trend");
const triadization_1 = require("./triadization");
const verify_1 = require("./verify");
const viewMap_1 = require("./viewMap");
const workflow_1 = require("./workflow");
function registerRuntimeGovernanceCommands(program) {
    registerSyncCommands(program);
    registerRuntimeAndGovernanceCommands(program);
    registerTopologyUtilityCommands(program);
}
function registerSyncCommands(program) {
    program
        .command('sync')
        .description('Incrementally synchronize triad-map using cached file hashes')
        .option('--force', 'Force a full triad-map rebuild')
        .option('--scan-mode <leaf|capability|module|domain>', 'Temporarily override parser scan mode for this sync')
        .action(async (options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        (0, cliSupport_1.syncProjectTopology)(paths, Boolean(options.force), (0, cliPresentationSupport_1.normalizeScanModeOption)(options.scanMode));
        (0, triadization_1.writeTriadizationArtifacts)(paths);
        const { runtimeResult, viewMapResult } = await (0, cliWorkflowSupport_1.refreshRuntimeAndViewArtifacts)(paths);
        (0, cliWorkflowSupport_1.reportRuntimeArtifactStatus)(paths, runtimeResult);
        (0, cliWorkflowSupport_1.reportViewMapStatus)(paths, viewMapResult);
        (0, cliWorkflowSupport_1.runAutoDreamAfterCommand)(paths, 'sync');
    });
    program
        .command('watch')
        .description('Watch source files and keep triad-map synchronized')
        .action(async () => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        (0, sync_1.watchTriadMap)(paths);
    });
}
function registerRuntimeAndGovernanceCommands(program) {
    program
        .command('check')
        .description('Shortcut: sync --force -> verify --strict --json')
        .option('--focus <full|impact>', 'Verification scope (default: full)')
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        (0, cliSupport_1.syncProjectTopology)(paths, true);
        (0, triadization_1.writeTriadizationArtifacts)(paths);
        const report = (0, verify_1.runTopologyVerify)(paths, {
            strict: true,
            focus: options.focus === 'impact' ? 'impact' : 'full'
        });
        console.log(JSON.stringify(report, null, 2));
        (0, cliWorkflowSupport_1.runAutoDreamAfterCommand)(paths, 'check');
        if (!report.passed) {
            process.exitCode = 1;
        }
    });
    program
        .command('ci')
        .description('Shortcut: sync --force -> runtime full -> verify --strict --json -> govern ci')
        .option('--scope <full|impact>', 'Governance and verify scope (default: config/full)')
        .action(async (options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const scope = options.scope === 'impact' ? 'impact' : undefined;
        (0, cliSupport_1.syncProjectTopology)(paths, true);
        (0, triadization_1.writeTriadizationArtifacts)(paths);
        const { runtimeResult, viewMapResult } = await (0, cliWorkflowSupport_1.refreshRuntimeAndViewArtifacts)(paths, {
            view: 'full'
        });
        (0, cliWorkflowSupport_1.reportRuntimeArtifactStatus)(paths, runtimeResult);
        (0, cliWorkflowSupport_1.reportViewMapStatus)(paths, viewMapResult);
        const verifyReport = (0, verify_1.runTopologyVerify)(paths, {
            strict: true,
            focus: scope ?? 'full'
        });
        console.log(JSON.stringify(verifyReport, null, 2));
        const governResult = (0, govern_1.runGovern)(paths, {
            mode: 'ci',
            scope
        });
        console.log((0, govern_1.formatGovernReport)(governResult.report));
        (0, cliWorkflowSupport_1.runAutoDreamAfterCommand)(paths, 'ci');
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
        .action(async (options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const config = (0, config_1.loadTriadConfig)(paths);
        if (!config.runtime.enabled) {
            console.log(chalk_1.default.red('Runtime topology extraction is disabled in `.triadmind/config.json`.'));
            process.exitCode = 1;
            return;
        }
        const { runtimeResult, viewMapResult } = await (0, cliWorkflowSupport_1.refreshRuntimeAndViewArtifacts)(paths, {
            view: (0, filterRuntimeMapByView_1.normalizeRuntimeView)(options.view, config.runtime.defaultView),
            includeFrontend: options.includeFrontend ?? config.runtime.includeFrontend,
            includeInfra: options.includeInfra ?? config.runtime.includeInfra,
            frameworkHint: options.framework
        });
        (0, cliWorkflowSupport_1.reportRuntimeArtifactStatus)(paths, runtimeResult);
        (0, cliWorkflowSupport_1.reportViewMapStatus)(paths, viewMapResult);
        (0, cliWorkflowSupport_1.runAutoDreamAfterCommand)(paths, 'runtime');
        if (options.visualize) {
            (0, runtimeVisualizer_1.generateRuntimeDashboard)(paths.runtimeMapFile, paths.runtimeVisualizerFile, {
                interactive: options.interactive !== false,
                layout: options.layout === 'dagre' ? 'dagre' : 'leaf-force',
                traceDepth: (0, cliPresentationSupport_1.normalizePositiveCliInteger)(options.traceDepth, 2),
                maxRenderEdges: (0, cliPresentationSupport_1.parseOptionalPositiveCliInteger)(options.maxRenderEdges),
                hideIsolated: Boolean(options.hideIsolated),
                theme: options.theme === 'runtime-dark' ? 'runtime-dark' : 'leaf-like'
            });
            console.log(chalk_1.default.green(`Runtime visualizer written: ${paths.runtimeVisualizerFile}`));
        }
    });
    program
        .command('coverage')
        .description('Measure triad/runtime/combined topology coverage by category root')
        .option('--json', 'Emit machine-readable coverage JSON report')
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const report = (0, coverage_1.runCoverage)(paths);
        if (options.json) {
            console.log(JSON.stringify(report, null, 2));
        }
        else {
            console.log((0, coverage_1.formatCoverageReport)(report));
            console.log(chalk_1.default.gray(`[TriadMind] coverage report written: ${paths.coverageReportFile}`));
        }
    });
    program
        .command('verify')
        .description('Verify topology quality gates (diagnostics, execute-like ratio, ghost ratio, runtime rendering consistency)')
        .option('--json', 'Emit machine-readable JSON report')
        .option('--strict', 'Exit with code 1 when any configured check fails')
        .option('--focus <full|impact>', 'Verification scope (default: full)')
        .option('--full', 'Force full-project verification scope')
        .option('--baseline <path>', 'Baseline file for runtime unmatched route threshold (default: .triadmind/verify-baseline.json)')
        .option('--update-baseline', 'Write current runtime_unmatched_route_count into baseline file')
        .option('--max-execute-like-ratio <n>', 'Threshold for execute-like capability ratio (default: 0.10)')
        .option('--max-ghost-ratio <n>', 'Threshold for ghost demand node ratio (default: 0.40)')
        .option('--max-unmatched-routes <n>', 'Threshold for runtime unmatched frontend routes (default: baseline + 10%)')
        .option('--max-render-edges <n>', 'Optional edge cap used only for rendered edge consistency check')
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const report = (0, verify_1.runTopologyVerify)(paths, {
            strict: Boolean(options.strict),
            focus: options.full ? 'full' : options.focus === 'impact' ? 'impact' : 'full',
            baselinePath: options.baseline,
            updateBaseline: Boolean(options.updateBaseline),
            maxExecuteLikeRatio: (0, cliPresentationSupport_1.parseOptionalRatioCliNumber)(options.maxExecuteLikeRatio),
            maxGhostRatio: (0, cliPresentationSupport_1.parseOptionalRatioCliNumber)(options.maxGhostRatio),
            maxUnmatchedRouteCount: (0, cliPresentationSupport_1.parseOptionalNonNegativeCliInteger)(options.maxUnmatchedRoutes),
            maxRenderEdges: (0, cliPresentationSupport_1.parseOptionalPositiveCliInteger)(options.maxRenderEdges)
        });
        if (options.json) {
            console.log(JSON.stringify(report, null, 2));
        }
        else {
            console.log((0, verify_1.formatVerifyReport)(report));
            if (report.baseline) {
                console.log(chalk_1.default.gray(`[TriadMind] verify baseline: ${report.baseline.path}`));
            }
        }
        (0, cliWorkflowSupport_1.runAutoDreamAfterCommand)(paths, 'verify');
        if (options.strict && !report.passed) {
            process.exitCode = 1;
        }
    });
    const governCommand = program
        .command('govern')
        .description('Hard-gate governance workflow (fail-closed checks, CI gates, fix planning)');
    governCommand
        .command('check')
        .description('Run hard governance checks using policy rules and emit govern artifacts')
        .option('--policy <path>', 'Govern policy file path (default: .triadmind/govern-policy.json)')
        .option('--json', 'Emit machine-readable govern report JSON')
        .option('--scope <full|impact>', 'Governance scope for verify-backed metrics')
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const result = (0, govern_1.runGovern)(paths, {
            mode: 'check',
            policyPath: options.policy,
            scope: options.scope === 'impact' ? 'impact' : undefined
        });
        if (options.json) {
            console.log(JSON.stringify(result.report, null, 2));
        }
        else {
            console.log((0, govern_1.formatGovernReport)(result.report));
        }
        (0, cliWorkflowSupport_1.runAutoDreamAfterCommand)(paths, 'govern');
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
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const result = (0, govern_1.runGovern)(paths, {
            mode: 'ci',
            policyPath: options.policy,
            scope: options.scope === 'impact' ? 'impact' : undefined
        });
        if (options.json) {
            console.log(JSON.stringify(result.report, null, 2));
        }
        else {
            console.log((0, govern_1.formatGovernReport)(result.report));
        }
        (0, cliWorkflowSupport_1.runAutoDreamAfterCommand)(paths, 'govern');
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
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const result = (0, govern_1.runGovern)(paths, {
            mode: 'fix',
            policyPath: options.policy,
            llm: options.llm,
            maxIterations: (0, cliPresentationSupport_1.normalizePositiveCliInteger)(options.maxIterations, 3),
            dryRun: Boolean(options.dryRun)
        });
        if (options.json) {
            console.log(JSON.stringify(result.report, null, 2));
        }
        else {
            console.log((0, govern_1.formatGovernReport)(result.report));
        }
        (0, cliWorkflowSupport_1.runAutoDreamAfterCommand)(paths, 'govern');
        if (result.exitCode !== 0) {
            process.exitCode = result.exitCode;
        }
    });
    program
        .command('trend')
        .description('Generate architecture drift trend artifacts (trend.json + trend-report.md)')
        .option('--window <n>', 'Maximum snapshots kept in trend history', '26')
        .option('--max-edge-diff <n>', 'Max added/removed edge rows kept in report', '50')
        .option('--json', 'Emit machine-readable trend report JSON')
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const result = (0, trend_1.generateTrendArtifacts)(paths, {
            historyWindow: (0, cliPresentationSupport_1.normalizePositiveCliInteger)(options.window, 26),
            maxEdgeDiff: (0, cliPresentationSupport_1.normalizePositiveCliInteger)(options.maxEdgeDiff, 50)
        });
        (0, cliWorkflowSupport_1.runAutoDreamAfterCommand)(paths, 'trend');
        if (options.json) {
            console.log(JSON.stringify({
                trendFile: paths.trendFile,
                trendReportFile: paths.trendReportFile,
                report: result.report
            }, null, 2));
            return;
        }
        console.log(chalk_1.default.green(`Trend history written: ${paths.trendFile}`));
        console.log(chalk_1.default.green(`Trend report written: ${paths.trendReportFile}`));
        result.report.summary.forEach((entry) => console.log(chalk_1.default.gray(`   - ${entry}`)));
    });
}
function registerTopologyUtilityCommands(program) {
    program
        .command('view-map')
        .description('Generate cross-view mapping artifacts (runtime -> capability -> leaf)')
        .option('--max-candidates <n>', 'Max capability candidates retained per runtime node', '3')
        .option('--json', 'Emit machine-readable view-map JSON payload')
        .action((options) => {
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        (0, workflow_1.ensureTriadSpec)(paths);
        const viewMap = (0, viewMap_1.writeViewMapArtifacts)(paths, {
            maxCandidatesPerRuntimeNode: (0, cliPresentationSupport_1.normalizePositiveCliInteger)(options.maxCandidates, 3)
        });
        (0, cliWorkflowSupport_1.reportViewMapStatus)(paths, {
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
        .action((options) => {
        if (options.deep) {
            (0, cliWorkflowSupport_1.executeConvergePlaceholder)((0, workflow_1.getWorkspacePaths)(process.cwd()));
            return;
        }
        const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
        const config = (0, config_1.loadTriadConfig)(paths);
        const renormalizeProtocolFile = path.join(paths.triadDir, 'renormalize-protocol.json');
        const analyzerOptions = (0, analyzerOptionsSupport_1.resolveAnalyzerOptionsFromConfig)(config);
        (0, workflow_1.ensureTriadSpec)(paths);
        if (!fs.existsSync(paths.mapFile)) {
            (0, cliSupport_1.syncProjectTopology)(paths, true);
        }
        const map = (0, cliSupport_1.readCurrentTriadMap)(paths);
        const cycles = (0, analyzer_1.detectCycles)(map, analyzerOptions);
        if (cycles.length === 0) {
            console.log(chalk_1.default.green('No cyclic dependencies found; renormalization is not required.'));
            if (fs.existsSync(renormalizeProtocolFile)) {
                fs.unlinkSync(renormalizeProtocolFile);
            }
            return;
        }
        const protocol = (0, analyzer_1.generateRenormalizeProtocol)(map, cycles, analyzerOptions);
        fs.writeFileSync(renormalizeProtocolFile, JSON.stringify(protocol, null, 2), 'utf-8');
        console.log(chalk_1.default.yellow(`Detected ${cycles.length} cyclic component(s).`));
        cycles.forEach((cycle, index) => {
            console.log(chalk_1.default.yellow(`   ${index + 1}. ${cycle.join(' -> ')}`));
        });
        console.log(chalk_1.default.green(`Renormalization protocol written: ${renormalizeProtocolFile}`));
    });
    program
        .command('converge')
        .description('Reserve iterative recursive renormalization for high-fanout nodes and emit a TODO governance task')
        .action(async () => {
        (0, cliWorkflowSupport_1.executeConvergePlaceholder)((0, workflow_1.getWorkspacePaths)(process.cwd()));
    });
}
//# sourceMappingURL=runtimeGovernanceCommands.js.map