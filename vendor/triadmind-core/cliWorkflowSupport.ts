import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { AnalyzerOptions, calculateDownstreamFanoutNodes, DownstreamFanoutNode } from './analyzer';
import { resolveAnalyzerOptionsFromConfig } from './analyzerOptionsSupport';
import { loadTriadConfig } from './config';
import { formatDreamReport, runDreamAnalysis } from './dream';
import { tickDreamAutoRun } from './dreamScheduler';
import { generateDreamDashboard } from './dreamVisualizer';
import { resolveEffectiveStableAnchors } from './stableArchitectureAnchorSupport';
import { isMatureStableArchitectureNode } from './topologyRiskSupport';
import { extractRuntimeTopology } from './runtime/extractRuntimeTopology';
import { normalizeRuntimeView } from './runtime/filterRuntimeMapByView';
import { RuntimeMap } from './runtime/types';
import { writeRuntimeMapArtifacts } from './runtime/runtimeMapWriter';
import { readCurrentTriadMap, syncProjectTopology } from './cliSupport';
import { parseOptionalPositiveCliInteger, parseOptionalRatioCliNumber } from './cliPresentationSupport';
import { writeViewMapArtifacts, ViewMap, ViewMapOptions } from './viewMap';
import { ensureTriadSpec, getWorkspacePaths } from './workflow';
import { WorkspacePaths } from './workspace';

export interface DreamRunCliOptions {
    mode?: string;
    force?: boolean;
    maxProposals?: string;
    minConfidence?: string;
    impactThreshold?: string;
    visualize?: boolean;
    theme?: string;
    json?: boolean;
}

export interface RuntimeTopologyArtifactOptions {
    view?: ReturnType<typeof normalizeRuntimeView>;
    includeFrontend?: boolean;
    includeInfra?: boolean;
    frameworkHint?: string;
}

export interface RuntimeArtifactResult {
    runtimeMap: RuntimeMap;
    recovered: boolean;
}

export interface ViewMapArtifactResult {
    viewMap: ViewMap;
    recovered: boolean;
}

export interface DerivedArtifactRefreshResult {
    runtimeResult: RuntimeArtifactResult;
    viewMapResult: ViewMapArtifactResult;
}

class DerivedArtifactWorkflow {
    async refreshRuntimeAndViewArtifacts(
        paths: WorkspacePaths,
        runtimeOptions: RuntimeTopologyArtifactOptions = {},
        viewMapOptions: ViewMapOptions = {},
        bestEffort = true
    ): Promise<DerivedArtifactRefreshResult> {
        const runtimeResult = await this.writeRuntimeTopologyArtifacts(paths, runtimeOptions, bestEffort);
        const viewMapResult = this.writeViewMapArtifactsBestEffort(paths, viewMapOptions);
        return {
            runtimeResult,
            viewMapResult
        };
    }

    reportRuntimeArtifactStatus(paths: WorkspacePaths, result: RuntimeArtifactResult) {
        const diagnostics = result.runtimeMap.diagnostics ?? [];
        const permissionSkips = diagnostics.filter((diagnostic) => diagnostic.code === 'RUNTIME_PERMISSION_SKIPPED').length;
        const extractorErrors = diagnostics.filter((diagnostic) => diagnostic.code === 'RUNTIME_EXTRACTOR_FAILED').length;

        if (permissionSkips > 0) {
            console.log(chalk.yellow(`[TriadMind] runtime extraction skipped ${permissionSkips} paths due to permission restrictions`));
        }
        if (extractorErrors > 0) {
            console.log(chalk.yellow(`[TriadMind] runtime extraction recorded ${extractorErrors} extractor error diagnostics`));
        }
        if (result.recovered) {
            console.log(chalk.yellow('[TriadMind] runtime extraction degraded to diagnostics-only mode'));
        }

        console.log(chalk.green(`[TriadMind] Runtime map written: ${paths.runtimeMapFile}`));
        console.log(chalk.green(`[TriadMind] Runtime diagnostics written: ${paths.runtimeDiagnosticsFile}`));
    }

