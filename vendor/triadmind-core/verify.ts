import * as fs from 'fs';
import * as path from 'path';
import {
    calculateAbstractionSummaryBySourcePath,
    detectAbstractionDeficitHotspots,
    detectC2cCoupling,
    detectFlatVariantClusters
} from './analyzer';
import {
    readDraftProtocolArtifact,
    readMicroSplitArtifact,
    readRuntimeDiagnosticsArtifact,
    readRuntimeMapArtifact,
    readTriadNodesArtifact,
    readVerifyBaselineArtifact
} from './artifactReaders';
import { loadTriadConfig } from './config';
import { filterNodesToImpactScope, loadImpactTierSummary } from './impactTierSupport';
import { calculateRuntimeRenderStats } from './runtime/runtimeVisualizer';
import {
    analyzeTriadCompleteness,
    collectGhostMetricsByLanguage,
    evaluateGhostPolicyViolations
} from './topologyQuality';
import {
    analyzeTriadizationFocusGateArtifacts,
    evaluateTriadizationFocusGateArtifacts as evaluateTriadizationFocusGateArtifactsShared,
    TriadizationFocusGateReport
} from './triadizationFocus';
import { WorkspacePaths } from './workspace';

export interface VerifyMetrics {
    triad_nodes: number;
    triad_vertices: number;
    execute_like_count: number;
    execute_like_ratio: number;
    abstraction_profiled_source_count: number;
    abstraction_signal_count: number;
    concrete_signal_count: number;
    abstraction_deficit_index: number;
    flat_variant_cluster_count: number;
    variant_without_contract_cluster_count: number;
    abstraction_hotspot_count: number;
    zero_abstraction_hotspot_count: number;
    ghost_nodes: number;
    ghost_ratio: number;
    runtime_nodes: number;
    runtime_edges: number;
    rendered_runtime_edges: number;
    rendered_edges_consistency: boolean;
    runtime_unmatched_route_count: number;
    diagnostics_total: number;
    diagnostics_no_code: number;
    ghost_ratio_by_language: Record<string, number>;
    ghost_in_demand_count_by_language: Record<string, number>;
    ghost_policy_violations: number;
    left_only_vertices: number;
    right_only_vertices: number;
    empty_vertices: number;
    scale_mixing_vertices: number;
    triad_completeness_violations: number;
    protocol_focus_alignment_violations: number;
    focus_closure_violations: number;
    c2c_coupling_count: number;
    c2c_coupling_hotspots: number;
}

export interface VerifyThresholds {
    diagnostics_no_code: number;
    execute_like_ratio: number;
    ghost_ratio: number;
    abstraction_deficit_index: number;
    variant_without_contract_cluster_count: number;
    zero_abstraction_hotspot_count: number;
    rendered_edges_consistency: boolean;
    runtime_unmatched_route_count?: number;
    ghost_policy_compliance: boolean;
    left_only_vertices: number;
    right_only_vertices: number;
    empty_vertices: number;
    scale_mixing_vertices: number;
    triad_completeness: boolean;
    protocol_focus_alignment: boolean;
    triad_focus_closure: boolean;
}

export interface VerifyCheckResult {
    key: keyof VerifyThresholds;
    status: 'pass' | 'fail' | 'skip';
    expected: number | boolean | string;
    actual: number | boolean | null;
    detail: string;
    baseline?: {
        path: string;
        value: number;
        allowedValue: number;
    };
    pre_existing?: boolean;
    introduced_by_current_diff?: boolean;
    regression?: number;
    remediation?: string[];
}

export interface VerifyReport {
    generatedAt: string;
    projectRoot: string;
    artifacts: {
        triadMapFile: string;
        runtimeMapFile: string;
        runtimeDiagnosticsFile: string;
        draftProtocolFile: string;
        microSplitFile: string;
    };
    strict: boolean;
    thresholds: VerifyThresholds;
    metrics: VerifyMetrics;
    checks: VerifyCheckResult[];
    passed: boolean;
    baseline?: {
        path: string;
        runtime_unmatched_route_count: number;
        zero_abstraction_hotspot_count?: number;
    };
    focus: {
        scope: 'full' | 'impact';
        fallbackToFull: boolean;
        originalTriadNodes: number;
        scopedTriadNodes: number;
        impactProtocolFile: string;
    };
}

export interface VerifyOptions {
    strict?: boolean;
    maxExecuteLikeRatio?: number;
    maxGhostRatio?: number;
    maxUnmatchedRouteCount?: number;
    baselinePath?: string;
    maxRenderEdges?: number;
    updateBaseline?: boolean;
    failOnNewRegressions?: boolean;
    focus?: 'full' | 'impact';
}

