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
exports.generateTrendArtifacts = generateTrendArtifacts;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const analyzer_1 = require("./analyzer");
const analyzerOptionsSupport_1 = require("./analyzerOptionsSupport");
const artifactReaders_1 = require("./artifactReaders");
const config_1 = require("./config");
const stableArchitectureAnchorSupport_1 = require("./stableArchitectureAnchorSupport");
const topologyRiskSupport_1 = require("./topologyRiskSupport");
const verify_1 = require("./verify");
function generateTrendArtifacts(paths, options = {}) {
    const snapshot = createTrendSnapshot(paths);
    const previousHistory = readTrendHistory(paths.trendFile);
    const previousSnapshot = previousHistory.snapshots[previousHistory.snapshots.length - 1];
    const report = createTrendDeltaReport(snapshot, previousSnapshot, options.maxEdgeDiff ?? 50);
    const historyWindow = normalizePositiveInteger(options.historyWindow, 26);
    const nextHistory = {
        schemaVersion: '1.0',
        updatedAt: snapshot.generatedAt,
        snapshots: [...previousHistory.snapshots, snapshot].slice(-historyWindow)
    };
    fs.mkdirSync(path.dirname(paths.trendFile), { recursive: true });
    fs.writeFileSync(paths.trendFile, JSON.stringify(nextHistory, null, 2), 'utf-8');
    fs.writeFileSync(paths.trendReportFile, renderTrendMarkdown(report), 'utf-8');
    return {
        history: nextHistory,
        report
    };
}
function createTrendSnapshot(paths) {
    const triadMap = (0, artifactReaders_1.readTriadNodesArtifact)(paths.mapFile);
    const runtimeMap = (0, artifactReaders_1.readRuntimeMapArtifact)(paths.runtimeMapFile);
    const verifyReport = (0, verify_1.runTopologyVerify)(paths);
    const config = (0, config_1.loadTriadConfig)(paths);
    const stableAnchorResolution = (0, stableArchitectureAnchorSupport_1.resolveEffectiveStableAnchors)(paths, config.topologyRisk);
    const analyzerOptions = (0, analyzerOptionsSupport_1.resolveAnalyzerOptionsFromConfig)(config, stableAnchorResolution.stableAnchors);
    const triadEdges = (0, analyzer_1.calculateProducerConsumerEdges)(triadMap, analyzerOptions);
    const inDegreeByNode = new Map();
    const outDegreeByNode = new Map();
    for (const edge of triadEdges) {
        outDegreeByNode.set(edge.from, (outDegreeByNode.get(edge.from) ?? 0) + 1);
        inDegreeByNode.set(edge.to, (inDegreeByNode.get(edge.to) ?? 0) + 1);
    }
    const riskNodes = [];
    const supportLayerNodes = [];
    const ghostNoiseNodes = [];
    const matureStableNodes = [];
    const centralityByNode = {};
    for (const node of triadMap) {
        const nodeId = String(node?.nodeId ?? '').trim();
        if (!nodeId) {
            continue;
        }
        const inDegree = inDegreeByNode.get(nodeId) ?? 0;
        const outDegree = outDegreeByNode.get(nodeId) ?? 0;
        const degree = inDegree + outDegree;
        const ghost = (0, topologyRiskSupport_1.hasGhostDemand)(node);
        const executeLike = /execute/i.test(nodeId);
        const riskScore = degree + (ghost ? 5 : 0) + (executeLike ? 1 : 0);
        const baseRiskNode = {
            nodeId,
            sourcePath: node.sourcePath,
            inDegree,
            outDegree,
            degree,
            ghost,
            executeLike,
            riskScore,
            classification: 'structural'
        };
        centralityByNode[nodeId] = degree;
        if ((0, topologyRiskSupport_1.isMatureStableArchitectureNode)(node, stableAnchorResolution.stableAnchors)) {
            if (outDegree >= 5 || inDegree >= 5 || degree >= 8) {
                matureStableNodes.push({
                    ...baseRiskNode,
                    classification: 'mature_stable'
                });
            }
            continue;
        }
        if ((0, topologyRiskSupport_1.isSupportLayerAggregateNode)(node)) {
            if (outDegree >= 5 || degree >= 8) {
                supportLayerNodes.push({
                    ...baseRiskNode,
                    classification: 'support_layer'
                });
            }
            continue;
        }
        if ((0, topologyRiskSupport_1.isGhostNoiseNode)(node, degree, executeLike)) {
            ghostNoiseNodes.push({
                ...baseRiskNode,
                classification: 'ghost_noise'
            });
            continue;
        }
        if (!(0, topologyRiskSupport_1.isStructuralRiskCandidate)(node)) {
            continue;
        }
        riskNodes.push(baseRiskNode);
    }
    const highRiskNodes = riskNodes
        .filter((node) => node.ghost || node.inDegree >= 5 || node.outDegree >= 5 || node.degree >= 8)
        .sort((left, right) => right.riskScore - left.riskScore || left.nodeId.localeCompare(right.nodeId))
        .slice(0, 80);
    const rankedSupportLayerNodes = supportLayerNodes
        .sort((left, right) => right.riskScore - left.riskScore || left.nodeId.localeCompare(right.nodeId))
        .slice(0, 80);
    const rankedGhostNoiseNodes = ghostNoiseNodes
        .sort((left, right) => right.riskScore - left.riskScore || left.nodeId.localeCompare(right.nodeId))
        .slice(0, 80);
    const rankedMatureStableNodes = matureStableNodes
        .sort((left, right) => right.riskScore - left.riskScore || left.nodeId.localeCompare(right.nodeId))
        .slice(0, 80);
    const triadEdgeKeys = triadEdges
        .map((edge) => `${edge.from}::${edge.contract}::${edge.to}`)
        .sort((left, right) => left.localeCompare(right));
    const runtimeEdgeKeys = (runtimeMap?.edges ?? [])
        .map((edge) => `${edge.from}::${edge.type}::${edge.to}`)
        .sort((left, right) => left.localeCompare(right));
    return {
        generatedAt: new Date().toISOString(),
        triadNodeCount: triadMap.length,
        triadEdgeCount: triadEdges.length,
        runtimeNodeCount: runtimeMap?.nodes?.length ?? 0,
        runtimeEdgeCount: runtimeMap?.edges?.length ?? 0,
        executeLikeRatio: verifyReport.metrics.execute_like_ratio,
        ghostRatio: verifyReport.metrics.ghost_ratio,
        diagnosticsNoCode: verifyReport.metrics.diagnostics_no_code,
        highRiskNodes,
        supportLayerNodes: rankedSupportLayerNodes,
        ghostNoiseNodes: rankedGhostNoiseNodes,
        matureStableNodes: rankedMatureStableNodes,
        centralityByNode,
        triadEdgeKeys,
        runtimeEdgeKeys
    };
}
function createTrendDeltaReport(snapshot, previous, maxEdgeDiff) {
    const previousHighRiskSet = new Set((previous?.highRiskNodes ?? []).map((node) => node.nodeId));
    const currentHighRiskSet = new Set(snapshot.highRiskNodes.map((node) => node.nodeId));
    const highRiskAdded = snapshot.highRiskNodes.filter((node) => !previousHighRiskSet.has(node.nodeId));
    const highRiskRemoved = (previous?.highRiskNodes ?? []).filter((node) => !currentHighRiskSet.has(node.nodeId));
    const centralitySurges = previous ? computeCentralitySurges(snapshot.centralityByNode, previous.centralityByNode ?? {}) : [];
    const addedTriadEdges = diffSet(snapshot.triadEdgeKeys, previous?.triadEdgeKeys ?? []).slice(0, maxEdgeDiff);
    const removedTriadEdges = diffSet(previous?.triadEdgeKeys ?? [], snapshot.triadEdgeKeys).slice(0, maxEdgeDiff);
    const addedRuntimeEdges = diffSet(snapshot.runtimeEdgeKeys, previous?.runtimeEdgeKeys ?? []).slice(0, maxEdgeDiff);
    const removedRuntimeEdges = diffSet(previous?.runtimeEdgeKeys ?? [], snapshot.runtimeEdgeKeys).slice(0, maxEdgeDiff);
    const summary = [
        `Current topology: triad=${snapshot.triadNodeCount} nodes/${snapshot.triadEdgeCount} edges, runtime=${snapshot.runtimeNodeCount} nodes/${snapshot.runtimeEdgeCount} edges`,
        `Governance: execute_like_ratio=${snapshot.executeLikeRatio.toFixed(3)}, ghost_ratio=${snapshot.ghostRatio.toFixed(3)}, diagnostics_no_code=${snapshot.diagnosticsNoCode}`,
        `High-risk nodes: total=${snapshot.highRiskNodes.length}, added=${highRiskAdded.length}, removed=${highRiskRemoved.length}`,
        `Support-layer hubs: total=${snapshot.supportLayerNodes.length}`,
        `Ghost-only noise candidates: total=${snapshot.ghostNoiseNodes.length}`,
        `Mature stable anchors: total=${snapshot.matureStableNodes.length}`,
        `Centrality surges: ${centralitySurges.length} node(s) changed >= 3`,
        `Edge drift: triad +${addedTriadEdges.length} / -${removedTriadEdges.length}, runtime +${addedRuntimeEdges.length} / -${removedRuntimeEdges.length}`
    ];
    return {
        generatedAt: snapshot.generatedAt,
        previousGeneratedAt: previous?.generatedAt,
        summary,
        highRiskAdded,
        highRiskRemoved,
        centralitySurges,
        addedTriadEdges,
        removedTriadEdges,
        addedRuntimeEdges,
        removedRuntimeEdges,
        snapshot
    };
}
function renderTrendMarkdown(report) {
    const lines = [];
    lines.push('# TriadMind Architecture Drift Weekly Report');
    lines.push('');
    lines.push(`- GeneratedAt: ${report.generatedAt}`);
    lines.push(`- PreviousSnapshot: ${report.previousGeneratedAt ?? 'N/A'}`);
    lines.push('');
    lines.push('## Summary');
    report.summary.forEach((entry) => lines.push(`- ${entry}`));
    lines.push('');
    lines.push('## High-Risk Nodes Added');
    if (report.highRiskAdded.length === 0) {
        lines.push('- None');
    }
    else {
        report.highRiskAdded.slice(0, 30).forEach((node) => {
            lines.push(`- ${node.nodeId} (degree=${node.degree}, in=${node.inDegree}, out=${node.outDegree}, ghost=${node.ghost}, source=${node.sourcePath ?? '-'})`);
        });
    }
    lines.push('');
    lines.push('## Support-Layer Hubs');
    if (report.snapshot.supportLayerNodes.length === 0) {
        lines.push('- None');
    }
    else {
        report.snapshot.supportLayerNodes.slice(0, 30).forEach((node) => {
            lines.push(`- ${node.nodeId} (degree=${node.degree}, in=${node.inDegree}, out=${node.outDegree}, ghost=${node.ghost}, source=${node.sourcePath ?? '-'})`);
        });
    }
    lines.push('');
    lines.push('## Ghost-Only Noise Candidates');
    if (report.snapshot.ghostNoiseNodes.length === 0) {
        lines.push('- None');
    }
    else {
        report.snapshot.ghostNoiseNodes.slice(0, 30).forEach((node) => {
            lines.push(`- ${node.nodeId} (degree=${node.degree}, in=${node.inDegree}, out=${node.outDegree}, ghost=${node.ghost}, source=${node.sourcePath ?? '-'})`);
        });
    }
    lines.push('');
    lines.push('## Mature Stable Anchors');
    if (report.snapshot.matureStableNodes.length === 0) {
        lines.push('- None');
    }
    else {
        report.snapshot.matureStableNodes.slice(0, 30).forEach((node) => {
            lines.push(`- ${node.nodeId} (degree=${node.degree}, in=${node.inDegree}, out=${node.outDegree}, ghost=${node.ghost}, source=${node.sourcePath ?? '-'})`);
        });
    }
    lines.push('');
    lines.push('## Centrality Surges');
    if (report.centralitySurges.length === 0) {
        lines.push('- None');
    }
    else {
        report.centralitySurges.slice(0, 30).forEach((item) => {
            lines.push(`- ${item.nodeId}: ${item.previousDegree} -> ${item.currentDegree} (delta=${item.delta})`);
        });
    }
    lines.push('');
    lines.push('## Key Chain Drift (Triad)');
    lines.push(`- Added: ${report.addedTriadEdges.length}`);
    report.addedTriadEdges.slice(0, 25).forEach((edge) => lines.push(`  - + ${edge}`));
    lines.push(`- Removed: ${report.removedTriadEdges.length}`);
    report.removedTriadEdges.slice(0, 25).forEach((edge) => lines.push(`  - - ${edge}`));
    lines.push('');
    lines.push('## Key Chain Drift (Runtime)');
    lines.push(`- Added: ${report.addedRuntimeEdges.length}`);
    report.addedRuntimeEdges.slice(0, 25).forEach((edge) => lines.push(`  - + ${edge}`));
    lines.push(`- Removed: ${report.removedRuntimeEdges.length}`);
    report.removedRuntimeEdges.slice(0, 25).forEach((edge) => lines.push(`  - - ${edge}`));
    lines.push('');
    return lines.join('\n');
}
function computeCentralitySurges(current, previous) {
    const nodeIds = new Set([...Object.keys(current), ...Object.keys(previous)]);
    const surges = [];
    for (const nodeId of nodeIds) {
        const previousDegree = previous[nodeId] ?? 0;
        const currentDegree = current[nodeId] ?? 0;
        const delta = currentDegree - previousDegree;
        if (Math.abs(delta) < 3) {
            continue;
        }
        surges.push({
            nodeId,
            previousDegree,
            currentDegree,
            delta
        });
    }
    return surges.sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || left.nodeId.localeCompare(right.nodeId));
}
function diffSet(left, right) {
    const rightSet = new Set(right);
    return left.filter((entry) => !rightSet.has(entry));
}
function readRuntimeMap(filePath) {
    return (0, artifactReaders_1.readRuntimeMapArtifact)(filePath);
}
function readTrendHistory(filePath) {
    const result = (0, artifactReaders_1.readJsonObjectArtifactResult)(filePath);
    const parsed = result.status === 'ok' ? result.value : undefined;
    if (!parsed || !Array.isArray(parsed.snapshots)) {
        return {
            schemaVersion: '1.0',
            updatedAt: new Date(0).toISOString(),
            snapshots: []
        };
    }
    return {
        schemaVersion: '1.0',
        updatedAt: String(parsed.updatedAt ?? new Date(0).toISOString()),
        snapshots: parsed.snapshots
            .filter((item) => item && typeof item === 'object')
            .map((item) => ({
            ...item,
            highRiskNodes: Array.isArray(item.highRiskNodes) ? item.highRiskNodes : [],
            supportLayerNodes: Array.isArray(item.supportLayerNodes)
                ? item.supportLayerNodes
                : [],
            ghostNoiseNodes: Array.isArray(item.ghostNoiseNodes)
                ? item.ghostNoiseNodes
                : [],
            matureStableNodes: Array.isArray(item.matureStableNodes)
                ? item.matureStableNodes
                : [],
            centralityByNode: item.centralityByNode ?? {},
            triadEdgeKeys: Array.isArray(item.triadEdgeKeys) ? item.triadEdgeKeys : [],
            runtimeEdgeKeys: Array.isArray(item.runtimeEdgeKeys) ? item.runtimeEdgeKeys : []
        }))
    };
}
function normalizePositiveInteger(value, fallback) {
    if (Number.isFinite(value) && value > 0) {
        return Math.floor(value);
    }
    return fallback;
}
//# sourceMappingURL=trend.js.map