    reportViewMapStatus(paths: WorkspacePaths, result: ViewMapArtifactResult) {
        const diagnostics = result.viewMap.diagnostics ?? [];
        const missingFileWarnings = diagnostics.filter(
            (item) =>
                item.code === 'VIEW_MAP_MISSING_RUNTIME_MAP' ||
                item.code === 'VIEW_MAP_MISSING_LEAF_MAP' ||
                item.code === 'VIEW_MAP_MISSING_TRIAD_MAP'
        ).length;

        if (missingFileWarnings > 0) {
            console.log(
                chalk.yellow(`[TriadMind] view-map generation detected ${missingFileWarnings} missing prerequisite file warning(s)`)
            );
        }
        if (result.recovered) {
            console.log(chalk.yellow('[TriadMind] view-map generation degraded to diagnostics-only mode'));
        }

        console.log(
            chalk.green(
                `[TriadMind] View map written: ${paths.viewMapFile} (links=${result.viewMap.stats?.linkCount ?? 0}, runtime=${(
                    result.viewMap.stats?.runtimeMatchRate ?? 0
                ).toFixed(3)}, capabilityLeaf=${(result.viewMap.stats?.capabilityLeafMatchRate ?? 0).toFixed(3)}, e2e=${(
                    result.viewMap.stats?.endToEndTraceabilityRate ?? 0
                ).toFixed(3)})`
            )
        );
        console.log(chalk.green(`[TriadMind] View map diagnostics written: ${paths.viewMapDiagnosticsFile}`));
    }

    private async writeRuntimeTopologyArtifacts(
        paths: WorkspacePaths,
        options: RuntimeTopologyArtifactOptions,
        bestEffort: boolean
    ): Promise<RuntimeArtifactResult> {
        try {
            const runtimeMap = await extractRuntimeTopology(paths.projectRoot, options);
            writeRuntimeMapArtifacts(runtimeMap, paths.runtimeMapFile, paths.runtimeDiagnosticsFile);
            return { runtimeMap, recovered: false };
        } catch (error: any) {
            if (!bestEffort) {
                throw error;
            }

            const runtimeMap = this.createFallbackRuntimeMap(paths, options, error);
            writeRuntimeMapArtifacts(runtimeMap, paths.runtimeMapFile, paths.runtimeDiagnosticsFile);
            return { runtimeMap, recovered: true };
        }
    }

    private writeViewMapArtifactsBestEffort(paths: WorkspacePaths, options: ViewMapOptions): ViewMapArtifactResult {
        try {
            const viewMap = writeViewMapArtifacts(paths, options);
            return { viewMap, recovered: false };
        } catch (error: any) {
            const viewMap = this.createFallbackViewMap(paths, error);
            fs.mkdirSync(path.dirname(paths.viewMapFile), { recursive: true });
            fs.writeFileSync(paths.viewMapFile, JSON.stringify(viewMap, null, 2), 'utf-8');
            fs.writeFileSync(paths.viewMapDiagnosticsFile, JSON.stringify(viewMap.diagnostics, null, 2), 'utf-8');
            return { viewMap, recovered: true };
        }
    }

