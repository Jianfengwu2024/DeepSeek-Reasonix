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
exports.runDreamAnalysis = runDreamAnalysis;
exports.loadLatestDreamReport = loadLatestDreamReport;
exports.formatDreamReport = formatDreamReport;
exports.buildDreamQuickHints = buildDreamQuickHints;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const analyzer_1 = require("./analyzer");
const analyzerOptionsSupport_1 = require("./analyzerOptionsSupport");
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
const dreamFeedbackSupport_1 = require("./dreamFeedbackSupport");
const impactTierSupport_1 = require("./impactTierSupport");
const stableArchitectureAnchorSupport_1 = require("./stableArchitectureAnchorSupport");
const topologyRiskSupport_1 = require("./topologyRiskSupport");
const verify_1 = require("./verify");
const EXECUTE_LIKE_METHOD_PATTERN = /execute/i;
const GHOST_DEMAND_PATTERN = /^\[Ghost:[^\]]+\]/i;
const UNMATCHED_ROUTE_DIAGNOSTIC_CODE = 'RUNTIME_FRONTEND_API_ROUTE_UNMATCHED';
const DEFAULT_EXECUTE_RATIO_LIMIT = 0.1;
const DEFAULT_GHOST_RATIO_LIMIT = 0.4;
const FANOUT_ALERT_THRESHOLD = 6;
async function runDreamAnalysis(paths, options = {}) {
    const config = (0, config_1.loadTriadConfig)(paths);
    const dreamConfig = normalizeDreamConfig(config.dream, options);
    const mode = normalizeDreamMode(options.mode, dreamConfig.idleOnly);
    const now = new Date();
    const generatedAt = now.toISOString();
    const diagnostics = [];
    const metrics = (0, verify_1.runTopologyVerify)(paths, { strict: false }).metrics;
    const state = readDreamState(paths.dreamStateFile);
    if (!dreamConfig.enabled && !options.force) {
        const report = createSkippedReport(paths, generatedAt, mode, dreamConfig, metrics, 'Dream analysis disabled by config.dream.enabled=false', diagnostics);
        persistDreamArtifacts(paths, report, state);
        return buildDreamResult(paths, report);
    }
    if (mode === 'idle' && !options.force && isIdleGateBlocked(state.lastRunAt, dreamConfig.minHoursBetweenRuns, now)) {
        const report = createSkippedReport(paths, generatedAt, mode, dreamConfig, metrics, `Idle gate active: wait at least ${dreamConfig.minHoursBetweenRuns} hour(s) between runs`, diagnostics);
        persistDreamArtifacts(paths, report, state);
        return buildDreamResult(paths, report);
    }
    const triadNodes = readTriadNodes(paths.mapFile, diagnostics);
    const runtimeMap = readRuntimeMap(paths.runtimeMapFile, diagnostics);
    const runtimeDiagnostics = readRuntimeDiagnostics(paths.runtimeDiagnosticsFile, diagnostics);
    const feedbackLoad = (0, dreamFeedbackSupport_1.loadDreamFeedbackLedger)(paths);
    emitDreamFeedbackLoadDiagnostics(diagnostics, feedbackLoad.status, paths.dreamFeedbackFile);
    const effectiveStableAnchors = (0, stableArchitectureAnchorSupport_1.resolveEffectiveStableAnchorsFromSources)({
        configTopologyRisk: config.topologyRisk,
        feedbackLedger: feedbackLoad.ledger
    });
    const analyzerOptions = (0, analyzerOptionsSupport_1.resolveAnalyzerOptionsFromConfig)(config, effectiveStableAnchors);
    const stableExemptNodeIds = new Set(triadNodes
        .filter((node) => (0, topologyRiskSupport_1.isMatureStableArchitectureNode)(node, analyzerOptions))
        .map((node) => String(node.nodeId ?? '').trim())
        .filter(Boolean));
    const stableExemptNodes = triadNodes.filter((node) => stableExemptNodeIds.has(String(node.nodeId ?? '').trim()));
    const nonStableTriadNodes = triadNodes.filter((node) => !stableExemptNodeIds.has(String(node.nodeId ?? '').trim()));
    const impactSummary = (0, impactTierSupport_1.loadImpactTierSummary)(paths, triadNodes, config, analyzerOptions);
    const scopedTriadNodes = (0, impactTierSupport_1.filterNodesForImpactThreshold)(nonStableTriadNodes, impactSummary, options.impactThreshold, {
        keepWhenUnavailable: true
    });
    emitDreamImpactTierDiagnostics(diagnostics, triadNodes.length, scopedTriadNodes.length, stableExemptNodes.length, impactSummary.notes, options.impactThreshold);
    const abstractionSnapshot = buildDreamAbstractionSnapshot(scopedTriadNodes);
    const fanoutDetection = detectHighFanoutNodes(scopedTriadNodes, FANOUT_ALERT_THRESHOLD, analyzerOptions);
    emitDreamStableAnchorDiagnostics(diagnostics, stableExemptNodes
        .map((node) => ({
        nodeId: String(node.nodeId ?? '').trim(),
        downstreamCount: 0,
        downstreamNodeIds: []
    }))
        .filter((entry) => entry.nodeId), triadNodes);
    const findings = buildDreamFindings(metrics, scopedTriadNodes, runtimeDiagnostics, fanoutDetection.actionableNodes, abstractionSnapshot);
    const validatedProposals = validateProposalConsistency(buildDreamProposals(paths, findings, scopedTriadNodes, runtimeDiagnostics, fanoutDetection.actionableNodes, abstractionSnapshot), config, diagnostics);
    const feedbackFiltered = applyDreamFeedbackRejections(validatedProposals, feedbackLoad.ledger, diagnostics);
    const proposals = rankAndFilterProposals(feedbackFiltered.proposals, dreamConfig.minConfidence, dreamConfig.maxProposals);
    const summary = buildSummary(metrics, findings, proposals, runtimeMap, feedbackFiltered.suppressed, fanoutDetection.matureStableNodes, abstractionSnapshot);
    const report = {
        schemaVersion: '1.0',
        project: path.basename(paths.projectRoot),
        generatedAt,
        mode,
        skipped: false,
        config: {
            enabled: dreamConfig.enabled,
            idleOnly: dreamConfig.idleOnly,
            minHoursBetweenRuns: dreamConfig.minHoursBetweenRuns,
            minConfidence: dreamConfig.minConfidence,
            maxProposals: dreamConfig.maxProposals,
            impactThreshold: options.impactThreshold
        },
        metrics,
        findings,
        proposals,
        diagnostics,
        summary
    };
    persistDreamArtifacts(paths, report, state, mode);
    return buildDreamResult(paths, report);
}
function loadLatestDreamReport(paths) {
    return (0, artifactReaders_1.readJsonIfExists)(paths.dreamReportFile);
}
function formatDreamReport(report) {
    const lines = [];
    const status = report.skipped ? 'SKIP' : 'PASS';
    lines.push(`TriadMind Dream (${status})`);
    lines.push(`generatedAt=${report.generatedAt}`);
    lines.push(`mode=${report.mode}, skipped=${report.skipped ? 'true' : 'false'}`);
    if (report.skipReason) {
        lines.push(`skip_reason=${report.skipReason}`);
    }
    lines.push(`metrics: execute_like_ratio=${report.metrics.execute_like_ratio.toFixed(3)}, ghost_ratio=${report.metrics.ghost_ratio.toFixed(3)}, abstraction_deficit_index=${report.metrics.abstraction_deficit_index.toFixed(3)}, runtime_unmatched_route_count=${report.metrics.runtime_unmatched_route_count}`);
    lines.push(`runtime: nodes=${report.metrics.runtime_nodes}, edges=${report.metrics.runtime_edges}, rendered_edges_consistency=${report.metrics.rendered_edges_consistency}`);
    lines.push(`findings=${report.findings.length}, proposals=${report.proposals.length}, diagnostics=${report.diagnostics.length}`);
    report.summary.forEach((entry) => lines.push(`- ${entry}`));
    report.proposals.slice(0, 6).forEach((proposal) => {
        lines.push(`* [${proposal.priority.toUpperCase()}] ${proposal.id} confidence=${proposal.confidence.toFixed(2)} :: ${proposal.title}`);
    });
    return lines.join('\n');
}
function createSkippedReport(paths, generatedAt, mode, config, metrics, reason, diagnostics) {
    diagnostics.push({
        level: 'info',
        code: 'DREAM_RUN_SKIPPED',
        component: 'DreamRunner',
        message: reason
    });
    return {
        schemaVersion: '1.0',
        project: path.basename(paths.projectRoot),
        generatedAt,
        mode,
        skipped: true,
        skipReason: reason,
        config: {
            enabled: config.enabled,
            idleOnly: config.idleOnly,
            minHoursBetweenRuns: config.minHoursBetweenRuns,
            minConfidence: config.minConfidence,
            maxProposals: config.maxProposals
        },
        metrics,
        findings: [],
        proposals: [],
        diagnostics,
        summary: [reason]
    };
}
function buildDreamFindings(metrics, triadNodes, runtimeDiagnostics, fanoutNodes, abstractionSnapshot) {
    const findings = [];
    if (metrics.execute_like_ratio >= DEFAULT_EXECUTE_RATIO_LIMIT) {
        findings.push({
            id: 'FINDING_EXECUTE_RATIO_HIGH',
            type: 'metric',
            severity: 'warning',
            title: 'execute-like ratio is high',
            description: `execute-like capability nodes occupy ${(metrics.execute_like_ratio * 100).toFixed(1)}% of triad map.`,
            metric: 'execute_like_ratio',
            currentValue: metrics.execute_like_ratio,
            targetValue: DEFAULT_EXECUTE_RATIO_LIMIT,
            confidence: ratioConfidence(metrics.execute_like_ratio, DEFAULT_EXECUTE_RATIO_LIMIT),
            evidence: collectTopExecuteEvidence(triadNodes, 6)
        });
    }
    if (metrics.ghost_ratio >= DEFAULT_GHOST_RATIO_LIMIT) {
        findings.push({
            id: 'FINDING_GHOST_RATIO_HIGH',
            type: 'metric',
            severity: 'warning',
            title: 'ghost ratio is high',
            description: `ghost demand appears in ${(metrics.ghost_ratio * 100).toFixed(1)}% of capability nodes.`,
            metric: 'ghost_ratio',
            currentValue: metrics.ghost_ratio,
            targetValue: DEFAULT_GHOST_RATIO_LIMIT,
            confidence: ratioConfidence(metrics.ghost_ratio, DEFAULT_GHOST_RATIO_LIMIT),
            evidence: collectTopGhostEvidence(triadNodes, 6)
        });
    }
    if (metrics.runtime_unmatched_route_count > 0) {
        findings.push({
            id: 'FINDING_RUNTIME_UNMATCHED_ROUTES',
            type: 'runtime',
            severity: metrics.runtime_unmatched_route_count > 22 ? 'error' : 'warning',
            title: 'frontend API calls are not fully matched',
            description: `Detected ${metrics.runtime_unmatched_route_count} unmatched frontend API route call(s).`,
            metric: 'runtime_unmatched_route_count',
            currentValue: metrics.runtime_unmatched_route_count,
            targetValue: '<= 22',
            confidence: clampNumber(0.55 + metrics.runtime_unmatched_route_count * 0.02, 0, 0.95),
            evidence: collectUnmatchedRouteEvidence(runtimeDiagnostics, 8)
        });
    }
    if (!metrics.rendered_edges_consistency) {
        findings.push({
            id: 'FINDING_RUNTIME_RENDER_INCONSISTENT',
            type: 'runtime',
            severity: 'error',
            title: 'runtime rendered edges mismatch runtime-map',
            description: `Rendered edges=${metrics.rendered_runtime_edges}, runtime map edges=${metrics.runtime_edges}.`,
            metric: 'rendered_edges_consistency',
            currentValue: metrics.rendered_edges_consistency,
            targetValue: true,
            confidence: 0.9,
            evidence: [
                {
                    type: 'metric',
                    key: 'rendered_runtime_edges',
                    value: String(metrics.rendered_runtime_edges)
                },
                {
                    type: 'metric',
                    key: 'runtime_edges',
                    value: String(metrics.runtime_edges)
                }
            ]
        });
    }
    if (metrics.diagnostics_no_code > 0) {
        findings.push({
            id: 'FINDING_RUNTIME_DIAGNOSTICS_NO_CODE',
            type: 'governance',
            severity: 'error',
            title: 'runtime diagnostics have missing code',
            description: `${metrics.diagnostics_no_code} runtime diagnostic item(s) do not contain code.`,
            metric: 'diagnostics_no_code',
            currentValue: metrics.diagnostics_no_code,
            targetValue: 0,
            confidence: 0.95,
            evidence: [
                {
                    type: 'metric',
                    key: 'diagnostics_no_code',
                    value: String(metrics.diagnostics_no_code)
                }
            ]
        });
    }
    if (fanoutNodes.length > 0) {
        findings.push({
            id: 'FINDING_HIGH_FANOUT_CAPABILITY',
            type: 'topology',
            severity: 'warning',
            title: 'high-fanout capability detected',
            description: `${fanoutNodes.length} node(s) exceed downstream fanout threshold ${FANOUT_ALERT_THRESHOLD}.`,
            metric: 'fanout',
            currentValue: fanoutNodes.length,
            targetValue: `0 nodes >= ${FANOUT_ALERT_THRESHOLD}`,
            confidence: 0.76,
            evidence: fanoutNodes.slice(0, 6).map((item) => ({
                type: 'node',
                key: item.nodeId,
                value: `${item.downstreamCount} downstream nodes`
            }))
        });
    }
    if (abstractionSnapshot.profiledSourceCount > 0 &&
        metrics.abstraction_deficit_index >= verify_1.DEFAULT_ABSTRACTION_DEFICIT_INDEX_LIMIT) {
        findings.push({
            id: 'FINDING_ABSTRACTION_DEFICIT_HIGH',
            type: 'governance',
            severity: metrics.abstraction_deficit_index >= 0.85 ? 'error' : 'warning',
            title: 'abstraction deficit is building up',
            description: `Abstraction deficit index reached ${metrics.abstraction_deficit_index.toFixed(3)} across ${abstractionSnapshot.profiledSourceCount} profiled source(s).`,
            metric: 'abstraction_deficit_index',
            currentValue: metrics.abstraction_deficit_index,
            targetValue: `< ${verify_1.DEFAULT_ABSTRACTION_DEFICIT_INDEX_LIMIT}`,
            confidence: ratioConfidence(metrics.abstraction_deficit_index, verify_1.DEFAULT_ABSTRACTION_DEFICIT_INDEX_LIMIT),
            evidence: collectAbstractionHotspotEvidence(abstractionSnapshot.hotspots, metrics)
        });
    }
    if (abstractionSnapshot.uncoveredVariantClusters.length > 0) {
        findings.push({
            id: 'FINDING_VARIANT_CLUSTER_WITHOUT_CONTRACT',
            type: 'governance',
            severity: abstractionSnapshot.zeroAbstractionHotspots.length > 0 ? 'warning' : 'info',
            title: 'flat variant cluster lacks shared contract coverage',
            description: `Detected ${abstractionSnapshot.uncoveredVariantClusters.length} concrete variant cluster(s) growing without a shared interface or abstract anchor.`,
            metric: 'variant_without_contract_cluster_count',
            currentValue: metrics.variant_without_contract_cluster_count,
            targetValue: 0,
            confidence: clampNumber(0.68 + abstractionSnapshot.uncoveredVariantClusters.length * 0.04, 0, 0.94),
            evidence: collectVariantClusterEvidence(abstractionSnapshot.uncoveredVariantClusters)
        });
    }
    const c2cCoupling = (0, analyzer_1.detectC2cCoupling)(triadNodes, {});
    if (c2cCoupling.length > 0) {
        const highConfidenceCount = c2cCoupling.filter((f) => f.confidence >= 0.7).length;
        findings.push({
            id: 'FINDING_C2C_COUPLING_DETECTED',
            type: 'governance',
            severity: highConfidenceCount > 0 ? 'warning' : 'info',
            title: 'concrete-to-concrete coupling detected',
            description: `Detected ${c2cCoupling.length} source path(s) with concrete-to-concrete coupling risk (${highConfidenceCount} high confidence).`,
            metric: 'c2c_coupling_count',
            currentValue: c2cCoupling.length,
            targetValue: '< 3',
            confidence: clampNumber(0.55 + c2cCoupling.length * 0.03, 0, 0.92),
            evidence: c2cCoupling.slice(0, 6).map((f) => ({
                type: 'metric',
                key: f.sourcePath,
                value: `${f.concreteClassCount} concrete / ${f.interfaceCount} interfaces (confidence=${f.confidence.toFixed(2)})`
            }))
        });
    }
    return findings.sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
}
function buildDreamProposals(paths, findings, triadNodes, runtimeDiagnostics, fanoutNodes, abstractionSnapshot) {
    const proposals = [];
    const findingIndex = new Map(findings.map((item) => [item.id, item]));
    const nodeById = new Map(triadNodes
        .map((node) => ({
        nodeId: String(node?.nodeId ?? '').trim(),
        node
    }))
        .filter((item) => item.nodeId)
        .map((item) => [item.nodeId, item.node]));
    const executeFinding = findingIndex.get('FINDING_EXECUTE_RATIO_HIGH');
    if (executeFinding) {
        const executeNodes = triadNodes
            .filter((node) => isExecuteLikeNodeId(node.nodeId))
            .slice(0, 4);
        proposals.push({
            id: 'DREAM_CAPABILITY_EXECUTE_DENOISE',
            title: 'Reduce execute-like capability dominance',
            priority: 'high',
            confidence: clampNumber(executeFinding.confidence, 0, 0.92),
            objective: 'Split generic execute orchestration into explicit business capabilities.',
            expectedOutcome: 'execute_like_ratio trends down and blast-radius impact becomes more explicit.',
            actions: [
                'Promote business verbs over generic execute/run naming for capability anchors.',
                'Split orchestration-heavy execute nodes into child capabilities with explicit contracts.',
                'Run `triadmind sync --force` + `triadmind verify --strict` after refactor.'
            ],
            linkedFindings: [executeFinding.id],
            evidence: executeFinding.evidence,
            protocolDraft: buildExecuteDenoiseProtocol(paths, executeNodes)
        });
    }
    const ghostFinding = findingIndex.get('FINDING_GHOST_RATIO_HIGH');
    if (ghostFinding) {
        proposals.push({
            id: 'DREAM_GHOST_SIGNAL_REBALANCE',
            title: 'Rebalance ghost signals into evidence layer',
            priority: 'high',
            confidence: clampNumber(ghostFinding.confidence, 0, 0.9),
            objective: 'Keep main capability graph readable while preserving ghost evidence for drill-down.',
            expectedOutcome: 'ghost_ratio drops under governance threshold without losing traceability.',
            actions: [
                'Apply language-aware ghost policy: dynamic languages keep ghost in evidence only.',
                'Retain only high-confidence Top-K ghost reads in demand for static languages.',
                'Audit retained ghost entries by confidence and business relevance.'
            ],
            linkedFindings: [ghostFinding.id],
            evidence: [...ghostFinding.evidence, ...enrichGhostPolicyEvidence(triadNodes).slice(0, 4)]
        });
    }
    const unmatchedFinding = findingIndex.get('FINDING_RUNTIME_UNMATCHED_ROUTES');
    if (unmatchedFinding) {
        proposals.push({
            id: 'DREAM_RUNTIME_ROUTE_ALIGNMENT',
            title: 'Improve frontend-to-api route matching',
            priority: 'medium',
            confidence: clampNumber(unmatchedFinding.confidence, 0, 0.88),
            objective: 'Reduce runtime unmatched route warnings and improve request-flow confidence.',
            expectedOutcome: 'runtime_unmatched_route_count declines and request-flow graph becomes actionable.',
            actions: [
                'Normalize frontend URL paths before matching: template params, query strip, duplicated slash collapse.',
                'Align dynamic segment forms (`{id}` / `:id` / `[id]` / `${id}`) to unified token `:param`.',
                'Add extractor evidence with raw path + normalized path for all unmatched calls.'
            ],
            linkedFindings: [unmatchedFinding.id],
            evidence: collectUnmatchedRouteEvidence(runtimeDiagnostics, 10)
        });
    }
    const fanoutFinding = findingIndex.get('FINDING_HIGH_FANOUT_CAPABILITY');
    if (fanoutFinding && fanoutNodes.length > 0) {
        const target = fanoutNodes[0];
        const targetNode = nodeById.get(target.nodeId);
        proposals.push({
            id: `DREAM_SPLIT_HIGH_FANOUT_${sanitizeId(target.nodeId)}`,
            title: `Split high-fanout capability ${target.nodeId}`,
            priority: 'medium',
            confidence: 0.79,
            objective: 'Reduce implicit coupling by separating orchestration and resource concerns.',
            expectedOutcome: 'Fanout risk drops and downstream dependency chains become easier to reason about.',
            actions: [
                `Create dedicated child capability under ${target.nodeId} to isolate orchestration steps.`,
                'Move cross-cutting side effects (queue/cache/external API) into explicit runtime nodes.',
                'Regenerate trend and verify artifacts to confirm fanout reduction.'
            ],
            linkedFindings: [fanoutFinding.id],
            evidence: fanoutFinding.evidence,
            protocolDraft: buildHighFanoutSplitProtocol(paths, target, targetNode)
        });
    }
    const renderFinding = findingIndex.get('FINDING_RUNTIME_RENDER_INCONSISTENT');
    if (renderFinding) {
        proposals.push({
            id: 'DREAM_RUNTIME_RENDER_PARITY',
            title: 'Restore runtime rendered edge parity',
            priority: 'high',
            confidence: 0.9,
            objective: 'Guarantee runtime visualizer edge count equals runtime-map edge count by default.',
            expectedOutcome: 'rendered_edges_consistency remains true in strict verify/govern checks.',
            actions: [
                'Keep runtime visualizer default maxRenderEdges unset (no cap).',
                'Allow edge cap only via explicit CLI option and log when cap is active.',
                'Add regression test for rendered edge consistency.'
            ],
            linkedFindings: [renderFinding.id],
            evidence: renderFinding.evidence
        });
    }
    const diagnosticsFinding = findingIndex.get('FINDING_RUNTIME_DIAGNOSTICS_NO_CODE');
    if (diagnosticsFinding) {
        proposals.push({
            id: 'DREAM_DIAGNOSTICS_CONTRACT_ENFORCEMENT',
            title: 'Enforce diagnostic code contract',
            priority: 'high',
            confidence: 0.95,
            objective: 'Ensure all runtime diagnostics are machine-governable by stable code.',
            expectedOutcome: 'diagnostics_no_code remains zero and issue triage becomes automatable.',
            actions: [
                'Require `level/code/extractor/message` for all runtime diagnostic writes.',
                'Normalize unknown diagnostics to fallback code `RUNTIME_UNKNOWN_DIAGNOSTIC`.',
                'Add contract test that fails when any runtime diagnostic lacks code.'
            ],
            linkedFindings: [diagnosticsFinding.id],
            evidence: diagnosticsFinding.evidence
        });
    }
    const abstractionFinding = findingIndex.get('FINDING_ABSTRACTION_DEFICIT_HIGH');
    const variantClusterFinding = findingIndex.get('FINDING_VARIANT_CLUSTER_WITHOUT_CONTRACT');
    if ((abstractionFinding || variantClusterFinding) && abstractionSnapshot.profiledSourceCount > 0) {
        const primaryCluster = abstractionSnapshot.uncoveredVariantClusters[0];
        const primaryHotspot = abstractionSnapshot.hotspots[0];
        const representativeNode = resolveAbstractionProposalTargetNode(triadNodes, primaryCluster, primaryHotspot);
        if (representativeNode) {
            const linkedFindings = [abstractionFinding?.id, variantClusterFinding?.id].filter(Boolean);
            const proposalEvidence = [
                ...(variantClusterFinding?.evidence ?? []),
                ...(abstractionFinding?.evidence ?? [])
            ].slice(0, 10);
            const clusterLabel = primaryCluster?.cluster ? ` ${primaryCluster.cluster}` : '';
            proposals.push({
                id: `DREAM_EXTRACT_CORE_ABSTRACTION_${sanitizeId(primaryCluster?.cluster ?? representativeNode.nodeId)}`,
                title: `Extract Core Abstraction for${clusterLabel || ` ${representativeNode.nodeId}`}`,
                priority: 'high',
                confidence: clampNumber(Math.max(abstractionFinding?.confidence ?? 0.72, variantClusterFinding?.confidence ?? 0.74), 0, 0.93),
                category: representativeNode.category ?? 'unknown',
                sourcePath: representativeNode.sourcePath,
                objective: 'Force the next feature increment to land behind an explicit contract instead of another concrete branch.',
                expectedOutcome: 'Variant growth moves behind a shared interface/abstract class and concrete-to-concrete coupling stops compounding.',
                actions: [
                    'Extract one shared interface or abstract class before adding the next concrete variant.',
                    'Move variant selection into a factory or strategy dispatch entrypoint instead of flat sibling functions.',
                    'Make existing variants implement the new contract and rerun `triadmind verify --strict`.'
                ],
                linkedFindings,
                evidence: proposalEvidence,
                protocolDraft: buildAbstractionExtractionProtocol(paths, representativeNode, primaryCluster, abstractionFinding?.id)
            });
        }
    }
    return proposals;
}
function buildExecuteDenoiseProtocol(paths, executeNodes) {
    const existingNodeIds = new Set(executeNodes.map((node) => String(node.nodeId ?? '').trim()).filter(Boolean));
    const actions = executeNodes
        .filter((node) => String(node.nodeId ?? '').trim())
        .slice(0, 3)
        .map((node, index) => {
        const parentNodeId = String(node.nodeId ?? '').trim();
        const childNodeId = deriveChildNodeId(parentNodeId, `stage${index + 1}`, existingNodeIds);
        return {
            op: 'create_child',
            parentNodeId,
            node: {
                nodeId: childNodeId,
                category: node.category ?? 'core',
                sourcePath: node.sourcePath,
                fission: {
                    problem: `Refine orchestration stage for ${parentNodeId}`,
                    demand: Array.isArray(node.fission?.demand) && node.fission.demand.length > 0
                        ? node.fission.demand.slice(0, 3)
                        : ['None'],
                    answer: Array.isArray(node.fission?.answer) && node.fission.answer.length > 0
                        ? node.fission.answer.slice(0, 1)
                        : ['void']
                }
            },
            reason: 'Dream proposal: reduce execute-like concentration via explicit child capability',
            confidence: 0.7
        };
    });
    if (actions.length === 0) {
        return undefined;
    }
    const allowedOps = ['reuse', 'modify', 'create_child'];
    return {
        protocolVersion: '1.0',
        project: path.basename(paths.projectRoot),
        mapSource: paths.mapFile.replace(/\\/g, '/'),
        userDemand: 'Dream proposal: reduce execute-like capability concentration',
        upgradePolicy: {
            allowedOps,
            principle: 'reuse-first with explicit orchestration split'
        },
        actions
    };
}
function buildHighFanoutSplitProtocol(paths, target, targetNode) {
    const childNodeId = deriveChildNodeId(target.nodeId, 'orchestrateFlow', new Set([target.nodeId]));
    const allowedOps = ['reuse', 'modify', 'create_child'];
    return {
        protocolVersion: '1.0',
        project: path.basename(paths.projectRoot),
        mapSource: paths.mapFile.replace(/\\/g, '/'),
        userDemand: `Dream proposal: split high-fanout capability ${target.nodeId}`,
        upgradePolicy: {
            allowedOps,
            principle: 'reduce fanout by moving orchestration to dedicated child capability'
        },
        actions: [
            {
                op: 'create_child',
                parentNodeId: target.nodeId,
                node: {
                    nodeId: childNodeId,
                    category: targetNode?.category ?? 'core',
                    sourcePath: targetNode?.sourcePath,
                    fission: {
                        problem: `Extract orchestration flow from ${target.nodeId}`,
                        demand: Array.isArray(targetNode?.fission?.demand) && targetNode.fission.demand.length > 0
                            ? targetNode.fission.demand.slice(0, 3)
                            : ['None'],
                        answer: Array.isArray(targetNode?.fission?.answer) && targetNode.fission.answer.length > 0
                            ? targetNode.fission.answer.slice(0, 1)
                            : ['void']
                    }
                },
                reason: `Dream proposal: downstream fanout=${target.downstreamCount}`,
                confidence: 0.74
            }
        ]
    };
}
function buildAbstractionExtractionProtocol(paths, representativeNode, cluster, linkedFindingId) {
    const parentNodeId = String(representativeNode.nodeId ?? '').trim();
    if (!parentNodeId) {
        return undefined;
    }
    const contractSuffix = `${sanitizeId(cluster?.cluster ?? 'core')}Contract`;
    const contractNodeId = deriveChildNodeId(parentNodeId, contractSuffix, new Set([parentNodeId]));
    const allowedOps = ['reuse', 'modify', 'create_child'];
    return {
        protocolVersion: '1.0',
        project: path.basename(paths.projectRoot),
        mapSource: paths.mapFile.replace(/\\/g, '/'),
        userDemand: `Dream proposal: extract shared abstraction for ${cluster?.cluster ?? representativeNode.nodeId}`,
        upgradePolicy: {
            allowedOps,
            principle: 'introduce the contract first, then let concrete variants converge behind it'
        },
        actions: [
            {
                op: 'create_child',
                parentNodeId,
                node: {
                    nodeId: contractNodeId,
                    category: representativeNode.category ?? 'core',
                    sourcePath: representativeNode.sourcePath,
                    fission: {
                        problem: `Define shared abstraction for ${cluster?.cluster ?? representativeNode.nodeId} variants`,
                        demand: Array.isArray(representativeNode.fission?.demand) && representativeNode.fission.demand.length > 0
                            ? representativeNode.fission.demand.slice(0, 3)
                            : ['None'],
                        answer: Array.isArray(representativeNode.fission?.answer) && representativeNode.fission.answer.length > 0
                            ? representativeNode.fission.answer.slice(0, 1)
                            : ['void'],
                        evidence: {
                            abstraction: {
                                role: 'abstraction',
                                signals: ['dream_extracted_contract'],
                                variantCluster: cluster?.cluster,
                                abstractionSignalCount: 1,
                                concreteSignalCount: 0
                            }
                        }
                    }
                },
                reason: linkedFindingId
                    ? `Dream proposal: ${linkedFindingId} indicates a missing abstraction spine`
                    : 'Dream proposal: extract shared abstraction',
                confidence: 0.78
            }
        ]
    };
}
function rankAndFilterProposals(proposals, minConfidence, maxProposals) {
    return proposals
        .filter((proposal) => proposal.confidence >= minConfidence)
        .sort((left, right) => {
        const priorityDiff = proposalPriorityRank(right.priority) - proposalPriorityRank(left.priority);
        if (priorityDiff !== 0) {
            return priorityDiff;
        }
        return right.confidence - left.confidence || left.id.localeCompare(right.id);
    })
        .slice(0, maxProposals);
}
function applyDreamFeedbackRejections(proposals, ledger, diagnostics) {
    const latestRejections = (0, dreamFeedbackSupport_1.indexLatestDreamRejectionsBySignature)(ledger);
    if (latestRejections.size === 0) {
        return {
            proposals,
            suppressed: []
        };
    }
    const retained = [];
    const suppressed = [];
    for (const proposal of proposals) {
        const rejection = latestRejections.get((0, dreamFeedbackSupport_1.buildDreamProposalFeedbackSignature)(proposal));
        if (!rejection) {
            retained.push(proposal);
            continue;
        }
        diagnostics.push({
            level: 'info',
            code: 'DREAM_PROPOSAL_SUPPRESSED_BY_FEEDBACK',
            component: 'DreamFeedbackMemory',
            message: `Proposal ${proposal.id} suppressed by recorded rejection from ${rejection.reviewerRole}:${rejection.reviewer} at ${rejection.recordedAt}: ${rejection.reason}`,
            sourcePath: proposal.sourcePath
        });
        suppressed.push({
            proposal,
            rejection
        });
    }
    return {
        proposals: retained,
        suppressed
    };
}
function validateProposalConsistency(proposals, config, diagnostics) {
    return proposals.map((proposal) => {
        const protocolDraft = canonicalizeProtocolDraft(proposal, config, diagnostics);
        const sourcePath = normalizeProposalSourcePath(proposal.sourcePath ??
            extractProposalSourcePathFromProtocolDraft(protocolDraft) ??
            extractProposalSourcePathFromEvidence(proposal));
        const previousCategory = normalizeProposalCategory(proposal.category);
        const resolvedCategory = sourcePath ? (0, config_1.resolveCategoryFromConfig)(sourcePath, config) : 'unknown';
        emitCategoryConsistencyDiagnostics({
            diagnostics,
            proposalId: proposal.id,
            scope: 'proposal',
            previousCategory,
            resolvedCategory,
            sourcePath
        });
        return {
            ...proposal,
            protocolDraft,
            category: resolvedCategory,
            sourcePath: sourcePath || undefined
        };
    });
}
function normalizeProposalCategory(value) {
    if (value === 'frontend' || value === 'backend' || value === 'core' || value === 'unknown') {
        return value;
    }
    return 'unknown';
}
function normalizeProposalSourcePath(value) {
    const normalized = String(value ?? '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\.?\//, '')
        .replace(/\/{2,}/g, '/');
    return normalized || '';
}
function extractProposalSourcePathFromProtocolDraft(protocolDraft) {
    const actions = Array.isArray(protocolDraft?.actions) ? protocolDraft.actions : [];
    for (const action of actions) {
        if (action?.op === 'create_child' && typeof action?.node?.sourcePath === 'string') {
            const normalized = normalizeProposalSourcePath(action.node.sourcePath);
            if (normalized) {
                return normalized;
            }
        }
        if (action?.op === 'modify' && typeof action?.sourcePath === 'string') {
            const normalized = normalizeProposalSourcePath(action.sourcePath);
            if (normalized) {
                return normalized;
            }
        }
    }
    return '';
}
function canonicalizeProtocolDraft(proposal, config, diagnostics) {
    if (!proposal.protocolDraft || !Array.isArray(proposal.protocolDraft.actions)) {
        return proposal.protocolDraft;
    }
    const protocolDraft = {
        ...proposal.protocolDraft,
        actions: proposal.protocolDraft.actions.map((action, actionIndex) => {
            if (action?.op === 'create_child' && action?.node) {
                const nodeSourcePath = normalizeProposalSourcePath(action.node.sourcePath);
                const previousNodeCategory = normalizeProposalCategory(action.node.category);
                const resolvedNodeCategory = nodeSourcePath ? (0, config_1.resolveCategoryFromConfig)(nodeSourcePath, config) : 'unknown';
                emitCategoryConsistencyDiagnostics({
                    diagnostics,
                    proposalId: proposal.id,
                    scope: 'protocolDraft.actions.node',
                    previousCategory: previousNodeCategory,
                    resolvedCategory: resolvedNodeCategory,
                    sourcePath: nodeSourcePath,
                    nodeId: action.node.nodeId,
                    actionIndex
                });
                return {
                    ...action,
                    node: {
                        ...action.node,
                        category: resolvedNodeCategory,
                        sourcePath: nodeSourcePath || undefined
                    }
                };
            }
            if (action?.op === 'modify') {
                const actionSourcePath = normalizeProposalSourcePath(action.sourcePath);
                const previousActionCategory = normalizeProposalCategory(action.category);
                const resolvedActionCategory = actionSourcePath ? (0, config_1.resolveCategoryFromConfig)(actionSourcePath, config) : 'unknown';
                emitCategoryConsistencyDiagnostics({
                    diagnostics,
                    proposalId: proposal.id,
                    scope: 'protocolDraft.actions',
                    previousCategory: previousActionCategory,
                    resolvedCategory: resolvedActionCategory,
                    sourcePath: actionSourcePath,
                    nodeId: action.nodeId,
                    actionIndex
                });
                return {
                    ...action,
                    category: resolvedActionCategory,
                    sourcePath: actionSourcePath || undefined
                };
            }
            return action;
        })
    };
    return protocolDraft;
}
function emitCategoryConsistencyDiagnostics(input) {
    const { diagnostics, proposalId, scope, previousCategory, resolvedCategory, sourcePath, nodeId, actionIndex } = input;
    const targetLabelParts = [`Proposal ${proposalId}`, scope];
    if (typeof actionIndex === 'number') {
        targetLabelParts.push(`action#${actionIndex}`);
    }
    if (nodeId) {
        targetLabelParts.push(`node=${nodeId}`);
    }
    const targetLabel = targetLabelParts.join(' | ');
    if (sourcePath && previousCategory !== resolvedCategory) {
        diagnostics.push({
            level: 'warning',
            code: 'DREAM_PROPOSAL_CATEGORY_MISMATCH_AUTO_FIXED',
            component: 'DreamProposalValidator',
            message: `${targetLabel} category auto-fixed: ${previousCategory} -> ${resolvedCategory}`,
            sourcePath
        });
    }
    if (resolvedCategory === 'unknown') {
        diagnostics.push({
            level: 'warning',
            code: 'DREAM_PROPOSAL_CATEGORY_UNRESOLVED',
            component: 'DreamProposalValidator',
            message: sourcePath
                ? `${targetLabel} sourcePath cannot map to configured categories; category=unknown`
                : `${targetLabel} has no resolvable sourcePath; category=unknown`,
            sourcePath: sourcePath || undefined
        });
    }
}
function extractProposalSourcePathFromEvidence(proposal) {
    for (const evidence of proposal.evidence) {
        if (typeof evidence?.sourcePath !== 'string') {
            continue;
        }
        const normalized = normalizeProposalSourcePath(evidence.sourcePath);
        if (normalized) {
            return normalized;
        }
    }
    return '';
}
function buildSummary(metrics, findings, proposals, runtimeMap, suppressed = [], matureStableNodes = [], abstractionSnapshot) {
    const topFinding = findings[0];
    const summary = [];
    summary.push(`Metrics snapshot: execute_like_ratio=${metrics.execute_like_ratio.toFixed(3)}, ghost_ratio=${metrics.ghost_ratio.toFixed(3)}, diagnostics_no_code=${metrics.diagnostics_no_code}, unmatched_routes=${metrics.runtime_unmatched_route_count}`);
    summary.push(`Runtime snapshot: nodes=${runtimeMap?.nodes?.length ?? 0}, edges=${runtimeMap?.edges?.length ?? 0}, rendered_edges_consistency=${metrics.rendered_edges_consistency}`);
    if (abstractionSnapshot.profiledSourceCount > 0) {
        summary.push(`Abstraction snapshot: profiled_sources=${abstractionSnapshot.profiledSourceCount}, abstraction_deficit_index=${metrics.abstraction_deficit_index.toFixed(3)}, uncovered_variant_clusters=${abstractionSnapshot.uncoveredVariantClusters.length}, hotspots=${abstractionSnapshot.hotspots.length}`);
    }
    else {
        summary.push('Abstraction snapshot: no abstraction evidence coverage detected yet, so governance stayed in observation mode.');
    }
    if (topFinding) {
        summary.push(`Top risk: ${topFinding.title} (${topFinding.severity}, confidence=${topFinding.confidence.toFixed(2)})`);
    }
    else {
        summary.push('No blocking risk detected in current topology metrics.');
    }
    summary.push(`Generated ${proposals.length} proposal(s) after confidence and Top-K filtering.`);
    if (suppressed.length > 0) {
        summary.push(`Suppressed ${suppressed.length} proposal(s) due to recorded Dream rejections: ${suppressed
            .slice(0, 3)
            .map((entry) => entry.proposal.id)
            .join(', ')}`);
    }
    if (matureStableNodes.length > 0) {
        summary.push(`Skipped ${matureStableNodes.length} mature/stable high-fanout anchor(s): ${matureStableNodes
            .slice(0, 3)
            .map((entry) => entry.nodeId)
            .join(', ')}`);
    }
    return summary;
}
function emitDreamFeedbackLoadDiagnostics(diagnostics, status, feedbackFile) {
    if (status === 'missing' || status === 'ok') {
        return;
    }
    diagnostics.push({
        level: 'warning',
        code: 'DREAM_FEEDBACK_MEMORY_INVALID',
        component: 'DreamFeedbackMemory',
        message: status === 'parse_failed'
            ? `Dream feedback memory could not be parsed: ${feedbackFile}`
            : `Dream feedback memory has invalid shape and was ignored: ${feedbackFile}`
    });
}
function emitDreamImpactTierDiagnostics(diagnostics, originalNodeCount, scopedNodeCount, stableExemptCount, notes, impactThreshold) {
    if (typeof impactThreshold === 'number') {
        diagnostics.push({
            level: 'info',
            code: 'DREAM_IMPACT_THRESHOLD_APPLIED',
            component: 'DreamRunner',
            message: `Impact threshold >= ${impactThreshold} scoped Dream analysis from ${originalNodeCount} to ${scopedNodeCount} node(s); stable anchors exempted=${stableExemptCount}`
        });
    }
    else if (stableExemptCount > 0) {
        diagnostics.push({
            level: 'info',
            code: 'DREAM_STABLE_ANCHORS_EXEMPTED',
            component: 'DreamRunner',
            message: `Exempted ${stableExemptCount} mature/stable architecture anchor node(s) from Dream proposal generation`
        });
    }
    for (const note of notes) {
        diagnostics.push({
            level: 'info',
            code: 'DREAM_IMPACT_TIER_NOTE',
            component: 'DreamRunner',
            message: note
        });
    }
}
function emitDreamStableAnchorDiagnostics(diagnostics, matureStableNodes, triadNodes) {
    if (matureStableNodes.length === 0) {
        return;
    }
    const nodeById = new Map(triadNodes
        .map((node) => [String(node?.nodeId ?? '').trim(), node])
        .filter(([nodeId]) => Boolean(nodeId)));
    for (const entry of matureStableNodes) {
        diagnostics.push({
            level: 'info',
            code: 'DREAM_HIGH_FANOUT_STABLE_ANCHOR_SKIPPED',
            component: 'DreamFanoutAnalysis',
            message: `High-fanout node ${entry.nodeId} skipped because it is declared as a mature/stable architecture anchor`,
            sourcePath: nodeById.get(entry.nodeId)?.sourcePath
        });
    }
}
function persistDreamArtifacts(paths, report, previousState, mode) {
    fs.mkdirSync(path.dirname(paths.dreamReportFile), { recursive: true });
    fs.writeFileSync(paths.dreamReportFile, JSON.stringify(report, null, 2), 'utf-8');
    fs.writeFileSync(paths.dreamDiagnosticsFile, JSON.stringify(report.diagnostics, null, 2), 'utf-8');
    fs.writeFileSync(paths.dreamProposalsFile, JSON.stringify({
        schemaVersion: '1.0',
        generatedAt: report.generatedAt,
        project: report.project,
        mode: report.mode,
        skipped: report.skipped,
        proposals: report.proposals
    }, null, 2), 'utf-8');
    if (!report.skipped) {
        const nextState = {
            schemaVersion: '1.0',
            updatedAt: report.generatedAt,
            lastRunAt: report.generatedAt,
            lastMode: mode ?? report.mode,
            runs: previousState.runs + 1,
            lastFindingCount: report.findings.length,
            lastProposalCount: report.proposals.length
        };
        fs.writeFileSync(paths.dreamStateFile, JSON.stringify(nextState, null, 2), 'utf-8');
        return;
    }
    const skippedState = {
        ...previousState,
        schemaVersion: '1.0',
        updatedAt: report.generatedAt
    };
    fs.writeFileSync(paths.dreamStateFile, JSON.stringify(skippedState, null, 2), 'utf-8');
}
function buildDreamResult(paths, report) {
    return {
        report,
        artifacts: {
            reportFile: paths.dreamReportFile,
            diagnosticsFile: paths.dreamDiagnosticsFile,
            proposalsFile: paths.dreamProposalsFile,
            stateFile: paths.dreamStateFile
        }
    };
}
function normalizeDreamConfig(config, options) {
    return {
        enabled: config.enabled,
        idleOnly: config.idleOnly,
        minHoursBetweenRuns: Math.max(1, Math.floor(config.minHoursBetweenRuns || 24)),
        minConfidence: normalizeConfidence(options.minConfidence, config.minConfidence),
        maxProposals: normalizePositiveInteger(options.maxProposals, config.maxProposals),
        failOnDreamError: config.failOnDreamError
    };
}
function normalizeDreamMode(mode, idleOnly) {
    if (mode === 'idle') {
        return 'idle';
    }
    if (mode === 'manual') {
        return 'manual';
    }
    return idleOnly ? 'idle' : 'manual';
}
function isIdleGateBlocked(lastRunAt, minHoursBetweenRuns, now) {
    if (!lastRunAt) {
        return false;
    }
    const parsed = Date.parse(lastRunAt);
    if (!Number.isFinite(parsed)) {
        return false;
    }
    const elapsedHours = (now.getTime() - parsed) / 3_600_000;
    return elapsedHours < minHoursBetweenRuns;
}
function readDreamState(filePath) {
    const parsed = (0, artifactReaders_1.readJsonIfExists)(filePath);
    return {
        schemaVersion: '1.0',
        updatedAt: String(parsed?.updatedAt ?? new Date(0).toISOString()),
        lastRunAt: typeof parsed?.lastRunAt === 'string' ? parsed.lastRunAt : undefined,
        lastMode: parsed?.lastMode === 'idle' || parsed?.lastMode === 'manual' ? parsed.lastMode : undefined,
        runs: normalizeNonNegativeInteger(parsed?.runs, 0),
        lastFindingCount: normalizeNonNegativeInteger(parsed?.lastFindingCount, 0),
        lastProposalCount: normalizeNonNegativeInteger(parsed?.lastProposalCount, 0)
    };
}
function readTriadNodes(filePath, diagnostics) {
    const result = (0, artifactReaders_1.readJsonArrayArtifactResult)(filePath);
    if (result.status === 'missing') {
        diagnostics.push({
            level: 'warning',
            code: 'DREAM_TRIAD_MAP_MISSING',
            component: 'DreamReader',
            message: `triad map missing: ${filePath}`
        });
        return [];
    }
    if (result.status !== 'ok') {
        diagnostics.push({
            level: 'error',
            code: 'DREAM_TRIAD_MAP_INVALID',
            component: 'DreamReader',
            message: `triad map is not a valid array: ${filePath}`
        });
        return [];
    }
    return result.value ?? [];
}
function readRuntimeMap(filePath, diagnostics) {
    const result = (0, artifactReaders_1.readJsonObjectArtifactResult)(filePath);
    if (result.status === 'missing') {
        diagnostics.push({
            level: 'warning',
            code: 'DREAM_RUNTIME_MAP_MISSING',
            component: 'DreamReader',
            message: `runtime map missing: ${filePath}`
        });
        return undefined;
    }
    if (result.status !== 'ok') {
        diagnostics.push({
            level: 'error',
            code: 'DREAM_RUNTIME_MAP_INVALID',
            component: 'DreamReader',
            message: `runtime map is invalid JSON object: ${filePath}`
        });
        return undefined;
    }
    return result.value;
}
function readRuntimeDiagnostics(filePath, diagnostics) {
    const result = (0, artifactReaders_1.readJsonArrayArtifactResult)(filePath);
    if (result.status === 'missing') {
        diagnostics.push({
            level: 'warning',
            code: 'DREAM_RUNTIME_DIAGNOSTICS_MISSING',
            component: 'DreamReader',
            message: `runtime diagnostics missing: ${filePath}`
        });
        return [];
    }
    if (result.status !== 'ok') {
        diagnostics.push({
            level: 'error',
            code: 'DREAM_RUNTIME_DIAGNOSTICS_INVALID',
            component: 'DreamReader',
            message: `runtime diagnostics is not an array: ${filePath}`
        });
        return [];
    }
    return result.value ?? [];
}
function collectTopExecuteEvidence(nodes, limit) {
    return nodes
        .filter((node) => isExecuteLikeNodeId(node.nodeId))
        .slice(0, limit)
        .map((node) => ({
        type: 'node',
        key: String(node.nodeId ?? 'unknown'),
        value: String(node.fission?.problem ?? 'execute-like capability'),
        sourcePath: node.sourcePath
    }));
}
function collectTopGhostEvidence(nodes, limit) {
    return nodes
        .filter((node) => (0, topologyRiskSupport_1.hasGhostDemand)(node))
        .slice(0, limit)
        .map((node) => ({
        type: 'node',
        key: String(node.nodeId ?? 'unknown'),
        value: summarizeGhostDemand(node.fission?.demand ?? []),
        sourcePath: node.sourcePath
    }));
}
function collectUnmatchedRouteEvidence(diagnostics, limit) {
    return diagnostics
        .filter((item) => String(item?.code ?? '').toUpperCase() === UNMATCHED_ROUTE_DIAGNOSTIC_CODE)
        .slice(0, limit)
        .map((item, index) => ({
        type: 'diagnostic',
        key: `unmatched_${index + 1}`,
        value: extractRouteHint(String(item.message ?? 'unmatched route')),
        sourcePath: item.sourcePath
    }));
}
function collectAbstractionHotspotEvidence(hotspots, metrics) {
    const evidence = [
        {
            type: 'metric',
            key: 'abstraction_deficit_index',
            value: metrics.abstraction_deficit_index.toFixed(3)
        },
        {
            type: 'metric',
            key: 'variant_without_contract_cluster_count',
            value: String(metrics.variant_without_contract_cluster_count)
        },
        {
            type: 'metric',
            key: 'abstraction_hotspot_count',
            value: String(metrics.abstraction_hotspot_count)
        }
    ];
    return evidence.concat(hotspots.slice(0, 5).map((hotspot) => ({
        type: 'node',
        key: hotspot.sourcePath,
        value: `${hotspot.reason}; ratio=${hotspot.abstractionRatio.toFixed(3)}`,
        sourcePath: hotspot.sourcePath
    })));
}
function collectVariantClusterEvidence(clusters) {
    return clusters.slice(0, 5).map((cluster) => ({
        type: 'node',
        key: `${cluster.sourcePath}#${cluster.cluster}`,
        value: `${cluster.nodeIds.length} concrete variant node(s) without contract coverage`,
        sourcePath: cluster.sourcePath
    }));
}
function buildDreamAbstractionSnapshot(triadNodes) {
    const summaries = (0, analyzer_1.calculateAbstractionSummaryBySourcePath)(triadNodes);
    const profiledSources = new Set(summaries
        .filter((summary) => summary.abstractionSignalCount + summary.concreteSignalCount > 0)
        .map((summary) => summary.sourcePath));
    if (profiledSources.size === 0) {
        return {
            profiledSourceCount: 0,
            uncoveredVariantClusters: [],
            hotspots: [],
            zeroAbstractionHotspots: []
        };
    }
    const uncoveredVariantClusters = (0, analyzer_1.detectFlatVariantClusters)(triadNodes).filter((cluster) => profiledSources.has(cluster.sourcePath) && !cluster.contractCoverage);
    const hotspots = (0, analyzer_1.detectAbstractionDeficitHotspots)(triadNodes, {
        minConcreteSignals: verify_1.DEFAULT_ABSTRACTION_HOTSPOT_MIN_CONCRETE_SIGNALS,
        maxAbstractionRatio: verify_1.DEFAULT_ABSTRACTION_HOTSPOT_MAX_RATIO
    }).filter((hotspot) => profiledSources.has(hotspot.sourcePath));
    return {
        profiledSourceCount: profiledSources.size,
        uncoveredVariantClusters,
        hotspots,
        zeroAbstractionHotspots: hotspots.filter((hotspot) => hotspot.abstractionSignalCount === 0)
    };
}
function resolveAbstractionProposalTargetNode(triadNodes, cluster, hotspot) {
    const preferredNodeIds = cluster?.nodeIds ?? [];
    for (const preferredNodeId of preferredNodeIds) {
        const candidate = triadNodes.find((node) => String(node.nodeId ?? '').trim() === preferredNodeId);
        if (candidate) {
            return candidate;
        }
    }
    if (hotspot?.sourcePath) {
        const candidate = triadNodes.find((node) => String(node.sourcePath ?? '').trim() === hotspot.sourcePath);
        if (candidate) {
            return candidate;
        }
    }
    return triadNodes[0];
}
function summarizeGhostDemand(demand) {
    const ghostEntries = demand.filter((entry) => GHOST_DEMAND_PATTERN.test(String(entry ?? '').trim()));
    if (ghostEntries.length === 0) {
        return 'ghost demand';
    }
    return ghostEntries.slice(0, 2).join('; ');
}
function extractRouteHint(message) {
    const match = message.match(/\/api[^\s'"]+/i);
    return match ? `${match[0]} | ${message}` : message;
}
function detectHighFanoutNodes(triadNodes, threshold, options) {
    const nodeById = new Map(triadNodes
        .map((node) => [String(node?.nodeId ?? '').trim(), node])
        .filter(([nodeId]) => Boolean(nodeId)));
    const actionableNodes = [];
    const matureStableNodes = [];
    for (const entry of (0, analyzer_1.calculateDownstreamFanoutNodes)(triadNodes, threshold, options)) {
        const node = nodeById.get(entry.nodeId);
        if (node && (0, topologyRiskSupport_1.isMatureStableArchitectureNode)(node, options)) {
            matureStableNodes.push(entry);
            continue;
        }
        if (!node || (0, topologyRiskSupport_1.isStructuralRiskCandidate)(node)) {
            actionableNodes.push(entry);
        }
    }
    return {
        actionableNodes,
        matureStableNodes
    };
}
function isExecuteLikeNodeId(nodeId) {
    return typeof nodeId === 'string' && EXECUTE_LIKE_METHOD_PATTERN.test(nodeId);
}
function deriveChildNodeId(parentNodeId, suffix, existingIds) {
    const trimmedParent = parentNodeId.trim();
    if (!trimmedParent) {
        return `DreamNode.${suffix}`;
    }
    const parts = trimmedParent.split('.').filter(Boolean);
    const className = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    const base = `${className}.${suffix}`;
    if (!existingIds.has(base)) {
        existingIds.add(base);
        return base;
    }
    let index = 2;
    while (existingIds.has(`${base}${index}`)) {
        index += 1;
    }
    const candidate = `${base}${index}`;
    existingIds.add(candidate);
    return candidate;
}
function ratioConfidence(actual, threshold) {
    const delta = Math.max(0, actual - threshold);
    const normalized = threshold <= 0 ? delta : delta / threshold;
    return clampNumber(0.6 + normalized * 0.25, 0, 0.95);
}
function severityRank(severity) {
    if (severity === 'error')
        return 3;
    if (severity === 'warning')
        return 2;
    return 1;
}
function proposalPriorityRank(priority) {
    if (priority === 'high')
        return 3;
    if (priority === 'medium')
        return 2;
    return 1;
}
function sanitizeId(value) {
    return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'proposal';
}
function normalizePositiveInteger(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.floor(value);
    }
    return fallback;
}
function normalizeNonNegativeInteger(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    return fallback;
}
function normalizeConfidence(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1) {
        return value;
    }
    return fallback;
}
function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function inferLanguageFromSourcePath(sourcePath) {
    const normalized = String(sourcePath ?? '').toLowerCase();
    if (/\.(ts|tsx|mts|cts)$/.test(normalized))
        return 'typescript';
    if (/\.(js|jsx|mjs|cjs)$/.test(normalized))
        return 'javascript';
    if (/\.py$/.test(normalized))
        return 'python';
    if (/\.go$/.test(normalized))
        return 'go';
    if (/\.rs$/.test(normalized))
        return 'rust';
    if (/\.(cc|cpp|cxx|hpp|hh|h)$/.test(normalized))
        return 'cpp';
    if (/\.java$/.test(normalized))
        return 'java';
    return 'unknown';
}
function enrichGhostPolicyEvidence(nodes) {
    const byLanguage = new Map();
    for (const node of nodes) {
        if (!(0, topologyRiskSupport_1.hasGhostDemand)(node)) {
            continue;
        }
        const language = inferLanguageFromSourcePath(node.sourcePath);
        byLanguage.set(language, (byLanguage.get(language) ?? 0) + 1);
    }
    return Array.from(byLanguage.entries()).map(([language, count]) => ({
        type: 'metric',
        key: `ghost_nodes_${language}`,
        value: String(count)
    }));
}
function buildDreamQuickHints(paths) {
    const report = loadLatestDreamReport(paths);
    if (!report) {
        return [];
    }
    const hints = [];
    const top = report.proposals[0];
    if (top) {
        hints.push(`Top proposal: ${top.title} (confidence=${top.confidence.toFixed(2)})`);
    }
    hints.push(`findings=${report.findings.length}, proposals=${report.proposals.length}`);
    return hints;
}
//# sourceMappingURL=dream.js.map