const EXECUTE_LIKE_METHOD_PATTERN = /execute/i;
export const DEFAULT_ABSTRACTION_DEFICIT_INDEX_LIMIT = 0.55;
export const DEFAULT_VARIANT_WITHOUT_CONTRACT_CLUSTER_LIMIT = 0;
export const DEFAULT_ZERO_ABSTRACTION_HOTSPOT_LIMIT = 0;
export const DEFAULT_ABSTRACTION_HOTSPOT_MIN_CONCRETE_SIGNALS = 4;
export const DEFAULT_ABSTRACTION_HOTSPOT_MAX_RATIO = 0.2;

interface AbstractionGovernanceSnapshot {
    profiledSourceCount: number;
    abstractionSignalCount: number;
    concreteSignalCount: number;
    flatVariantClusterCount: number;
    variantWithoutContractClusterCount: number;
    abstractionHotspotCount: number;
    zeroAbstractionHotspotCount: number;
    abstractionDeficitIndex: number;
    uncoveredVariantClusters: ReturnType<typeof detectFlatVariantClusters>;
    hotspots: ReturnType<typeof detectAbstractionDeficitHotspots>;
}

export type { TriadizationFocusGateFailureKind, TriadizationFocusGateReport } from './triadizationFocus';

export function evaluateTriadizationFocusGateArtifacts(
    draftProtocol: unknown,
    microSplit: unknown
): TriadizationFocusGateReport {
    return evaluateTriadizationFocusGateArtifactsShared(draftProtocol, microSplit);
}

