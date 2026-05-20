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
exports.refreshRuntimeAndViewArtifacts = refreshRuntimeAndViewArtifacts;
exports.reportRuntimeArtifactStatus = reportRuntimeArtifactStatus;
exports.reportViewMapStatus = reportViewMapStatus;
exports.runAutoDreamAfterCommand = runAutoDreamAfterCommand;
exports.executeDreamRun = executeDreamRun;
exports.executeConvergePlaceholder = executeConvergePlaceholder;
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const analyzer_1 = require("./analyzer");
const analyzerOptionsSupport_1 = require("./analyzerOptionsSupport");
const config_1 = require("./config");
const dream_1 = require("./dream");
const dreamScheduler_1 = require("./dreamScheduler");
const dreamVisualizer_1 = require("./dreamVisualizer");
const stableArchitectureAnchorSupport_1 = require("./stableArchitectureAnchorSupport");
const topologyRiskSupport_1 = require("./topologyRiskSupport");
const extractRuntimeTopology_1 = require("./runtime/extractRuntimeTopology");
const runtimeMapWriter_1 = require("./runtime/runtimeMapWriter");
const cliSupport_1 = require("./cliSupport");
const cliPresentationSupport_1 = require("./cliPresentationSupport");
const viewMap_1 = require("./viewMap");
const workflow_1 = require("./workflow");
class DerivedArtifactWorkflow {
    async refreshRuntimeAndViewArtifacts(paths, runtimeOptions = {}, viewMapOptions = {}, bestEffort = true) {
        const runtimeResult = await this.writeRuntimeTopologyArtifacts(paths, runtimeOptions, bestEffort);
        const viewMapResult = this.writeViewMapArtifactsBestEffort(paths, viewMapOptions);
        return {
            runtimeResult,
            viewMapResult
        };
    }
    reportRuntimeArtifactStatus(paths, result) {
        const diagnostics = result.runtimeMap.diagnostics ?? [];
        const permissionSkips = diagnostics.filter((diagnostic) => diagnostic.code === 'RUNTIME_PERMISSION_SKIPPED').length;
        const extractorErrors = diagnostics.filter((diagnostic) => diagnostic.code === 'RUNTIME_EXTRACTOR_FAILED').length;
        if (permissionSkips > 0) {
            console.log(chalk_1.default.yellow(`[TriadMind] runtime extraction skipped ${permissionSkips} paths due to permission restrictions`));
        }
        if (extractorErrors > 0) {
            console.log(chalk_1.default.yellow(`[TriadMind] runtime extraction recorded ${extractorErrors} extractor error diagnostics`));
        }
        if (result.recovered) {
            console.log(chalk_1.default.yellow('[TriadMind] runtime extraction degraded to diagnostics-only mode'));
        }
        console.log(chalk_1.default.green(`[TriadMind] Runtime map written: ${paths.runtimeMapFile}`));
        console.log(chalk_1.default.green(`[TriadMind] Runtime diagnostics written: ${paths.runtimeDiagnosticsFile}`));
    }
    reportViewMapStatus(paths, result) {
        const diagnostics = result.viewMap.diagnostics ?? [];
        const missingFileWarnings = diagnostics.filter((item) => item.code === 'VIEW_MAP_MISSING_RUNTIME_MAP' ||
            item.code === 'VIEW_MAP_MISSING_LEAF_MAP' ||
            item.code === 'VIEW_MAP_MISSING_TRIAD_MAP').length;
        if (missingFileWarnings > 0) {
            console.log(chalk_1.default.yellow(`[TriadMind] view-map generation detected ${missingFileWarnings} missing prerequisite file warning(s)`));
        }
        if (result.recovered) {
            console.log(chalk_1.default.yellow('[TriadMind] view-map generation degraded to diagnostics-only mode'));
        }
        console.log(chalk_1.default.green(`[TriadMind] View map written: ${paths.viewMapFile} (links=${result.viewMap.stats?.linkCount ?? 0}, runtime=${(result.viewMap.stats?.runtimeMatchRate ?? 0).toFixed(3)}, capabilityLeaf=${(result.viewMap.stats?.capabilityLeafMatchRate ?? 0).toFixed(3)}, e2e=${(result.viewMap.stats?.endToEndTraceabilityRate ?? 0).toFixed(3)})`));
        console.log(chalk_1.default.green(`[TriadMind] View map diagnostics written: ${paths.viewMapDiagnosticsFile}`));
    }
    async writeRuntimeTopologyArtifacts(paths, options, bestEffort) {
        try {
            const runtimeMap = await (0, extractRuntimeTopology_1.extractRuntimeTopology)(paths.projectRoot, options);
            (0, runtimeMapWriter_1.writeRuntimeMapArtifacts)(runtimeMap, paths.runtimeMapFile, paths.runtimeDiagnosticsFile);
            return { runtimeMap, recovered: false };
        }
        catch (error) {
            if (!bestEffort) {
                throw error;
            }
            const runtimeMap = this.createFallbackRuntimeMap(paths, options, error);
            (0, runtimeMapWriter_1.writeRuntimeMapArtifacts)(runtimeMap, paths.runtimeMapFile, paths.runtimeDiagnosticsFile);
            return { runtimeMap, recovered: true };
        }
    }
    writeViewMapArtifactsBestEffort(paths, options) {
        try {
            const viewMap = (0, viewMap_1.writeViewMapArtifacts)(paths, options);
            return { viewMap, recovered: false };
        }
        catch (error) {
            const viewMap = this.createFallbackViewMap(paths, error);
            fs.mkdirSync(path.dirname(paths.viewMapFile), { recursive: true });
            fs.writeFileSync(paths.viewMapFile, JSON.stringify(viewMap, null, 2), 'utf-8');
            fs.writeFileSync(paths.viewMapDiagnosticsFile, JSON.stringify(viewMap.diagnostics, null, 2), 'utf-8');
            return { viewMap, recovered: true };
        }
    }
    createFallbackRuntimeMap(paths, options, error) {
        return {
            schemaVersion: '1.0',
            project: path.basename(paths.projectRoot),
            generatedAt: new Date().toISOString(),
            view: options.view,
            nodes: [],
            edges: [],
            diagnostics: [
                {
                    level: 'error',
                    code: 'RUNTIME_BEST_EFFORT_FAILURE',
                    extractor: 'RuntimeOrchestrator',
                    message: error instanceof Error ? error.message : String(error)
                }
            ]
        };
    }
    createFallbackViewMap(paths, error) {
        return {
            schemaVersion: '1.0',
            project: path.basename(paths.projectRoot),
            generatedAt: new Date().toISOString(),
            stats: {
                runtimeNodes: 0,
                capabilityNodes: 0,
                leafNodes: 0,
                linkCount: 0,
                runtimeMatchedNodes: 0,
                runtimeUnmatchedNodes: 0,
                runtimeMatchRate: 0,
                capabilityMatchedNodes: 0,
                capabilityUnmatchedNodes: 0,
                capabilityLeafMatchRate: 0,
                leafMatchedNodes: 0,
                leafUnmatchedNodes: 0,
                leafCapabilityMatchRate: 0,
                runtimeToCapabilityLinkCount: 0,
                capabilityToLeafLinkCount: 0,
                runtimeToLeafLinkCount: 0,
                endToEndTraceableRuntimeNodes: 0,
                endToEndTraceabilityRate: 0
            },
            links: [],
            diagnostics: [
                {
                    level: 'error',
                    code: 'VIEW_MAP_BEST_EFFORT_FAILURE',
                    message: error instanceof Error ? error.message : String(error)
                }
            ]
        };
    }
}
class ConvergePlaceholderPlanner {
    threshold;
    constructor(threshold = 3) {
        this.threshold = threshold;
    }
    execute(paths) {
        (0, workflow_1.ensureTriadSpec)(paths);
        if (!fs.existsSync(paths.mapFile)) {
            (0, cliSupport_1.syncProjectTopology)(paths, true);
        }
        const config = (0, config_1.loadTriadConfig)(paths);
        const map = (0, cliSupport_1.readCurrentTriadMap)(paths);
        const stableAnchorResolution = (0, stableArchitectureAnchorSupport_1.resolveEffectiveStableAnchors)(paths, config.topologyRisk);
        const overloadedNodes = this.detectHighFanoutNodes(map, (0, analyzerOptionsSupport_1.resolveAnalyzerOptionsFromConfig)(config, stableAnchorResolution.stableAnchors));
        fs.writeFileSync(paths.convergeTaskFile, this.buildConvergeTask(paths, overloadedNodes), 'utf-8');
        console.log(chalk_1.default.yellow('[TriadMind] recursive renormalization remains a reserved TODO capability.'));
        console.log(chalk_1.default.green(`[TriadMind] convergence task written: ${paths.convergeTaskFile}`));
        if (overloadedNodes.length > 0) {
            console.log(chalk_1.default.yellow(`[TriadMind] detected ${overloadedNodes.length} high-fanout node(s) worth convergence review.`));
        }
        else {
            console.log(chalk_1.default.green('[TriadMind] no node currently crosses the default high-fanout threshold (>= 3 downstreams).'));
        }
    }
    detectHighFanoutNodes(map, options) {
        const nodes = Array.isArray(map) ? map : [];
        const nodeById = new Map(nodes
            .map((node) => [String(node?.nodeId ?? '').trim(), node])
            .filter(([nodeId]) => Boolean(nodeId)));
        return (0, analyzer_1.calculateDownstreamFanoutNodes)(nodes, this.threshold, options).filter((entry) => {
            const node = nodeById.get(entry.nodeId);
            return node ? !(0, topologyRiskSupport_1.isMatureStableArchitectureNode)(node, options) : true;
        });
    }
    buildConvergeTask(paths, overloadedNodes) {
        const overloadSection = overloadedNodes.length > 0
            ? overloadedNodes
                .map((entry, index) => `${index + 1}. ${entry.nodeId} -> ${entry.downstreamCount} downstream(s)\n   - ${entry.downstreamNodeIds.join('\n   - ')}`)
                .join('\n')
            : 'None. No current node exceeds the default threshold of 3 downstream nodes.';
        return [
            '# Recursive Renormalization TODO',
            '',
            'Status: reserved capability only. This workflow is not implemented yet.',
            '',
            '## Why this file exists',
            '',
            'TriadMind currently supports cycle-based renormalization, but it does not yet support iterative branch repartition for single nodes with high downstream fanout.',
            '',
            '## Reserved trigger',
            '',
            '- `@triadmind renormalize --deep`',
            '- `@triadmind converge`',
            '',
            '## Intended future behavior',
            '',
            '- Detect nodes whose downstream fanout is greater than or equal to 3',
            '- Renormalize from outermost layer to innermost layer',
            '- Recompute `blast radius / cycles / drift` after every round',
            '- Stop only when topology stabilizes into explicit left/right branch structure',
            '',
            '## Current workspace snapshot',
            '',
            `- Project root: ${paths.projectRoot.replace(/\\/g, '/')}`,
            `- Triad map: ${paths.mapFile.replace(/\\/g, '/')}`,
            `- Threshold: ${this.threshold} downstream nodes`,
            '',
            '## Current high-fanout candidates',
            '',
            overloadSection,
            '',
            '## Suggested governance loop',
            '',
            '1. Select only the current outermost overloaded nodes',
            '2. Emit branch repartition protocol for that layer',
            '3. Refresh triad-map after the patch',
            '4. Recalculate drift and blast radius',
            '5. Repeat until no overloaded layer remains'
        ].join('\n');
    }
}
const derivedArtifactWorkflow = new DerivedArtifactWorkflow();
const convergePlaceholderPlanner = new ConvergePlaceholderPlanner();
async function refreshRuntimeAndViewArtifacts(paths, runtimeOptions = {}, viewMapOptions = {}, bestEffort = true) {
    return derivedArtifactWorkflow.refreshRuntimeAndViewArtifacts(paths, runtimeOptions, viewMapOptions, bestEffort);
}
function reportRuntimeArtifactStatus(paths, result) {
    derivedArtifactWorkflow.reportRuntimeArtifactStatus(paths, result);
}
function reportViewMapStatus(paths, result) {
    derivedArtifactWorkflow.reportViewMapStatus(paths, result);
}
function runAutoDreamAfterCommand(paths, trigger) {
    void (0, dreamScheduler_1.tickDreamAutoRun)(paths, { trigger })
        .then((result) => {
        if (result.status === 'run') {
            console.log(chalk_1.default.gray(`[TriadMind] dream auto run complete: trigger=${trigger}, pending=${result.pendingEvents}, lock=${result.lock}`));
            return;
        }
        if (result.status === 'error') {
            console.log(chalk_1.default.yellow(`[TriadMind] dream auto run failed: trigger=${trigger}, reason=${result.reason}, error=${result.error ?? 'unknown'}`));
        }
    })
        .catch((error) => {
        console.log(chalk_1.default.yellow(`[TriadMind] dream auto trigger crashed: trigger=${trigger}, error=${error?.message ? String(error.message) : String(error)}`));
    });
}
async function executeDreamRun(options) {
    const paths = (0, workflow_1.getWorkspacePaths)(process.cwd());
    (0, workflow_1.ensureTriadSpec)(paths);
    const result = await (0, dream_1.runDreamAnalysis)(paths, {
        mode: options.mode === 'idle' ? 'idle' : 'manual',
        force: Boolean(options.force),
        maxProposals: (0, cliPresentationSupport_1.parseOptionalPositiveCliInteger)(options.maxProposals),
        minConfidence: (0, cliPresentationSupport_1.parseOptionalRatioCliNumber)(options.minConfidence),
        impactThreshold: (0, cliPresentationSupport_1.parseOptionalPositiveCliInteger)(options.impactThreshold)
    });
    if (options.visualize) {
        (0, dreamVisualizer_1.generateDreamDashboard)(result.report, paths.dreamVisualizerFile, {
            theme: options.theme === 'runtime-dark' ? 'runtime-dark' : 'leaf-like'
        });
    }
    if (options.json) {
        console.log(JSON.stringify(result.report, null, 2));
        return;
    }
    console.log((0, dream_1.formatDreamReport)(result.report));
    console.log(chalk_1.default.green(`[TriadMind] Dream report written: ${result.artifacts.reportFile}`));
    console.log(chalk_1.default.green(`[TriadMind] Dream diagnostics written: ${result.artifacts.diagnosticsFile}`));
    console.log(chalk_1.default.green(`[TriadMind] Dream proposals written: ${result.artifacts.proposalsFile}`));
    if (options.visualize) {
        console.log(chalk_1.default.green(`[TriadMind] Dream visualizer written: ${paths.dreamVisualizerFile}`));
    }
}
function executeConvergePlaceholder(paths) {
    convergePlaceholderPlanner.execute(paths);
}
//# sourceMappingURL=cliWorkflowSupport.js.map