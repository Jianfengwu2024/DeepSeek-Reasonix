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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ABSTRACTION_HOTSPOT_MAX_RATIO = exports.DEFAULT_ABSTRACTION_HOTSPOT_MIN_CONCRETE_SIGNALS = exports.DEFAULT_ZERO_ABSTRACTION_HOTSPOT_LIMIT = exports.DEFAULT_VARIANT_WITHOUT_CONTRACT_CLUSTER_LIMIT = exports.DEFAULT_ABSTRACTION_DEFICIT_INDEX_LIMIT = void 0;
exports.evaluateTriadizationFocusGateArtifacts = evaluateTriadizationFocusGateArtifacts;
exports.runTopologyVerify = runTopologyVerify;
exports.formatVerifyReport = formatVerifyReport;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const analyzer_1 = require("./analyzer");
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
const impactTierSupport_1 = require("./impactTierSupport");
const runtimeVisualizer_1 = require("./runtime/runtimeVisualizer");
const topologyQuality_1 = require("./topologyQuality");
const triadizationFocus_1 = require("./triadizationFocus");
const EXECUTE_LIKE_METHOD_PATTERN = /execute/i;
exports.DEFAULT_ABSTRACTION_DEFICIT_INDEX_LIMIT = 0.55;
exports.DEFAULT_VARIANT_WITHOUT_CONTRACT_CLUSTER_LIMIT = 0;
exports.DEFAULT_ZERO_ABSTRACTION_HOTSPOT_LIMIT = 0;
exports.DEFAULT_ABSTRACTION_HOTSPOT_MIN_CONCRETE_SIGNALS = 4;
exports.DEFAULT_ABSTRACTION_HOTSPOT_MAX_RATIO = 0.2;
function evaluateTriadizationFocusGateArtifacts(draftProtocol, microSplit) {
    return (0, triadizationFocus_1.evaluateTriadizationFocusGateArtifacts)(draftProtocol, microSplit);
}
function runTopologyVerify(paths, options = {}) {
    const allTriadNodes = (0, artifactReaders_1.readTriadNodesArtifact)(paths.mapFile);
    const config = (0, config_1.loadTriadConfig)(paths);
    const requestedFocus = options.focus === 'impact' ? 'impact' : 'full';
    const impactSummary = (0, impactTierSupport_1.loadImpactTierSummary)(paths, allTriadNodes, config);
    const scopedTriadNodes = requestedFocus === 'impact'
        ? (0, impactTierSupport_1.filterNodesToImpactScope)(allTriadNodes, impactSummary, { includeAdvisory: false, includeStrict: true })
        : allTriadNodes;
    const effectiveTriadNodes = requestedFocus === 'impact' && !impactSummary.available ? allTriadNodes : scopedTriadNodes;
    const runtimeMap = (0, artifactReaders_1.readRuntimeMapArtifact)(paths.runtimeMapFile);
    const runtimeDiagnostics = (0, artifactReaders_1.readRuntimeDiagnosticsArtifact)(paths.runtimeDiagnosticsFile);
    const draftProtocol = (0, artifactReaders_1.readDraftProtocolArtifact)(paths.draftFile);
    const microSplit = (0, artifactReaders_1.readMicroSplitArtifact)(paths.microSplitFile);
    const runtimeRenderStats = runtimeMap
        ? (0, runtimeVisualizer_1.calculateRuntimeRenderStats)(runtimeMap, options.maxRenderEdges)
        : { sourceEdges: 0, renderedEdges: 0, edgeCapApplied: false, nodeCount: 0 };
    const executeLikeCount = effectiveTriadNodes.filter((node) => isExecuteLikeNodeId(node.nodeId)).length;
    const diagnosticsNoCode = runtimeDiagnostics.filter((item) => !String(item.code ?? '').trim()).length;
    const runtimeUnmatchedRouteCount = runtimeDiagnostics.filter((item) => String(item.code ?? '').trim().toUpperCase() === 'RUNTIME_FRONTEND_API_ROUTE_UNMATCHED').length;
    const runtimeNodes = runtimeMap?.nodes?.length ?? 0;
    const runtimeEdges = runtimeMap?.edges?.length ?? 0;
    const renderedRuntimeEdges = runtimeRenderStats.renderedEdges;
    const renderedEdgesConsistency = runtimeMap ? renderedRuntimeEdges === runtimeEdges : false;
    const ghostByLanguage = (0, topologyQuality_1.collectGhostMetricsByLanguage)(effectiveTriadNodes);
    const ghostNodes = Object.values(ghostByLanguage.ghostInDemandCountByLanguage).reduce((sum, count) => sum + count, 0);
    const ghostPolicyViolations = (0, topologyQuality_1.evaluateGhostPolicyViolations)(effectiveTriadNodes, config.parser.ghostPolicyByLanguage, { violationLimit: 50 });
    const triadCompleteness = (0, topologyQuality_1.analyzeTriadCompleteness)(effectiveTriadNodes, microSplit, config.architecture.language, config.parser.genericContractIgnoreList);
    const focusGateAnalysis = (0, triadizationFocus_1.analyzeTriadizationFocusGateArtifacts)(draftProtocol, microSplit);
    const focusAlignment = focusGateAnalysis.alignment;
    const focusClosure = focusGateAnalysis.closure;
    const abstractionGovernance = buildAbstractionGovernanceSnapshot(effectiveTriadNodes);
    const c2cFindings = (0, analyzer_1.detectC2cCoupling)(effectiveTriadNodes, {});
    const baseline = (0, artifactReaders_1.readVerifyBaselineArtifact)(resolveBaselinePath(paths, options.baselinePath));
    const unresolvedUnmatchedLimit = options.maxUnmatchedRouteCount ??
        (baseline ? Math.max(0, Math.ceil(baseline.runtime_unmatched_route_count * 1.1)) : undefined);
    const thresholds = {
        diagnostics_no_code: 0,
        execute_like_ratio: normalizeRatioThreshold(options.maxExecuteLikeRatio, 0.1),
        ghost_ratio: normalizeRatioThreshold(options.maxGhostRatio, 0.4),
        abstraction_deficit_index: exports.DEFAULT_ABSTRACTION_DEFICIT_INDEX_LIMIT,
        variant_without_contract_cluster_count: exports.DEFAULT_VARIANT_WITHOUT_CONTRACT_CLUSTER_LIMIT,
        zero_abstraction_hotspot_count: exports.DEFAULT_ZERO_ABSTRACTION_HOTSPOT_LIMIT,
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
    const metrics = {
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
        triad_completeness_violations: triadCompleteness.leftOnlyVertices.length +
            triadCompleteness.rightOnlyVertices.length +
            triadCompleteness.emptyVertices.length +
            triadCompleteness.scaleMixingVertices.length,
        c2c_coupling_count: c2cFindings.length,
        c2c_coupling_hotspots: c2cFindings.filter((f) => f.confidence >= 0.7).length,
        protocol_focus_alignment_violations: focusAlignment.alignmentViolations.length,
        focus_closure_violations: focusClosure.closureViolations.length
    };
    const checks = [];
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
        });
    }
    checks.push(evaluateNumericThreshold('diagnostics_no_code', metrics.diagnostics_no_code, thresholds.diagnostics_no_code, '<='), evaluateNumericThreshold('execute_like_ratio', metrics.execute_like_ratio, thresholds.execute_like_ratio, '<'), evaluateNumericThreshold('ghost_ratio', metrics.ghost_ratio, thresholds.ghost_ratio, '<'));
    if (runtimeMap) {
        checks.push(evaluateBooleanThreshold('rendered_edges_consistency', metrics.rendered_edges_consistency, thresholds.rendered_edges_consistency));
    }
    else {
        checks.push({
            key: 'rendered_edges_consistency',
            status: 'skip',
            expected: 'runtime-map.json present',
            actual: null,
            detail: 'Skipped rendered edge consistency check because runtime-map.json is missing'
        });
    }
    checks.push(evaluateOptionalNumericThreshold('runtime_unmatched_route_count', metrics.runtime_unmatched_route_count, thresholds.runtime_unmatched_route_count));
    checks.push(evaluateBooleanThreshold('ghost_policy_compliance', metrics.ghost_policy_violations === 0, thresholds.ghost_policy_compliance, metrics.ghost_policy_violations > 0
        ? ghostPolicyViolations.join('; ')
        : 'Language ghost policy constraints satisfied'));
    checks.push(evaluateNumericThreshold('left_only_vertices', metrics.left_only_vertices, thresholds.left_only_vertices, '<=', buildTriadViolationDetail('Left-only vertices', triadCompleteness.leftOnlyVertices)));
    checks.push(evaluateNumericThreshold('right_only_vertices', metrics.right_only_vertices, thresholds.right_only_vertices, '<=', buildTriadViolationDetail('Right-only vertices', triadCompleteness.rightOnlyVertices)));
    checks.push(evaluateNumericThreshold('empty_vertices', metrics.empty_vertices, thresholds.empty_vertices, '<=', buildTriadViolationDetail('Empty vertices', triadCompleteness.emptyVertices)));
    checks.push(evaluateNumericThreshold('scale_mixing_vertices', metrics.scale_mixing_vertices, thresholds.scale_mixing_vertices, '<=', buildTriadViolationDetail('Scale-mixing vertices', triadCompleteness.scaleMixingVertices)));
    checks.push(evaluateBooleanThreshold('triad_completeness', metrics.triad_completeness_violations === 0, thresholds.triad_completeness, metrics.triad_completeness_violations > 0
        ? [
            buildTriadViolationDetail('Left-only vertices', triadCompleteness.leftOnlyVertices),
            buildTriadViolationDetail('Right-only vertices', triadCompleteness.rightOnlyVertices),
            buildTriadViolationDetail('Empty vertices', triadCompleteness.emptyVertices),
            buildTriadViolationDetail('Scale-mixing vertices', triadCompleteness.scaleMixingVertices)
        ]
            .filter((item) => !item.endsWith('none'))
            .join('; ')
        : 'Triad completeness checks satisfied'));
    if (focusAlignment.artifactsInspected.length > 0) {
        checks.push(evaluateBooleanThreshold('protocol_focus_alignment', metrics.protocol_focus_alignment_violations === 0, thresholds.protocol_focus_alignment, metrics.protocol_focus_alignment_violations > 0
            ? buildTriadViolationDetail('Protocol focus alignment', focusAlignment.alignmentViolations)
            : 'draft-protocol.json and micro-split.json stay on the same triadization focus'));
    }
    else {
        checks.push({
            key: 'protocol_focus_alignment',
            status: 'skip',
            expected: 'draft-protocol.json or micro-split.json present',
            actual: null,
            detail: 'Skipped protocol focus alignment because no triadization focus artifacts were found'
        });
    }
    if (focusClosure.focusReference) {
        checks.push(evaluateBooleanThreshold('triad_focus_closure', metrics.focus_closure_violations === 0, thresholds.triad_focus_closure, metrics.focus_closure_violations > 0
            ? buildTriadViolationDetail('Triad focus closure', focusClosure.closureViolations)
            : `Focused class closes around ${focusClosure.focusReference.triadizationFocus}`));
    }
    else {
        checks.push({
            key: 'triad_focus_closure',
            status: 'skip',
            expected: 'triadizationFocus available',
            actual: null,
            detail: 'Skipped triad focus closure because no canonical triadization focus could be resolved'
        });
    }
    checks.push(...buildAbstractionGovernanceChecks(metrics, thresholds, abstractionGovernance));
    const report = {
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
        passed: checks.every((check) => check.status !== 'fail'),
        focus: {
            scope: requestedFocus,
            fallbackToFull: requestedFocus === 'impact' && !impactSummary.available,
            originalTriadNodes: allTriadNodes.length,
            scopedTriadNodes: effectiveTriadNodes.length,
            impactProtocolFile: paths.impactProtocolFile
        },
        baseline: baseline
            ? {
                path: resolveBaselinePath(paths, options.baselinePath),
                runtime_unmatched_route_count: baseline.runtime_unmatched_route_count
            }
            : undefined
    };
    if (options.updateBaseline) {
        writeVerifyBaseline(resolveBaselinePath(paths, options.baselinePath), metrics.runtime_unmatched_route_count, report.generatedAt);
    }
    return report;
}
function formatVerifyReport(report) {
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
function evaluateNumericThreshold(key, actual, expected, operator, detailHint) {
    const pass = operator === '<' ? actual < expected : actual <= expected;
    return {
        key,
        status: pass ? 'pass' : 'fail',
        expected,
        actual,
        detail: detailHint ?? (operator === '<' ? `must be < ${expected}` : `must be <= ${expected}`)
    };
}
function evaluateBooleanThreshold(key, actual, expected, detailHint) {
    const pass = actual === expected;
    return {
        key,
        status: pass ? 'pass' : 'fail',
        expected,
        actual,
        detail: detailHint ?? `must equal ${expected}`
    };
}
function evaluateOptionalNumericThreshold(key, actual, expected) {
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
        detail: `must be <= ${expected}`
    };
}
function buildAbstractionGovernanceSnapshot(effectiveTriadNodes) {
    const summaries = (0, analyzer_1.calculateAbstractionSummaryBySourcePath)(Array.isArray(effectiveTriadNodes) ? effectiveTriadNodes : []);
    const profiledSummaries = summaries.filter((summary) => summary.abstractionSignalCount + summary.concreteSignalCount > 0);
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
    const flatVariantClusters = (0, analyzer_1.detectFlatVariantClusters)(effectiveTriadNodes).filter((cluster) => profiledSources.has(cluster.sourcePath));
    const uncoveredVariantClusters = flatVariantClusters.filter((cluster) => !cluster.contractCoverage);
    const hotspots = (0, analyzer_1.detectAbstractionDeficitHotspots)(effectiveTriadNodes, {
        minConcreteSignals: exports.DEFAULT_ABSTRACTION_HOTSPOT_MIN_CONCRETE_SIGNALS,
        maxAbstractionRatio: exports.DEFAULT_ABSTRACTION_HOTSPOT_MAX_RATIO
    }).filter((hotspot) => profiledSources.has(hotspot.sourcePath));
    const zeroAbstractionHotspots = hotspots.filter((hotspot) => hotspot.abstractionSignalCount === 0);
    const totalSignals = abstractionSignalCount + concreteSignalCount;
    const abstractionCoveragePressure = totalSignals > 0 ? 1 - abstractionSignalCount / totalSignals : 0;
    const variantPressure = clampNumber(uncoveredVariantClusters.length / Math.max(1, profiledSummaries.length), 0, 1);
    const hotspotPressure = clampNumber(hotspots.length / Math.max(1, profiledSummaries.length), 0, 1);
    return {
        profiledSourceCount: profiledSummaries.length,
        abstractionSignalCount,
        concreteSignalCount,
        flatVariantClusterCount: flatVariantClusters.length,
        variantWithoutContractClusterCount: uncoveredVariantClusters.length,
        abstractionHotspotCount: hotspots.length,
        zeroAbstractionHotspotCount: zeroAbstractionHotspots.length,
        abstractionDeficitIndex: Number(clampNumber(abstractionCoveragePressure * 0.5 + variantPressure * 0.25 + hotspotPressure * 0.25, 0, 1).toFixed(6)),
        uncoveredVariantClusters,
        hotspots
    };
}
function buildAbstractionGovernanceChecks(metrics, thresholds, snapshot) {
    if (snapshot.profiledSourceCount === 0) {
        return [
            createAbstractionGovernanceSkipCheck('abstraction_deficit_index'),
            createAbstractionGovernanceSkipCheck('variant_without_contract_cluster_count'),
            createAbstractionGovernanceSkipCheck('zero_abstraction_hotspot_count')
        ];
    }
    return [
        evaluateNumericThreshold('abstraction_deficit_index', metrics.abstraction_deficit_index, thresholds.abstraction_deficit_index, '<', buildAbstractionDeficitDetail(snapshot)),
        evaluateNumericThreshold('variant_without_contract_cluster_count', metrics.variant_without_contract_cluster_count, thresholds.variant_without_contract_cluster_count, '<=', buildVariantClusterDetail(snapshot.uncoveredVariantClusters)),
        evaluateNumericThreshold('zero_abstraction_hotspot_count', metrics.zero_abstraction_hotspot_count, thresholds.zero_abstraction_hotspot_count, '<=', buildAbstractionHotspotDetail(snapshot.hotspots))
    ];
}
function createAbstractionGovernanceSkipCheck(key) {
    return {
        key,
        status: 'skip',
        expected: 'abstraction evidence coverage present',
        actual: null,
        detail: 'Skipped abstraction governance because triad-map nodes do not contain abstraction signal counts yet'
    };
}
function buildAbstractionDeficitDetail(snapshot) {
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
function buildVariantClusterDetail(clusters) {
    if (clusters.length === 0) {
        return 'Flat variant clusters without contract coverage: none';
    }
    return `Flat variant clusters without contract coverage: ${clusters
        .slice(0, 4)
        .map((cluster) => `${cluster.sourcePath}#${cluster.cluster} (${cluster.nodeIds.length} nodes)`)
        .join(', ')}`;
}
function buildAbstractionHotspotDetail(hotspots) {
    if (hotspots.length === 0) {
        return 'Zero-abstraction hotspots: none';
    }
    return `Abstraction hotspots: ${hotspots
        .slice(0, 4)
        .map((hotspot) => `${hotspot.sourcePath} (${hotspot.reason})`)
        .join(', ')}`;
}
function writeVerifyBaseline(baselinePath, unmatchedCount, generatedAt) {
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
    fs.writeFileSync(baselinePath, JSON.stringify({
        generatedAt,
        runtime_unmatched_route_count: Math.max(0, Math.floor(unmatchedCount))
    }, null, 2), 'utf-8');
}
function resolveBaselinePath(paths, overridePath) {
    const raw = String(overridePath ?? '').trim();
    if (!raw) {
        return paths.verifyBaselineFile;
    }
    return path.isAbsolute(raw) ? raw : path.resolve(paths.projectRoot, raw);
}
function isExecuteLikeNodeId(nodeId) {
    if (!nodeId) {
        return false;
    }
    return EXECUTE_LIKE_METHOD_PATTERN.test(String(nodeId));
}
function buildTriadViolationDetail(title, values) {
    return values.length === 0 ? `${title}: none` : `${title}: ${values.slice(0, 6).join(', ')}`;
}
function safeRatio(part, total) {
    if (!total) {
        return 0;
    }
    return Number((part / total).toFixed(6));
}
function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function normalizeRatioThreshold(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return value;
    }
    return fallback;
}
//# sourceMappingURL=verify.js.map