export function runTopologyVerify(paths: WorkspacePaths, options: VerifyOptions = {}): VerifyReport {
    const allTriadNodes = readTriadNodesArtifact(paths.mapFile);
    const config = loadTriadConfig(paths);
    const requestedFocus = options.focus === 'impact' ? 'impact' : 'full';
    const impactSummary = loadImpactTierSummary(paths, allTriadNodes, config);
    const scopedTriadNodes = requestedFocus === 'impact'
        ? filterNodesToImpactScope(allTriadNodes, impactSummary, { includeAdvisory: false, includeStrict: true })
        : allTriadNodes;
    const effectiveTriadNodes = requestedFocus === 'impact' && !impactSummary.available ? allTriadNodes : scopedTriadNodes;
    const runtimeMap = readRuntimeMapArtifact(paths.runtimeMapFile);
    const runtimeDiagnostics = readRuntimeDiagnosticsArtifact(paths.runtimeDiagnosticsFile);
    const draftProtocol = readDraftProtocolArtifact(paths.draftFile);
    const microSplit = readMicroSplitArtifact(paths.microSplitFile);
    const runtimeRenderStats = runtimeMap
        ? calculateRuntimeRenderStats(runtimeMap, options.maxRenderEdges)
        : { sourceEdges: 0, renderedEdges: 0, edgeCapApplied: false, nodeCount: 0 };
    const executeLikeCount = effectiveTriadNodes.filter((node) => isExecuteLikeNodeId(node.nodeId)).length;
    const diagnosticsNoCode = runtimeDiagnostics.filter((item) => !String(item.code ?? '').trim()).length;
    const runtimeUnmatchedRouteCount = runtimeDiagnostics.filter(
        (item) => String(item.code ?? '').trim().toUpperCase() === 'RUNTIME_FRONTEND_API_ROUTE_UNMATCHED'
    ).length;
    const runtimeNodes = runtimeMap?.nodes?.length ?? 0;
    const runtimeEdges = runtimeMap?.edges?.length ?? 0;
    const renderedRuntimeEdges = runtimeRenderStats.renderedEdges;
    const renderedEdgesConsistency = runtimeMap ? renderedRuntimeEdges === runtimeEdges : false;
    const ghostByLanguage = collectGhostMetricsByLanguage(effectiveTriadNodes);
    const ghostNodes = Object.values(ghostByLanguage.ghostInDemandCountByLanguage).reduce(
        (sum, count) => sum + count,
        0
    );
    const ghostPolicyViolations = evaluateGhostPolicyViolations(
        effectiveTriadNodes,
        config.parser.ghostPolicyByLanguage as Record<
            string,
            { includeInDemand: boolean; topK: number; minConfidence: number } | undefined
        >,
        { violationLimit: 50 }
    );
    const triadCompleteness = analyzeTriadCompleteness(
        effectiveTriadNodes,
        microSplit,
        config.architecture.language,
        config.parser.genericContractIgnoreList
    );
    const focusGateAnalysis = analyzeTriadizationFocusGateArtifacts(draftProtocol, microSplit);
    const focusAlignment = focusGateAnalysis.alignment;
    const focusClosure = focusGateAnalysis.closure;
    const abstractionGovernance = buildAbstractionGovernanceSnapshot(effectiveTriadNodes);
    const c2cFindings = detectC2cCoupling(effectiveTriadNodes, {});

    const baseline = readVerifyBaselineArtifact(resolveBaselinePath(paths, options.baselinePath));
    const baselinePath = resolveBaselinePath(paths, options.baselinePath);
    const unresolvedUnmatchedLimit =
        options.maxUnmatchedRouteCount ??
        (baseline ? Math.max(0, Math.ceil(baseline.runtime_unmatched_route_count * 1.1)) : undefined);
    const zeroAbstractionHotspotLimit =
        typeof baseline?.zero_abstraction_hotspot_count === 'number'
            ? baseline.zero_abstraction_hotspot_count
            : DEFAULT_ZERO_ABSTRACTION_HOTSPOT_LIMIT;

    const thresholds: VerifyThresholds = {
        diagnostics_no_code: 0,
        execute_like_ratio: normalizeRatioThreshold(options.maxExecuteLikeRatio, 0.1),
        ghost_ratio: normalizeRatioThreshold(options.maxGhostRatio, 0.4),
        abstraction_deficit_index: DEFAULT_ABSTRACTION_DEFICIT_INDEX_LIMIT,
        variant_without_contract_cluster_count: DEFAULT_VARIANT_WITHOUT_CONTRACT_CLUSTER_LIMIT,
        zero_abstraction_hotspot_count: zeroAbstractionHotspotLimit,
        rendered_edges_consistency: true,
        runtime_unmatched_route_count: unresolvedUnmatchedLimit,
        ghost_policy_compliance: true,
        left_only_vertices: 0,
        right_only_vertices: 0,
        empty_vertices: 0,
        scale_mixing_vertices: 0,
        triad_completeness: true,
        protocol_focus_alignment: true,
        triad_focus_closure: true
    };

    const metrics: VerifyMetrics = {
        triad_nodes: effectiveTriadNodes.length,
        triad_vertices: triadCompleteness.triadVertices,
        execute_like_count: executeLikeCount,
        execute_like_ratio: safeRatio(executeLikeCount, effectiveTriadNodes.length),
        abstraction_profiled_source_count: abstractionGovernance.profiledSourceCount,
        abstraction_signal_count: abstractionGovernance.abstractionSignalCount,
        concrete_signal_count: abstractionGovernance.concreteSignalCount,
        abstraction_deficit_index: abstractionGovernance.abstractionDeficitIndex,
        flat_variant_cluster_count: abstractionGovernance.flatVariantClusterCount,
        variant_without_contract_cluster_count: abstractionGovernance.variantWithoutContractClusterCount,
        abstraction_hotspot_count: abstractionGovernance.abstractionHotspotCount,
        zero_abstraction_hotspot_count: abstractionGovernance.zeroAbstractionHotspotCount,
        ghost_nodes: ghostNodes,
        ghost_ratio: safeRatio(ghostNodes, effectiveTriadNodes.length),
        runtime_nodes: runtimeNodes,
        runtime_edges: runtimeEdges,
        rendered_runtime_edges: renderedRuntimeEdges,
        rendered_edges_consistency: renderedEdgesConsistency,
        runtime_unmatched_route_count: runtimeUnmatchedRouteCount,
        diagnostics_total: runtimeDiagnostics.length,
        diagnostics_no_code: diagnosticsNoCode,
        ghost_ratio_by_language: ghostByLanguage.ghostRatioByLanguage,
        ghost_in_demand_count_by_language: ghostByLanguage.ghostInDemandCountByLanguage,
        ghost_policy_violations: ghostPolicyViolations.length,
        left_only_vertices: triadCompleteness.leftOnlyVertices.length,
        right_only_vertices: triadCompleteness.rightOnlyVertices.length,
        empty_vertices: triadCompleteness.emptyVertices.length,
        scale_mixing_vertices: triadCompleteness.scaleMixingVertices.length,
        triad_completeness_violations:
            triadCompleteness.leftOnlyVertices.length +
            triadCompleteness.rightOnlyVertices.length +
            triadCompleteness.emptyVertices.length +
            triadCompleteness.scaleMixingVertices.length,
        c2c_coupling_count: c2cFindings.length,
        c2c_coupling_hotspots: c2cFindings.filter((f) => f.confidence >= 0.7).length,
        protocol_focus_alignment_violations: focusAlignment.alignmentViolations.length,
        focus_closure_violations: focusClosure.closureViolations.length
    };

    const checks: VerifyCheckResult[] = [];
    if (requestedFocus === 'impact') {
        checks.push({
            key: 'triad_completeness',
            status: impactSummary.available ? 'pass' : 'skip',
            expected: 'impact-protocol.json impactedNodes available for focus=impact',
            actual: impactSummary.available,
            detail: impactSummary.available
                ? `Focused verify on ${effectiveTriadNodes.length}/${allTriadNodes.length} strict impacted triad node(s)`
                : 'Impact focus requested but impact-protocol.json has no impactedNodes; full-scope fallback used',
            mustPass: false
        } as VerifyCheckResult);
    }
    checks.push(
        evaluateNumericThreshold('diagnostics_no_code', metrics.diagnostics_no_code, thresholds.diagnostics_no_code, '<='),
        evaluateNumericThreshold('execute_like_ratio', metrics.execute_like_ratio, thresholds.execute_like_ratio, '<'),
        evaluateNumericThreshold('ghost_ratio', metrics.ghost_ratio, thresholds.ghost_ratio, '<')
    );
    if (runtimeMap) {
        checks.push(
            evaluateBooleanThreshold(
                'rendered_edges_consistency',
                metrics.rendered_edges_consistency,
                thresholds.rendered_edges_consistency
            )
        );
    } else {
        checks.push({
            key: 'rendered_edges_consistency',
            status: 'skip',
            expected: 'runtime-map.json present',
            actual: null,
            detail: 'Skipped rendered edge consistency check because runtime-map.json is missing'
        });
    }
    checks.push(
        evaluateOptionalNumericThreshold(
            'runtime_unmatched_route_count',
            metrics.runtime_unmatched_route_count,
            thresholds.runtime_unmatched_route_count,
            baseline
                ? {
                      path: baselinePath,
                      value: baseline.runtime_unmatched_route_count,
                      allowedValue: thresholds.runtime_unmatched_route_count ?? baseline.runtime_unmatched_route_count
                  }
                : undefined
        )
    );
    checks.push(
        evaluateBooleanThreshold(
            'ghost_policy_compliance',
            metrics.ghost_policy_violations === 0,
            thresholds.ghost_policy_compliance,
            metrics.ghost_policy_violations > 0
                ? ghostPolicyViolations.join('; ')
                : 'Language ghost policy constraints satisfied'
        )
    );
    checks.push(
        evaluateNumericThreshold(
            'left_only_vertices',
            metrics.left_only_vertices,
            thresholds.left_only_vertices,
            '<=',
            buildTriadViolationDetail('Left-only vertices', triadCompleteness.leftOnlyVertices)
        )
    );
    checks.push(
        evaluateNumericThreshold(
            'right_only_vertices',
            metrics.right_only_vertices,
            thresholds.right_only_vertices,
            '<=',
            buildTriadViolationDetail('Right-only vertices', triadCompleteness.rightOnlyVertices)
        )
    );
    checks.push(
        evaluateNumericThreshold(
            'empty_vertices',
            metrics.empty_vertices,
            thresholds.empty_vertices,
            '<=',
            buildTriadViolationDetail('Empty vertices', triadCompleteness.emptyVertices)
        )
    );
    checks.push(
        evaluateNumericThreshold(
            'scale_mixing_vertices',
            metrics.scale_mixing_vertices,
            thresholds.scale_mixing_vertices,
            '<=',
            buildTriadViolationDetail('Scale-mixing vertices', triadCompleteness.scaleMixingVertices)
        )
    );
    checks.push(
        evaluateBooleanThreshold(
            'triad_completeness',
            metrics.triad_completeness_violations === 0,
            thresholds.triad_completeness,
            metrics.triad_completeness_violations > 0
                ? [
                      buildTriadViolationDetail('Left-only vertices', triadCompleteness.leftOnlyVertices),
                      buildTriadViolationDetail('Right-only vertices', triadCompleteness.rightOnlyVertices),
                      buildTriadViolationDetail('Empty vertices', triadCompleteness.emptyVertices),
                      buildTriadViolationDetail('Scale-mixing vertices', triadCompleteness.scaleMixingVertices)
                  ]
                      .filter((item) => !item.endsWith('none'))
                      .join('; ')
                : 'Triad completeness checks satisfied'
        )
    );
    if (focusAlignment.artifactsInspected.length > 0) {
        checks.push(
            evaluateBooleanThreshold(
                'protocol_focus_alignment',
                metrics.protocol_focus_alignment_violations === 0,
                thresholds.protocol_focus_alignment,
                metrics.protocol_focus_alignment_violations > 0
                    ? buildTriadViolationDetail('Protocol focus alignment', focusAlignment.alignmentViolations)
                    : 'draft-protocol.json and micro-split.json stay on the same triadization focus'
            )
        );
    } else {
        checks.push({
            key: 'protocol_focus_alignment',
            status: 'skip',
            expected: 'draft-protocol.json or micro-split.json present',
            actual: null,
            detail: 'Skipped protocol focus alignment because no triadization focus artifacts were found'
        });
    }
    if (focusClosure.focusReference) {
        checks.push(
            evaluateBooleanThreshold(
                'triad_focus_closure',
                metrics.focus_closure_violations === 0,
                thresholds.triad_focus_closure,
                metrics.focus_closure_violations > 0
                    ? buildTriadViolationDetail('Triad focus closure', focusClosure.closureViolations)
                    : `Focused class closes around ${focusClosure.focusReference.triadizationFocus}`
            )
        );
    } else {
        checks.push({
            key: 'triad_focus_closure',
            status: 'skip',
            expected: 'triadizationFocus available',
            actual: null,
            detail: 'Skipped triad focus closure because no canonical triadization focus could be resolved'
        });
    }
    checks.push(
        ...buildAbstractionGovernanceChecks(
            metrics,
            thresholds,
            abstractionGovernance,
            typeof baseline?.zero_abstraction_hotspot_count === 'number'
                ? {
                      path: baselinePath,
                      value: baseline.zero_abstraction_hotspot_count,
                      allowedValue: thresholds.zero_abstraction_hotspot_count
                  }
                : undefined
        )
    );

    const failedChecks = checks.filter((check) => check.status === 'fail');
    const passed = options.failOnNewRegressions
        ? failedChecks.every((check) => check.pre_existing === true)
        : failedChecks.length === 0;

    const report: VerifyReport = {
        generatedAt: new Date().toISOString(),
        projectRoot: paths.projectRoot,
        artifacts: {
            triadMapFile: paths.mapFile,
            runtimeMapFile: paths.runtimeMapFile,
            runtimeDiagnosticsFile: paths.runtimeDiagnosticsFile,
            draftProtocolFile: paths.draftFile,
            microSplitFile: paths.microSplitFile
        },
        strict: Boolean(options.strict),
        thresholds,
        metrics,
        checks,
        passed,
        focus: {
            scope: requestedFocus,
            fallbackToFull: requestedFocus === 'impact' && !impactSummary.available,
            originalTriadNodes: allTriadNodes.length,
            scopedTriadNodes: effectiveTriadNodes.length,
            impactProtocolFile: paths.impactProtocolFile
        },
        baseline: baseline
            ? {
                  path: baselinePath,
                  runtime_unmatched_route_count: baseline.runtime_unmatched_route_count,
                  zero_abstraction_hotspot_count: baseline.zero_abstraction_hotspot_count
              }
            : undefined
    };

    if (options.updateBaseline) {
        writeVerifyBaseline(
            baselinePath,
            metrics.runtime_unmatched_route_count,
            metrics.zero_abstraction_hotspot_count,
            report.generatedAt
        );
    }

    return report;
}