    private createFallbackRuntimeMap(
        paths: WorkspacePaths,
        options: RuntimeTopologyArtifactOptions,
        error: unknown
    ): RuntimeMap {
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

    private createFallbackViewMap(paths: WorkspacePaths, error: unknown): ViewMap {
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
    constructor(private readonly threshold = 3) {}

    execute(paths: WorkspacePaths) {
        ensureTriadSpec(paths);
        if (!fs.existsSync(paths.mapFile)) {
            syncProjectTopology(paths, true);
        }

        const config = loadTriadConfig(paths);
        const map = readCurrentTriadMap(paths);
        const stableAnchorResolution = resolveEffectiveStableAnchors(paths, config.topologyRisk);
        const overloadedNodes = this.detectHighFanoutNodes(
            map,
            resolveAnalyzerOptionsFromConfig(config, stableAnchorResolution.stableAnchors)
        );
        fs.writeFileSync(paths.convergeTaskFile, this.buildConvergeTask(paths, overloadedNodes), 'utf-8');

        console.log(chalk.yellow('[TriadMind] recursive renormalization remains a reserved TODO capability.'));
        console.log(chalk.green(`[TriadMind] convergence task written: ${paths.convergeTaskFile}`));

        if (overloadedNodes.length > 0) {
            console.log(chalk.yellow(`[TriadMind] detected ${overloadedNodes.length} high-fanout node(s) worth convergence review.`));
        } else {
            console.log(chalk.green('[TriadMind] no node currently crosses the default high-fanout threshold (>= 3 downstreams).'));
        }
    }

    private detectHighFanoutNodes(map: unknown[], options?: AnalyzerOptions): DownstreamFanoutNode[] {
        const nodes = Array.isArray(map) ? map : [];
        const nodeById = new Map(
            nodes
                .map((node) => [String((node as { nodeId?: string })?.nodeId ?? '').trim(), node] as const)
                .filter(([nodeId]) => Boolean(nodeId))
        );
        return calculateDownstreamFanoutNodes(nodes, this.threshold, options).filter((entry) => {
            const node = nodeById.get(entry.nodeId);
            return node ? !isMatureStableArchitectureNode(node as any, options) : true;
        });
    }

    private buildConvergeTask(paths: WorkspacePaths, overloadedNodes: DownstreamFanoutNode[]) {
        const overloadSection =
            overloadedNodes.length > 0
                ? overloadedNodes
                      .map(
                          (entry, index) =>
                              `${index + 1}. ${entry.nodeId} -> ${entry.downstreamCount} downstream(s)\n   - ${entry.downstreamNodeIds.join('\n   - ')}`
                      )
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

export async function refreshRuntimeAndViewArtifacts(
    paths: WorkspacePaths,
    runtimeOptions: RuntimeTopologyArtifactOptions = {},
    viewMapOptions: ViewMapOptions = {},
    bestEffort = true
) {
    return derivedArtifactWorkflow.refreshRuntimeAndViewArtifacts(paths, runtimeOptions, viewMapOptions, bestEffort);
}

export function reportRuntimeArtifactStatus(paths: WorkspacePaths, result: RuntimeArtifactResult) {
    derivedArtifactWorkflow.reportRuntimeArtifactStatus(paths, result);
}

export function reportViewMapStatus(paths: WorkspacePaths, result: ViewMapArtifactResult) {
    derivedArtifactWorkflow.reportViewMapStatus(paths, result);
}

export function runAutoDreamAfterCommand(paths: WorkspacePaths, trigger: string) {
    void tickDreamAutoRun(paths, { trigger })
        .then((result) => {
            if (result.status === 'run') {
                console.log(
                    chalk.gray(`[TriadMind] dream auto run complete: trigger=${trigger}, pending=${result.pendingEvents}, lock=${result.lock}`)
                );
                return;
            }

            if (result.status === 'error') {
                console.log(
                    chalk.yellow(
                        `[TriadMind] dream auto run failed: trigger=${trigger}, reason=${result.reason}, error=${result.error ?? 'unknown'}`
                    )
                );
            }
        })
        .catch((error: any) => {
            console.log(
                chalk.yellow(
                    `[TriadMind] dream auto trigger crashed: trigger=${trigger}, error=${error?.message ? String(error.message) : String(error)}`
                )
            );
        });
}

export async function executeDreamRun(options: DreamRunCliOptions) {
    const paths = getWorkspacePaths(process.cwd());
    ensureTriadSpec(paths);

    const result = await runDreamAnalysis(paths, {
        mode: options.mode === 'idle' ? 'idle' : 'manual',
        force: Boolean(options.force),
        maxProposals: parseOptionalPositiveCliInteger(options.maxProposals),
        minConfidence: parseOptionalRatioCliNumber(options.minConfidence),
        impactThreshold: parseOptionalPositiveCliInteger(options.impactThreshold)
    });

    if (options.visualize) {
        generateDreamDashboard(result.report, paths.dreamVisualizerFile, {
            theme: options.theme === 'runtime-dark' ? 'runtime-dark' : 'leaf-like'
        });
    }

    if (options.json) {
        console.log(JSON.stringify(result.report, null, 2));
        return;
    }

    console.log(formatDreamReport(result.report));
    console.log(chalk.green(`[TriadMind] Dream report written: ${result.artifacts.reportFile}`));
    console.log(chalk.green(`[TriadMind] Dream diagnostics written: ${result.artifacts.diagnosticsFile}`));
    console.log(chalk.green(`[TriadMind] Dream proposals written: ${result.artifacts.proposalsFile}`));
    if (options.visualize) {
        console.log(chalk.green(`[TriadMind] Dream visualizer written: ${paths.dreamVisualizerFile}`));
    }
}

export function executeConvergePlaceholder(paths: WorkspacePaths) {
    convergePlaceholderPlanner.execute(paths);
}