export function formatVerifyReport(report: VerifyReport) {
    const checkLines = report.checks.map((check) => {
        const icon = check.status === 'pass' ? 'PASS' : check.status === 'fail' ? 'FAIL' : 'SKIP';
        return `[${icon}] ${check.key} | expected: ${check.expected} | actual: ${check.actual ?? '-'} | ${check.detail}`;
    });

    const summary = report.passed ? 'PASS' : 'FAIL';
    return [
        `TriadMind Verify (${summary})`,
        `generatedAt=${report.generatedAt}`,
        `triad_nodes=${report.metrics.triad_nodes}, triad_vertices=${report.metrics.triad_vertices}, runtime_nodes=${report.metrics.runtime_nodes}, runtime_edges=${report.metrics.runtime_edges}`,
        `execute_like_ratio=${report.metrics.execute_like_ratio.toFixed(3)}, ghost_ratio=${report.metrics.ghost_ratio.toFixed(3)}`,
        `abstraction_profiled_source_count=${report.metrics.abstraction_profiled_source_count}, abstraction_signal_count=${report.metrics.abstraction_signal_count}, concrete_signal_count=${report.metrics.concrete_signal_count}, abstraction_deficit_index=${report.metrics.abstraction_deficit_index.toFixed(3)}`,
        `flat_variant_cluster_count=${report.metrics.flat_variant_cluster_count}, variant_without_contract_cluster_count=${report.metrics.variant_without_contract_cluster_count}, abstraction_hotspot_count=${report.metrics.abstraction_hotspot_count}, zero_abstraction_hotspot_count=${report.metrics.zero_abstraction_hotspot_count}`,
        `ghost_ratio_by_language=${JSON.stringify(report.metrics.ghost_ratio_by_language)}`,
        `ghost_in_demand_count_by_language=${JSON.stringify(report.metrics.ghost_in_demand_count_by_language)}`,
        `diagnostics_no_code=${report.metrics.diagnostics_no_code}, runtime_unmatched_route_count=${report.metrics.runtime_unmatched_route_count}`,
        `ghost_policy_violations=${report.metrics.ghost_policy_violations}`,
        `left_only_vertices=${report.metrics.left_only_vertices}, right_only_vertices=${report.metrics.right_only_vertices}, empty_vertices=${report.metrics.empty_vertices}, scale_mixing_vertices=${report.metrics.scale_mixing_vertices}`,
        `protocol_focus_alignment_violations=${report.metrics.protocol_focus_alignment_violations}, focus_closure_violations=${report.metrics.focus_closure_violations}`,
        `rendered_runtime_edges=${report.metrics.rendered_runtime_edges}, rendered_edges_consistency=${report.metrics.rendered_edges_consistency}`,
        ...checkLines
    ].join('\n');
}

function evaluateNumericThreshold(
    key: keyof VerifyThresholds,
    actual: number,
    expected: number,
    operator: '<' | '<=',
    detailHint?: string
): VerifyCheckResult {
    const pass = operator === '<' ? actual < expected : actual <= expected;
    return {
        key,
        status: pass ? 'pass' : 'fail',
        expected,
        actual,
        detail: detailHint ?? (operator === '<' ? `must be < ${expected}` : `must be <= ${expected}`)
    };
}

function evaluateBooleanThreshold(
    key: keyof VerifyThresholds,
    actual: boolean,
    expected: boolean,
    detailHint?: string
): VerifyCheckResult {
    const pass = actual === expected;
    return {
        key,
        status: pass ? 'pass' : 'fail',
        expected,
        actual,
        detail: detailHint ?? `must equal ${expected}`
    };
}

function evaluateOptionalNumericThreshold(
    key: keyof VerifyThresholds,
    actual: number,
    expected?: number,
    baseline?: VerifyCheckResult['baseline']
): VerifyCheckResult {
    if (typeof expected !== 'number' || !Number.isFinite(expected)) {
        return {
            key,
            status: 'skip',
            expected: 'not configured',
            actual,
            detail: 'No threshold configured (set --max-unmatched-routes or provide baseline)'
        };
    }
    return {
        key,
        status: actual <= expected ? 'pass' : 'fail',
        expected,
        actual,
        detail: baseline
            ? `must be <= ${expected}; baseline=${baseline.value}; regression=${Math.max(0, actual - baseline.value)}`
            : `must be <= ${expected}`,
        baseline,
        pre_existing: baseline ? actual <= baseline.allowedValue : undefined,
        introduced_by_current_diff: baseline ? actual > baseline.allowedValue : undefined,
        regression: baseline ? Math.max(0, actual - baseline.value) : undefined
    };
}

function buildAbstractionGovernanceSnapshot(effectiveTriadNodes: unknown[]): AbstractionGovernanceSnapshot {
    const summaries = calculateAbstractionSummaryBySourcePath(Array.isArray(effectiveTriadNodes) ? effectiveTriadNodes : []);
    const profiledSummaries = summaries.filter(
        (summary) => summary.abstractionSignalCount + summary.concreteSignalCount > 0
    );
    if (profiledSummaries.length === 0) {
        return {
            profiledSourceCount: 0,
            abstractionSignalCount: 0,
            concreteSignalCount: 0,
            flatVariantClusterCount: 0,
            variantWithoutContractClusterCount: 0,
            abstractionHotspotCount: 0,
            zeroAbstractionHotspotCount: 0,
            abstractionDeficitIndex: 0,
            uncoveredVariantClusters: [],
            hotspots: []
        };
    }

    const profiledSources = new Set(profiledSummaries.map((summary) => summary.sourcePath));
    const abstractionSignalCount = profiledSummaries.reduce((sum, summary) => sum + summary.abstractionSignalCount, 0);
    const concreteSignalCount = profiledSummaries.reduce((sum, summary) => sum + summary.concreteSignalCount, 0);
    const flatVariantClusters = detectFlatVariantClusters(effectiveTriadNodes).filter((cluster) => profiledSources.has(cluster.sourcePath));
    const uncoveredVariantClusters = flatVariantClusters.filter((cluster) => !cluster.contractCoverage);
    const hotspots = detectAbstractionDeficitHotspots(effectiveTriadNodes, {
        minConcreteSignals: DEFAULT_ABSTRACTION_HOTSPOT_MIN_CONCRETE_SIGNALS,
        maxAbstractionRatio: DEFAULT_ABSTRACTION_HOTSPOT_MAX_RATIO
    }).filter((hotspot) => profiledSources.has(hotspot.sourcePath));
    const zeroAbstractionHotspots = hotspots.filter((hotspot) => hotspot.abstractionSignalCount === 0);
    const totalSignals = abstractionSignalCount + concreteSignalCount;
    const abstractionCoveragePressure = totalSignals > 0 ? 1 - abstractionSignalCount / totalSignals : 0;
    const variantPressure = clampNumber(
        uncoveredVariantClusters.length / Math.max(1, profiledSummaries.length),
        0,
        1
    );
    const hotspotPressure = clampNumber(hotspots.length / Math.max(1, profiledSummaries.length), 0, 1);

    return {
        profiledSourceCount: profiledSummaries.length,
        abstractionSignalCount,
        concreteSignalCount,
        flatVariantClusterCount: flatVariantClusters.length,
        variantWithoutContractClusterCount: uncoveredVariantClusters.length,
        abstractionHotspotCount: hotspots.length,
        zeroAbstractionHotspotCount: zeroAbstractionHotspots.length,
        abstractionDeficitIndex: Number(
            clampNumber(abstractionCoveragePressure * 0.5 + variantPressure * 0.25 + hotspotPressure * 0.25, 0, 1).toFixed(6)
        ),
        uncoveredVariantClusters,
        hotspots
    };
}

function buildAbstractionGovernanceChecks(
    metrics: VerifyMetrics,
    thresholds: VerifyThresholds,
    snapshot: AbstractionGovernanceSnapshot,
    zeroAbstractionHotspotBaseline?: VerifyCheckResult['baseline']
) {
    if (snapshot.profiledSourceCount === 0) {
        return [
            createAbstractionGovernanceSkipCheck('abstraction_deficit_index'),
            createAbstractionGovernanceSkipCheck('variant_without_contract_cluster_count'),
            createAbstractionGovernanceSkipCheck('zero_abstraction_hotspot_count')
        ];
    }

    return [
        evaluateNumericThreshold(
            'abstraction_deficit_index',
            metrics.abstraction_deficit_index,
            thresholds.abstraction_deficit_index,
            '<',
            buildAbstractionDeficitDetail(snapshot)
        ),
        evaluateNumericThreshold(
            'variant_without_contract_cluster_count',
            metrics.variant_without_contract_cluster_count,
            thresholds.variant_without_contract_cluster_count,
            '<=',
            buildVariantClusterDetail(snapshot.uncoveredVariantClusters)
        ),
        decorateZeroAbstractionHotspotCheck(
            evaluateNumericThreshold(
                'zero_abstraction_hotspot_count',
                metrics.zero_abstraction_hotspot_count,
                thresholds.zero_abstraction_hotspot_count,
                '<=',
                buildAbstractionHotspotDetail(snapshot.hotspots)
            ),
            zeroAbstractionHotspotBaseline,
            snapshot.hotspots
        )
    ];
}

function decorateZeroAbstractionHotspotCheck(
    check: VerifyCheckResult,
    baseline: VerifyCheckResult['baseline'] | undefined,
    hotspots: ReturnType<typeof detectAbstractionDeficitHotspots>
): VerifyCheckResult {
    const actual = typeof check.actual === 'number' ? check.actual : 0;
    const remediation = buildAbstractionHotspotRemediation(hotspots);
    if (!baseline) {
        return {
            ...check,
            remediation
        };
    }

    return {
        ...check,
        detail: `${check.detail}; baseline=${baseline.value}; regression=${Math.max(0, actual - baseline.value)}`,
        baseline,
        pre_existing: actual <= baseline.allowedValue,
        introduced_by_current_diff: actual > baseline.allowedValue,
        regression: Math.max(0, actual - baseline.value),
        remediation
    };
}

function buildAbstractionHotspotRemediation(hotspots: ReturnType<typeof detectAbstractionDeficitHotspots>) {
    const sourcePaths = hotspots.map((hotspot) => hotspot.sourcePath).join('\n');
    const steps = [
        'Extract an API/client domain adapter around repeated concrete request logic.',
        'Split page-level state, commands, and view rendering into separate right/left branch contracts.',
        'Add an explicit query/client contract boundary before concrete cache or fetch usage.',
        'Record abstraction evidence on the adapter/contract nodes, then rerun `triadmind sync --force` and `triadmind verify --strict`.'
    ];
    if (/api-client/i.test(sourcePaths)) {
        steps.unshift('Create an API client domain adapter for typed endpoint contracts and transport concerns.');
    }
    if (/calibration|page\.tsx/i.test(sourcePaths)) {
        steps.unshift('Move calibration page orchestration into state, command, and view slices.');
    }
    if (/queryclient|query-client/i.test(sourcePaths)) {
        steps.unshift('Wrap query client setup in a stable contract boundary for cache policy and error handling.');
    }
    return Array.from(new Set(steps));
}

function createAbstractionGovernanceSkipCheck(key: keyof VerifyThresholds): VerifyCheckResult {
    return {
        key,
        status: 'skip',
        expected: 'abstraction evidence coverage present',
        actual: null,
        detail: 'Skipped abstraction governance because triad-map nodes do not contain abstraction signal counts yet'
    };
}

function buildAbstractionDeficitDetail(snapshot: AbstractionGovernanceSnapshot) {
    const topHotspots = snapshot.hotspots
        .slice(0, 3)
        .map((hotspot) => `${hotspot.sourcePath} (ratio=${hotspot.abstractionRatio.toFixed(3)})`);
    return [
        `Profiled sources=${snapshot.profiledSourceCount}`,
        `abstraction_signals=${snapshot.abstractionSignalCount}`,
        `concrete_signals=${snapshot.concreteSignalCount}`,
        `uncovered_variant_clusters=${snapshot.variantWithoutContractClusterCount}`,
        `hotspots=${snapshot.abstractionHotspotCount}`,
        topHotspots.length > 0 ? `top_hotspots=${topHotspots.join(', ')}` : 'top_hotspots=none'
    ].join('; ');
}

function buildVariantClusterDetail(clusters: ReturnType<typeof detectFlatVariantClusters>) {
    if (clusters.length === 0) {
        return 'Flat variant clusters without contract coverage: none';
    }
    return `Flat variant clusters without contract coverage: ${clusters
        .slice(0, 4)
        .map((cluster) => `${cluster.sourcePath}#${cluster.cluster} (${cluster.nodeIds.length} nodes)`)
        .join(', ')}`;
}

function buildAbstractionHotspotDetail(hotspots: ReturnType<typeof detectAbstractionDeficitHotspots>) {
    if (hotspots.length === 0) {
        return 'Zero-abstraction hotspots: none';
    }
    return `Abstraction hotspots: ${hotspots
        .slice(0, 4)
        .map((hotspot) => `${hotspot.sourcePath} (${hotspot.reason})`)
        .join(', ')}`;
}

function writeVerifyBaseline(
    baselinePath: string,
    unmatchedCount: number,
    zeroAbstractionHotspotCount: number,
    generatedAt: string
) {
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    fs.writeFileSync(
        baselinePath,
        JSON.stringify(
            {
                generatedAt,
                runtime_unmatched_route_count: Math.max(0, Math.floor(unmatchedCount)),
                zero_abstraction_hotspot_count: Math.max(0, Math.floor(zeroAbstractionHotspotCount))
            },
            null,
            2
        ),
        'utf-8'
    );
}

function resolveBaselinePath(paths: WorkspacePaths, overridePath?: string) {
    const raw = String(overridePath ?? '').trim();
    if (!raw) {
        return paths.verifyBaselineFile;
    }
    return path.isAbsolute(raw) ? raw : path.resolve(paths.projectRoot, raw);
}

function isExecuteLikeNodeId(nodeId: string | undefined) {
    if (!nodeId) {
        return false;
    }
    return EXECUTE_LIKE_METHOD_PATTERN.test(String(nodeId));
}

function buildTriadViolationDetail(title: string, values: string[]) {
    return values.length === 0 ? `${title}: none` : `${title}: ${values.slice(0, 6).join(', ')}`;
}

function safeRatio(part: number, total: number) {
    if (!total) {
        return 0;
    }
    return Number((part / total).toFixed(6));
}

function clampNumber(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function normalizeRatioThreshold(value: number | undefined, fallback: number) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return value;
    }
    return fallback;
}
