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
exports.generateDashboard = generateDashboard;
exports.generateImpactDashboard = generateImpactDashboard;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const protocol_1 = require("./protocol");
const analyzer_1 = require("./analyzer");
const analyzerOptionsSupport_1 = require("./analyzerOptionsSupport");
const config_1 = require("./config");
const workspace_1 = require("./workspace");
const STATUS_COLORS = {
    existing: { background: '#7fb0e6', border: '#f8fbff', highlight: '#ffffff' },
    reused: { background: '#8a6510', border: '#fff0b3', highlight: '#fff7d9' },
    modified: { background: '#9a4b1e', border: '#ffd7bb', highlight: '#ffefe3' },
    new: { background: '#0284c7', border: '#e0f7ff', highlight: '#ffffff' },
    protocol: { background: '#5b4ee6', border: '#f0e7ff', highlight: '#ffffff' },
    left_branch: { background: '#15803d', border: '#dfffe8', highlight: '#ffffff' },
    right_branch: { background: '#7c3aed', border: '#f4ebff', highlight: '#ffffff' },
    macro: { background: '#be123c', border: '#ffe4eb', highlight: '#ffffff' }
};
const COMMUNITY_COLORS = {
    frontend: '#4E79A7',
    backend: '#F28E2B',
    core: '#59A14F',
    protocol: '#B07AA1',
    macro: '#E15759'
};
const COMMUNITY_FALLBACK_PALETTE = ['#4E79A7', '#F28E2B', '#59A14F', '#E15759', '#76B7B2', '#EDC949', '#AF7AA1', '#FF9DA7'];
const MACRO_CLUSTER_PALETTE = ['#f43f5e', '#38bdf8', '#f59e0b', '#22c55e', '#a78bfa', '#14b8a6'];
function generateDashboard(mapPath, protocolPath, outputPath, dashboardOptions = {}) {
    generateVisualizerDashboard(mapPath, protocolPath, outputPath, dashboardOptions, 'review');
}
function generateImpactDashboard(mapPath, protocol, outputPath, dashboardOptions = {}) {
    const rendered = generateVisualizerDashboard(mapPath, protocol, outputPath, dashboardOptions, 'impact');
    return {
        graph: rendered.graph,
        previewMap: rendered.previewMap,
        outputPath: rendered.outputPath
    };
}
function generateVisualizerDashboard(mapPath, protocolInput, outputPath, dashboardOptions, mode) {
    const startedAt = Date.now();
    const protocolPath = typeof protocolInput === 'string' ? protocolInput : '';
    if (!fs.existsSync(mapPath) || (typeof protocolInput === 'string' && !fs.existsSync(protocolPath))) {
        throw new Error(`Cannot find required TriadMind files. Map: ${mapPath}, Protocol: ${protocolPath || '[in-memory]'}`);
    }
    const projectRoot = resolveProjectRootFromMapPath(mapPath);
    const config = (0, config_1.loadTriadConfig)((0, workspace_1.getWorkspacePaths)(projectRoot));
    const originalMap = (0, protocol_1.readJsonFile)(mapPath);
    const protocol = typeof protocolInput === 'string' ? (0, protocol_1.readJsonFile)(protocolPath) : protocolInput;
    const renormalizeProtocol = readRenormalizeProtocol(mapPath, outputPath);
    const options = buildVisualizerOptions(config, originalMap, protocol, dashboardOptions);
    const graph = buildKnowledgeGraph(originalMap, protocol, renormalizeProtocol, options, mode);
    const previewMap = buildPreviewTopology(originalMap, protocol, mode);
    const mayaData = buildMayaPanelData(previewMap, protocol, renormalizeProtocol, options);
    fs.writeFileSync(outputPath, buildHtml(graph, protocol, mayaData, renormalizeProtocol, mode), 'utf-8');
    console.log(`[TriadMind] Visualizer mode: view=${options.defaultView} renderMode=${mode} strictFingerprint=${options.strictFingerprint} fastFallback=${mayaData.strictFingerprintSkipped} nodes=${graph.stats.nodes} edges=${graph.stats.edges}`);
    if (mayaData.strictFingerprintSkipped) {
        console.log('[TriadMind] Strict fingerprint skipped: fallback mode enabled');
    }
    if (mayaData.skippedOwnerCount > 0) {
        console.log(`[TriadMind] Fingerprint owners skipped: ${mayaData.skippedOwnerCount}`);
    }
    console.log(`[TriadMind] Dashboard generated in ${((Date.now() - startedAt) / 1000).toFixed(2)}s`);
    return {
        graph,
        previewMap,
        mayaData,
        protocol,
        outputPath
    };
}
function readRenormalizeProtocol(mapPath, outputPath) {
    const candidates = [
        outputPath.replace(/visualizer\.html$/i, 'renormalize-protocol.json'),
        mapPath.replace(/triad-map\.json$/i, 'renormalize-protocol.json')
    ];
    for (const candidate of candidates) {
        if (!fs.existsSync(candidate))
            continue;
        try {
            return (0, protocol_1.readJsonFile)(candidate);
        }
        catch {
            return undefined;
        }
    }
    return undefined;
}
function buildKnowledgeGraph(originalMap, protocol, renormalizeProtocol, options, mode = 'review') {
    const nodeMap = new Map();
    const edges = [];
    const previewMap = buildPreviewTopology(originalMap, protocol, mode);
    const highlightedOwnerIds = collectHighlightedOwnerIds(protocol, renormalizeProtocol);
    const baseContractEdgeKeys = new Set((0, analyzer_1.calculateProducerConsumerEdges)(originalMap, options.analyzer).map((edge) => `${edge.from}::${edge.to}::${edge.contract}`));
    if (mode !== 'impact') {
        nodeMap.set('__protocol__', {
            id: '__protocol__',
            label: 'Upgrade Protocol',
            status: 'protocol',
            lifecycle: 'existing',
            kind: 'protocol',
            category: 'protocol',
            sourcePath: protocol.mapSource ?? '',
            problem: protocol.userDemand ?? 'TriadMind topology upgrade protocol',
            demand: [],
            answer: [],
            community: 'protocol',
            communityName: 'Protocol',
            triadOwner: '__protocol__',
            branchTitle: 'Protocol vertex',
            absorbedNodes: [],
            rationale: protocol.userDemand ?? ''
        });
    }
    originalMap.forEach((node) => upsertTriadVertex(nodeMap, edges, node, 'existing', !options.compressExistingBranches || highlightedOwnerIds.has(node.nodeId), 'existing'));
    protocol.actions.forEach((action) => {
        if (action.op === 'reuse') {
            const node = ensureNode(nodeMap, edges, { nodeId: action.nodeId, fission: { problem: action.reason ?? 'Reused by protocol', demand: [], answer: [] } }, true);
            node.status = node.status === 'existing' ? 'reused' : node.status;
            if (mode !== 'impact') {
                edges.push({
                    from: '__protocol__',
                    to: action.nodeId,
                    type: 'reuse',
                    label: 'reuse',
                    title: action.reason ?? 'reuse existing node',
                    highlighted: false,
                    lifecycle: 'existing'
                });
            }
            return;
        }
        if (action.op === 'modify') {
            const node = ensureNode(nodeMap, edges, { nodeId: action.nodeId, category: action.category, sourcePath: action.sourcePath, fission: action.fission }, true);
            node.status = 'modified';
            node.problem = action.fission.problem;
            node.demand = action.fission.demand;
            node.answer = action.fission.answer;
            if (mode !== 'impact') {
                edges.push({
                    from: '__protocol__',
                    to: action.nodeId,
                    type: 'modify',
                    label: 'modify',
                    title: action.reason ?? 'modify node contract',
                    highlighted: false,
                    lifecycle: 'existing'
                });
            }
            (action.reuse ?? []).forEach((reuseTarget) => {
                ensureNode(nodeMap, edges, { nodeId: reuseTarget }, true);
                edges.push({
                    from: action.nodeId,
                    to: reuseTarget,
                    type: 'reuse',
                    label: 'reuse',
                    title: `${action.nodeId} reuses ${reuseTarget}`,
                    highlighted: false,
                    lifecycle: mode === 'impact' ? 'proposed' : 'existing'
                });
            });
            return;
        }
        upsertTriadVertex(nodeMap, edges, action.node, 'new', true, mode === 'impact' ? 'proposed' : 'existing');
        if (mode !== 'impact') {
            edges.push({
                from: '__protocol__',
                to: action.node.nodeId,
                type: 'protocol_target',
                label: 'new leaf',
                title: action.reason ?? 'new leaf node proposed by protocol',
                highlighted: true,
                lifecycle: 'existing'
            });
        }
        ensureNode(nodeMap, edges, { nodeId: action.parentNodeId }, true);
        edges.push({
            from: action.parentNodeId,
            to: action.node.nodeId,
            type: 'create_child',
            label: 'create_child',
            title: `${action.parentNodeId} -> ${action.node.nodeId}`,
            highlighted: true,
            lifecycle: mode === 'impact' ? 'proposed' : 'existing'
        });
    });
    (renormalizeProtocol?.actions ?? []).forEach((action) => {
        if (action.op !== 'create_macro_node')
            return;
        nodeMap.set(action.macro_node_id, {
            id: action.macro_node_id,
            label: action.macro_node_id,
            status: 'macro',
            lifecycle: 'existing',
            kind: 'macro',
            category: 'core',
            sourcePath: '',
            problem: action.rationale ?? 'Renormalized macro node',
            demand: action.new_demand ?? [],
            answer: action.new_answer ?? [],
            community: 'macro',
            communityName: 'Renormalized Macro',
            triadOwner: action.macro_node_id,
            branchTitle: 'Macro vertex: renormalized strongly connected component',
            absorbedNodes: action.absorbed_nodes ?? [],
            rationale: action.rationale ?? ''
        });
        (action.absorbed_nodes ?? []).forEach((nodeId) => {
            ensureNode(nodeMap, edges, { nodeId }, true);
            addUniqueEdge(edges, {
                from: action.macro_node_id,
                to: nodeId,
                type: 'renormalize_absorb',
                label: 'absorbs',
                title: `${action.macro_node_id} absorbs ${nodeId}`,
                highlighted: true,
                lifecycle: 'existing'
            });
        });
        if (mode !== 'impact' && ((action.new_demand ?? []).length > 0 || (action.new_answer ?? []).length > 0)) {
            addUniqueEdge(edges, {
                from: '__protocol__',
                to: action.macro_node_id,
                type: 'renormalize_contract',
                label: 'renormalize',
                title: `${action.macro_node_id} exposes external contract boundary`,
                highlighted: false,
                lifecycle: 'existing'
            });
        }
    });
    const previewContractEdges = (0, analyzer_1.calculateProducerConsumerEdges)(previewMap, options.analyzer)
        .reduce((items, edge) => {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        if (!fromNode || !toNode)
            return items;
        if (fromNode.kind !== 'vertex' && fromNode.kind !== 'macro')
            return items;
        if (toNode.kind !== 'vertex' && toNode.kind !== 'macro')
            return items;
        const edgeKey = `${edge.from}::${edge.to}::${edge.contract}`;
        const lifecycle = mode === 'impact' && !baseContractEdgeKeys.has(edgeKey) ? 'proposed' : 'existing';
        items.push({
            from: edge.from,
            to: edge.to,
            type: 'producer_consumer',
            label: '',
            title: `${edge.from} supplies ${edge.contract} to ${edge.to}`,
            highlighted: fromNode.status === 'new' ||
                fromNode.status === 'modified' ||
                toNode.status === 'new' ||
                toNode.status === 'modified',
            lifecycle
        });
        return items;
    }, [])
        .sort((left, right) => Number(right.lifecycle === 'proposed') - Number(left.lifecycle === 'proposed') ||
        Number(right.highlighted) - Number(left.highlighted) ||
        left.from.localeCompare(right.from) ||
        left.to.localeCompare(right.to) ||
        left.title.localeCompare(right.title));
    previewContractEdges.slice(0, options.maxContractEdges).forEach((edge) => addUniqueEdge(edges, edge));
    const nodeDegrees = new Map();
    const primaryDegrees = new Map();
    edges.forEach((edge) => {
        nodeDegrees.set(edge.from, (nodeDegrees.get(edge.from) ?? 0) + 1);
        nodeDegrees.set(edge.to, (nodeDegrees.get(edge.to) ?? 0) + 1);
        if (!isPrimaryTopologyEdge(edge)) {
            return;
        }
        primaryDegrees.set(edge.from, (primaryDegrees.get(edge.from) ?? 0) + 1);
        primaryDegrees.set(edge.to, (primaryDegrees.get(edge.to) ?? 0) + 1);
    });
    const hiddenNodeIds = new Set();
    if (options.defaultView === 'architecture') {
        Array.from(nodeMap.values()).forEach((node) => {
            if (node.kind === 'left_branch' || node.kind === 'right_branch') {
                hiddenNodeIds.add(node.id);
                return;
            }
            if (!options.showIsolatedCapabilities && isHideableIsolatedCapability(node, primaryDegrees)) {
                hiddenNodeIds.add(node.id);
            }
        });
    }
    const visibleEdges = edges.map((edge) => ({
        ...edge,
        hidden: options.defaultView === 'architecture' &&
            (edge.type === 'triad_left' ||
                edge.type === 'triad_right' ||
                hiddenNodeIds.has(edge.from) ||
                hiddenNodeIds.has(edge.to))
    }));
    const nodes = Array.from(nodeMap.values()).map((node) => ({
        ...node,
        degree: options.defaultView === 'architecture' ? primaryDegrees.get(node.id) ?? 0 : nodeDegrees.get(node.id) ?? 0,
        hidden: hiddenNodeIds.has(node.id)
    }));
    return {
        nodes,
        edges: visibleEdges,
        legend: buildLegend(nodes),
        stats: {
            nodes: nodes.filter((node) => !node.hidden).length,
            edges: visibleEdges.filter((edge) => !edge.hidden).length,
            vertices: nodes.filter((node) => node.kind === 'vertex').length,
            macroNodes: nodes.filter((node) => node.kind === 'macro').length,
            branchNodes: nodes.filter((node) => node.kind === 'left_branch' || node.kind === 'right_branch').length,
            newNodes: nodes.filter((node) => node.status === 'new').length,
            modifiedNodes: nodes.filter((node) => node.status === 'modified').length,
            reusedNodes: nodes.filter((node) => node.status === 'reused').length,
            cappedContractEdges: Math.max(0, previewContractEdges.length - options.maxContractEdges),
            branchCompression: options.compressExistingBranches
        }
    };
}
function toKnowledgeNode(node, status, lifecycle = node.lifecycle ?? 'existing') {
    const category = node.category ?? 'core';
    return {
        id: node.nodeId, label: node.nodeId, status, lifecycle, kind: 'vertex', category, sourcePath: node.sourcePath ?? '',
        problem: node.fission?.problem ?? '', demand: node.fission?.demand ?? [], answer: node.fission?.answer ?? [],
        community: category, communityName: toCommunityName(category), triadOwner: node.nodeId,
        branchTitle: 'Vertex: wraps dynamic left branch and static right branch', absorbedNodes: [], rationale: ''
    };
}
function ensureNode(nodeMap, edges, node, includeBranches = true) {
    return nodeMap.get(node.nodeId) ?? upsertTriadVertex(nodeMap, edges, node, 'existing', includeBranches);
}
function upsertTriadVertex(nodeMap, edges, node, status, includeBranches = true, lifecycle = node.lifecycle ?? 'existing') {
    const vertex = toKnowledgeNode(node, status, lifecycle);
    const existing = nodeMap.get(vertex.id);
    if (existing) {
        if (status === 'new' || status === 'modified' || status === 'reused')
            existing.status = status;
        existing.lifecycle = lifecycle;
        existing.category = vertex.category;
        existing.sourcePath = vertex.sourcePath;
        existing.problem = vertex.problem;
        existing.demand = vertex.demand;
        existing.answer = vertex.answer;
        syncTriadBranches(nodeMap, edges, existing, includeBranches);
        return existing;
    }
    nodeMap.set(vertex.id, vertex);
    syncTriadBranches(nodeMap, edges, vertex, includeBranches);
    return vertex;
}
function syncTriadBranches(nodeMap, edges, vertex, includeBranches) {
    if (vertex.id === '__protocol__' || vertex.kind !== 'vertex')
        return;
    const leftId = `${vertex.id}::__left`;
    const rightId = `${vertex.id}::__right`;
    if (!includeBranches) {
        nodeMap.delete(leftId);
        nodeMap.delete(rightId);
        return;
    }
    addTriadBranches(nodeMap, edges, vertex);
}
function addTriadBranches(nodeMap, edges, vertex) {
    if (vertex.id === '__protocol__' || vertex.kind !== 'vertex')
        return;
    const leftId = `${vertex.id}::__left`;
    const rightId = `${vertex.id}::__right`;
    nodeMap.set(leftId, { ...vertex, id: leftId, label: `L · ${getMethodName(vertex.id)}`, status: 'left_branch', kind: 'left_branch', branchTitle: 'Dynamic left branch: action / method / flow execution', triadOwner: vertex.id });
    nodeMap.set(rightId, { ...vertex, id: rightId, label: 'R · contract', status: 'right_branch', kind: 'right_branch', problem: `Static contract: ${vertex.sourcePath || vertex.category}`, branchTitle: 'Static right branch: state / config / demand-answer contract', triadOwner: vertex.id });
    addUniqueEdge(edges, { from: leftId, to: vertex.id, type: 'triad_left', label: 'left', title: `${vertex.id} dynamic left branch`, highlighted: vertex.status === 'new' || vertex.status === 'modified', lifecycle: vertex.lifecycle });
    addUniqueEdge(edges, { from: rightId, to: vertex.id, type: 'triad_right', label: 'right', title: `${vertex.id} static right branch`, highlighted: vertex.status === 'new' || vertex.status === 'modified', lifecycle: vertex.lifecycle });
}
function addUniqueEdge(edges, edge) {
    if (!edges.some((item) => item.from === edge.from && item.to === edge.to && item.type === edge.type))
        edges.push(edge);
}
function getMethodName(nodeId) {
    const parts = nodeId.split('.').filter(Boolean);
    return parts[parts.length - 1] ?? nodeId;
}
function buildLegend(nodes) {
    const communities = new Map();
    nodes.forEach((node) => {
        const current = communities.get(node.community) ??
            { cid: node.community, label: node.communityName, color: resolveCommunityColor(node.community), count: 0 };
        current.count += 1;
        communities.set(node.community, current);
    });
    return Array.from(communities.values()).sort((left, right) => left.label.localeCompare(right.label));
}
function toCommunityName(category) {
    const normalized = String(category ?? '').trim();
    if (!normalized)
        return 'Unknown';
    if (normalized === 'protocol')
        return 'Protocol';
    if (normalized === 'macro')
        return 'Macro';
    return normalized
        .split(/[_./-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}
function resolveCommunityColor(category) {
    const normalized = String(category ?? '').trim();
    if (!normalized) {
        return '#BAB0AC';
    }
    const preset = COMMUNITY_COLORS[normalized];
    if (preset) {
        return preset;
    }
    let hash = 0;
    for (const ch of normalized) {
        hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    }
    return COMMUNITY_FALLBACK_PALETTE[hash % COMMUNITY_FALLBACK_PALETTE.length];
}
function buildHtml(graph, protocol, mayaData, renormalizeProtocol, mode = 'review') {
    const macroActions = renormalizeProtocol?.actions ?? [];
    const macroColorMap = new Map();
    const absorbedOwnerMap = new Map();
    macroActions.forEach((action, index) => {
        const color = MACRO_CLUSTER_PALETTE[index % MACRO_CLUSTER_PALETTE.length];
        macroColorMap.set(action.macro_node_id, color);
        action.absorbed_nodes.forEach((nodeId) => absorbedOwnerMap.set(nodeId, action.macro_node_id));
    });
    const visNodes = graph.nodes.map((node) => {
        const color = STATUS_COLORS[node.status];
        const ownerId = node.status === 'macro'
            ? node.id
            : absorbedOwnerMap.get(node.id) ??
                (node.kind === 'left_branch' || node.kind === 'right_branch' ? absorbedOwnerMap.get(node.triadOwner) : undefined);
        const macroColor = ownerId ? macroColorMap.get(ownerId) : undefined;
        const size = node.kind === 'left_branch' || node.kind === 'right_branch'
            ? 16
            : node.status === 'macro'
                ? 46
                : node.status === 'new'
                    ? 40
                    : node.status === 'protocol'
                        ? 38
                        : 24 + Math.min(node.degree * 4, 22);
        const isProposed = node.lifecycle === 'proposed';
        const backgroundColor = isProposed
            ? 'rgba(255, 77, 79, 0.12)'
            : node.status === 'macro' && macroColor
                ? `${macroColor}c7`
                : color.background;
        const borderColor = isProposed ? '#ff4d4f' : macroColor ?? color.border;
        const highlightBackground = isProposed
            ? 'rgba(255, 77, 79, 0.22)'
            : node.status === 'macro' && macroColor
                ? `${macroColor}ff`
                : color.highlight;
        return {
            id: node.id,
            label: node.label,
            shape: node.status === 'protocol' ? 'diamond' : node.status === 'macro' ? 'star' : node.kind === 'left_branch' ? 'box' : node.kind === 'right_branch' ? 'hexagon' : 'dot',
            size,
            borderWidth: node.status === 'new' ? 4.8 : node.status === 'macro' ? 4.8 : node.status === 'modified' ? 3.8 : node.kind === 'left_branch' || node.kind === 'right_branch' ? 2.8 : 2.8,
            shapeProperties: { borderDashes: isProposed ? [6, 4] : false },
            color: {
                background: backgroundColor,
                border: borderColor,
                highlight: { background: highlightBackground, border: borderColor }
            },
            font: { color: '#f8fafc', size: node.status === 'existing' ? 0 : 14, face: 'Inter, Segoe UI, sans-serif', strokeWidth: 4, strokeColor: '#06111f' },
            title: escapeHtml(node.problem || node.label),
            hidden: Boolean(node.hidden),
            _status: node.status, _kind: node.kind, _community: node.community, _community_name: node.communityName, _sourcePath: node.sourcePath,
            _problem: node.problem, _demand: node.demand, _answer: node.answer, _degree: node.degree, _triadOwner: node.triadOwner,
            _branchTitle: node.branchTitle, _absorbedNodes: node.absorbedNodes, _rationale: node.rationale, _macroOwner: ownerId ?? '', _macroColor: macroColor ?? '',
            _lifecycle: node.lifecycle,
            _baseHidden: Boolean(node.hidden)
        };
    });
    const visEdges = graph.edges.map((edge, index) => {
        const style = edgeStyle(edge);
        return {
            id: index, from: edge.from, to: edge.to, label: edge.highlighted ? edge.label : '', title: escapeHtml(edge.title),
            dashes: style.dashes, width: style.width,
            hidden: Boolean(edge.hidden),
            color: { color: style.color, highlight: style.highlight, opacity: style.opacity },
            arrows: { to: { enabled: true, scaleFactor: edge.highlighted ? 1.1 : 0.6 } },
            font: { align: 'middle', color: edge.highlighted ? '#eff6ff' : '#cbd5e1', strokeWidth: 4, strokeColor: '#06111f' },
            smooth: { enabled: true, type: edge.highlighted ? 'curvedCW' : 'continuous', roundness: edge.highlighted ? 0.22 : 0.12 },
            _type: edge.type,
            _highlighted: edge.highlighted,
            _lifecycle: edge.lifecycle,
            _baseHidden: Boolean(edge.hidden)
        };
    });
    const statusSummary = [
        `vertices: ${graph.stats.vertices}`,
        `macro: ${graph.stats.macroNodes}`,
        `branches: ${graph.stats.branchNodes}`,
        `new: ${graph.stats.newNodes}`,
        `modified: ${graph.stats.modifiedNodes}`,
        `reused: ${graph.stats.reusedNodes}`
    ].join(' · ');
    const performanceSummary = [
        `view: ${mayaData.defaultView}`,
        graph.stats.branchCompression ? 'fast-render: compressed branch nodes' : '',
        graph.stats.cappedContractEdges > 0 ? `contract edges capped: +${graph.stats.cappedContractEdges} hidden` : '',
        mayaData.fastMode ? 'maya: fast fallback enabled' : '',
        mayaData.skippedOwnerCount > 0 ? `fingerprint owners skipped: ${mayaData.skippedOwnerCount}` : ''
    ]
        .filter(Boolean)
        .join(' · ');
    const renormalizeSummary = (renormalizeProtocol?.summary ?? []).length
        ? (renormalizeProtocol?.summary ?? []).map((item) => `<div class="status-row">${escapeHtml(item)}</div>`).join('')
        : '<div class="status-row"><span class="empty">No renormalization overlay loaded</span></div>';
    const projectMayaSummary = renderMayaFingerprintMarkup(mayaData.project);
    const heroEyebrow = mode === 'impact' ? 'TriadMind Impact Map' : 'TriadMind Knowledge Graph';
    const heroTitle = mode === 'impact' ? '架构导航冲击地图' : '拓扑升级知识图谱';
    const renormalizePanelTitle = mode === 'impact' ? 'Overlay' : 'Renormalize';
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TriadMind Knowledge Graph Visualizer</title>
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
${buildStyles()}
</head>
<body>
<div id="graph"></div>
<aside id="sidebar">
  <section id="hero"><div class="eyebrow">${heroEyebrow}</div><h1>${heroTitle}</h1><p>${escapeHtml(protocol.userDemand ?? 'No user demand provided')}</p><div class="stats">${graph.stats.nodes} nodes · ${graph.stats.edges} edges · ${statusSummary}</div>${performanceSummary ? `<div class="stats">${escapeHtml(performanceSummary)}</div>` : ''}</section>
  <section id="search-wrap"><input id="search" type="text" placeholder="Search nodes..." autocomplete="off"><div id="search-results"></div></section>
  <section id="status-legend">
    <h3>Status</h3>
    <div class="triad-explain">
      <div><span class="branch-chip left-chip">L</span>dynamic evolution: action / method / flow</div>
      <div><span class="branch-chip vertex-chip">V</span>vertex: usable feature wrapping both branches</div>
      <div><span class="branch-chip right-chip">R</span>static stability: state / config / contract</div>
    </div>
    <div class="status-row"><span class="status-dot status-proposed"></span>Proposed Feature (拟新增功能)</div>
    <div class="status-row"><span class="status-dot status-new"></span>new leaf node</div>
    <div class="status-row"><span class="status-dot status-modified"></span>modified node</div>
    <div class="status-row"><span class="status-dot status-reused"></span>reused node</div>
    <div class="status-row"><span class="status-dot status-left"></span>left branch</div>
    <div class="status-row"><span class="status-dot status-right"></span>right branch</div>
    <div class="status-row"><span class="status-dot status-macro"></span>macro node</div>
    <div class="status-row"><span class="status-line"></span>highlighted leaf / absorb edge</div>
  </section>
  <section id="maya-panel">
    <h3>Maya Fingerprint</h3>
    <div class="maya-block">
      <div class="maya-caption">Project Topology</div>
      <div id="maya-project">${projectMayaSummary}</div>
    </div>
    <div class="maya-block">
      <div class="maya-caption">Focused Feature</div>
      <div id="maya-feature"><span class="empty">Click a vertex or macro node to inspect its Young partition and Maya stones</span></div>
    </div>
  </section>
  <section id="renormalize-panel"><h3>${renormalizePanelTitle}</h3>${renormalizeSummary}</section>
  <section id="info-panel"><h3>Node Info</h3><div id="info-content"><span class="empty">Click a node to inspect it</span></div></section>
  <section id="legend-wrap"><h3>Communities</h3><div id="legend"></div></section>
</aside>
<div id="cluster-controls">
  <button class="view-toggle" data-view="architecture" type="button">Architecture</button>
  <button class="view-toggle" data-view="leaf" type="button">Leaf</button>
  <button id="toggle-clusters" type="button">Collapse Macro Clusters</button>
</div>
${buildScript(visNodes, visEdges, graph.legend, mayaData)}
</body>
</html>`;
}
function edgeStyle(edge) {
    if (edge.lifecycle === 'proposed') {
        return { color: '#ff4d4f', highlight: '#ffffff', width: edge.highlighted ? 4.8 : 3.4, opacity: 1, dashes: [8, 5] };
    }
    if (edge.type === 'triad_left')
        return { color: '#86efac', highlight: '#ffffff', width: edge.highlighted ? 3.8 : 2.8, opacity: 0.96, dashes: false };
    if (edge.type === 'triad_right')
        return { color: '#e9d5ff', highlight: '#ffffff', width: edge.highlighted ? 3.8 : 2.8, opacity: 0.96, dashes: [4, 3] };
    if (edge.type === 'producer_consumer')
        return { color: '#cbd5e1', highlight: '#ffffff', width: edge.highlighted ? 3.6 : 2.8, opacity: edge.highlighted ? 0.98 : 0.94, dashes: [8, 4] };
    if (edge.type === 'create_child')
        return { color: '#67e8f9', highlight: '#ffffff', width: 5.8, opacity: 1, dashes: false };
    if (edge.type === 'protocol_target')
        return { color: '#e9d5ff', highlight: '#ffffff', width: 3.8, opacity: 0.96, dashes: [8, 5] };
    if (edge.type === 'modify')
        return { color: '#fdba74', highlight: '#ffffff', width: 3.8, opacity: 0.96, dashes: false };
    if (edge.type === 'renormalize_absorb')
        return { color: '#fda4af', highlight: '#ffffff', width: 4.8, opacity: 0.98, dashes: [10, 4] };
    if (edge.type === 'renormalize_contract')
        return { color: '#fecdd3', highlight: '#ffffff', width: 3.2, opacity: 0.94, dashes: [3, 4] };
    return { color: '#cbd5e1', highlight: '#ffffff', width: 2.8, opacity: 0.9, dashes: [6, 4] };
}
function buildStyles() {
    return `<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
  background:
    radial-gradient(circle at 18% 12%,rgba(56,189,248,.18) 0,transparent 34%),
    radial-gradient(circle at 82% 18%,rgba(167,139,250,.14) 0,transparent 30%),
    linear-gradient(180deg,#1a2436 0%,#131c2b 100%);
  color:#e6eef9;
  font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  display:flex;
  height:100vh;
  overflow:hidden
}
#graph{
  flex:1;
  min-width:0;
  background:
    radial-gradient(circle at 18% 12%,rgba(56,189,248,.16) 0,transparent 34%),
    radial-gradient(circle at 82% 18%,rgba(167,139,250,.11) 0,transparent 30%),
    linear-gradient(rgba(203,213,225,.045) 1px,transparent 1px),
    linear-gradient(90deg,rgba(203,213,225,.045) 1px,transparent 1px),
    linear-gradient(180deg,#1a2436 0%,#131c2b 100%);
  background-size:auto,auto,34px 34px,34px 34px,auto
}
#sidebar{
  width:380px;
  background:rgba(18,28,44,.97);
  border-left:1px solid #607894;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  box-shadow:-18px 0 40px rgba(2,8,23,.38)
}
#hero{padding:16px;border-bottom:1px solid #607894;background:rgba(13,22,37,.68)}
.eyebrow{color:#7dd3fc;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
h1{font-size:18px;margin-bottom:8px;color:#f8fbff}
#hero p{color:#d7e7fb;font-size:12px;line-height:1.5;max-height:58px;overflow:auto}
.stats{color:#a9c0d9;font-size:11px;margin-top:10px}
#search-wrap{padding:12px;border-bottom:1px solid #607894;background:rgba(14,23,37,.62)}
#search{
  width:100%;
  background:#182536;
  border:1px solid #7a92ae;
  color:#f8fbff;
  padding:8px 10px;
  border-radius:8px;
  font-size:13px;
  outline:none;
  box-shadow:inset 0 0 0 1px rgba(148,163,184,.05)
}
#search:focus{border-color:#7dd3fc;box-shadow:0 0 0 3px rgba(125,211,252,.14)}
#search-results{max-height:150px;overflow-y:auto;display:none;padding-top:8px}
#status-legend,#maya-panel,#renormalize-panel,#info-panel,#legend-wrap{
  padding:14px;
  border-bottom:1px solid #607894;
  background:rgba(14,23,37,.56)
}
#legend-wrap{flex:1;overflow-y:auto}
#cluster-controls{position:absolute;top:16px;left:16px;z-index:20;display:flex;gap:8px;flex-wrap:wrap}
#cluster-controls button{
  background:#1b2a3d;
  border:1px solid #89a3c2;
  color:#eff6ff;
  padding:8px 12px;
  border-radius:999px;
  cursor:pointer;
  font-size:12px;
  box-shadow:0 12px 30px rgba(2,8,23,.32)
}
#cluster-controls button:hover{filter:brightness(1.08);border-color:#e2e8f0}
#cluster-controls button.active{
  background:#214365;
  border-color:#ffffff;
  color:#f8fbff;
  box-shadow:0 0 0 1px rgba(255,255,255,.16),0 0 22px rgba(191,219,254,.24)
}
h3{font-size:12px;color:#c4b5fd;margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em}
.status-row{display:flex;align-items:center;gap:8px;color:#d7e7fb;font-size:12px;padding:3px 0;line-height:1.5}
.status-dot{width:12px;height:12px;border-radius:999px;display:inline-block;border:2px solid currentColor;flex-shrink:0}
.status-proposed{color:#ff4d4f;background:rgba(255,77,79,.12);border-style:dashed;box-shadow:0 0 16px rgba(255,77,79,.3)}
.status-new{color:#e0f7ff;background:#0284c7;box-shadow:0 0 16px rgba(103,232,249,.48)}
.status-modified{color:#ffefe3;background:#9a4b1e}
.status-reused{color:#fff7d9;background:#8a6510}
.status-left{color:#ffffff;background:#15803d}
.status-right{color:#ffffff;background:#7c3aed}
.status-macro{color:#ffffff;background:#be123c}
.status-line{width:22px;height:3px;background:#e2e8f0;box-shadow:0 0 14px rgba(226,232,240,.72);display:inline-block;flex-shrink:0}
.triad-explain{background:#182536;border:1px solid #6f89a7;border-radius:10px;padding:9px;margin-bottom:10px;color:#edf6ff;font-size:11px;line-height:1.7}
.branch-chip{display:inline-block;min-width:24px;text-align:center;border-radius:999px;padding:1px 6px;margin-right:6px;font-weight:700}
.left-chip{background:#15803d;color:#ffffff;border:1px solid #dfffe8}
.vertex-chip{background:#214365;color:#ffffff;border:1px solid #f8fbff}
.right-chip{background:#7c3aed;color:#ffffff;border:1px solid #f4ebff}
.maya-block{background:#182536;border:1px solid #6f89a7;border-radius:12px;padding:10px;margin-bottom:10px;box-shadow:0 10px 26px rgba(2,8,23,.18)}
.maya-block:last-child{margin-bottom:0}
.maya-caption{font-size:11px;color:#a9c0d9;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.maya-grid{display:grid;gap:7px}
.maya-line{font-size:12px;color:#d7e7fb;line-height:1.55;word-break:break-word}
.maya-key{color:#a9c0d9;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
.maya-pills,.maya-node-list{display:flex;flex-wrap:wrap;gap:6px}
.maya-pill{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:#214365;border:1px solid #89a3c2;color:#ffffff;font-size:12px}
.maya-strip{display:flex;flex-wrap:nowrap;gap:0;overflow-x:auto;padding:10px 0 6px 0;border-radius:10px;background:linear-gradient(180deg,#182536 0%,#214365 100%);border:1px solid #6f89a7;box-shadow:inset 0 0 0 1px rgba(148,163,184,.08)}
.maya-cell{position:relative;min-width:22px;height:38px;display:flex;align-items:center;justify-content:center;border-right:1px solid rgba(173,190,210,.16);flex-shrink:0}
.maya-cell:last-child{border-right:none}
.maya-cell.black{background:linear-gradient(180deg,#214365 0%,#131c2b 100%)}
.maya-cell.white{background:linear-gradient(180deg,#f8fbff 0%,#dbeafe 100%)}
.maya-pebble{width:12px;height:12px;border-radius:999px;display:block;box-shadow:0 0 0 1px rgba(173,190,210,.35),0 4px 10px rgba(15,23,42,.28)}
.maya-cell.black .maya-pebble{background:#f8fbff;box-shadow:0 0 0 1px rgba(248,251,255,.45),0 0 14px rgba(248,251,255,.22)}
.maya-cell.white .maya-pebble{background:#131c2b;box-shadow:0 0 0 1px rgba(19,28,43,.35),0 0 14px rgba(19,28,43,.18)}
.maya-bitline{display:flex;flex-wrap:nowrap;gap:0;overflow-x:auto;padding:4px 0 0 0}
.maya-bit{min-width:22px;text-align:center;font-size:10px;color:#a9c0d9;flex-shrink:0}
.maya-node{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:#214365;border:1px solid #f8fbff;color:#ffffff;font-size:11px;cursor:pointer}
.maya-node:hover{filter:brightness(1.08)}
#info-content{font-size:12px;color:#d7e7fb;line-height:1.55;max-height:300px;overflow-y:auto}
.field{margin-bottom:6px;word-break:break-word}
.field b{color:#f8fbff}
.empty{color:#8aa0b9;font-style:italic}
.triad-card{display:grid;grid-template-columns:1fr;gap:7px;margin:10px 0}
.triad-col{border-radius:10px;padding:8px;border:1px solid #6f89a7;cursor:pointer;word-break:break-word;box-shadow:0 10px 24px rgba(2,8,23,.12)}
.triad-col:hover{filter:brightness(1.08);border-color:#ffffff}
.triad-col b{display:block;color:#f8fbff;margin-bottom:2px}
.triad-col small{display:block;color:#a9c0d9;margin-bottom:5px}
.triad-col span{display:block;color:#d7e7fb}
.triad-left{background:rgba(21,128,61,.86);border-color:#dfffe8}
.triad-vertex{background:rgba(33,67,101,.9);border-color:#f8fbff}
.triad-right{background:rgba(124,58,237,.86);border-color:#f4ebff}
.pill{display:inline-block;padding:2px 6px;border-radius:999px;background:#214365;border:1px solid #89a3c2;margin:2px 4px 2px 0;color:#ffffff}
.neighbor-link,.search-item{display:block;padding:5px 8px;cursor:pointer;border-radius:6px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.neighbor-link{padding:3px 6px;margin:3px 0;border-left:3px solid #89a3c2}
.neighbor-link:hover,.search-item:hover,.legend-item:hover{background:#26364a}
.legend-item{display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;border-radius:6px;font-size:12px}
.legend-item.dimmed{opacity:.52}
.legend-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0;box-shadow:0 0 0 1px rgba(248,251,255,.12)}
.legend-label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.legend-count{color:#a9c0d9;font-size:11px}
</style>`;
}
function buildScript(nodes, edges, legend, mayaData) {
    return `<script>
const RAW_NODES = ${jsSafe(nodes)};
const RAW_EDGES = ${jsSafe(edges)};
const LEGEND = ${jsSafe(legend)};
const MAYA_DATA = ${jsSafe(mayaData)};
const nodesDS = new vis.DataSet(RAW_NODES);
const edgesDS = new vis.DataSet(RAW_EDGES);
const container = document.getElementById('graph');
const network = new vis.Network(container, { nodes: nodesDS, edges: edgesDS }, {
  physics: { enabled: true, solver: 'forceAtlas2Based', forceAtlas2Based: { gravitationalConstant: -75, centralGravity: 0.006, springLength: 150, springConstant: 0.08, damping: 0.42, avoidOverlap: 0.9 }, stabilization: { iterations: 260, fit: true } },
  interaction: { hover: true, tooltipDelay: 120, hideEdgesOnDrag: true, navigationButtons: true, keyboard: false },
  nodes: { shadow: { enabled: true, color: 'rgba(248,251,255,.22)', size: 26, x: 0, y: 2 } }, edges: { selectionWidth: 6 }
});
let clustersCollapsed = false;
let focusedMacroId = '';
let currentView = MAYA_DATA.defaultView || 'architecture';
function getMacroNodes(){ return RAW_NODES.filter(n => n._status === 'macro' && Array.isArray(n._absorbedNodes) && n._absorbedNodes.length); }
function getMacroClusterNodeIds(macro){ const vertexIds = macro._absorbedNodes || []; const branchIds = vertexIds.flatMap(id => [id + '::__left', id + '::__right']).filter(id => nodesDS.get(id)); return [...vertexIds, ...branchIds]; }
function applyMacroClusterLayout(){ getMacroNodes().forEach((macro, macroIndex) => { const macroPos = network.getPositions([macro.id])[macro.id]; if(!macroPos) return; const absorbed = (macro._absorbedNodes || []).map(id => nodesDS.get(id)).filter(Boolean); const total = Math.max(absorbed.length, 1); const radius = 90 + Math.min(total * 8, 48); absorbed.forEach((node, index) => { const angle = ((Math.PI * 2) / total) * index - Math.PI / 2 + macroIndex * 0.15; const x = macroPos.x + Math.cos(angle) * radius; const y = macroPos.y + Math.sin(angle) * radius; network.moveNode(node.id, x, y); const leftId = node.id + '::__left'; const rightId = node.id + '::__right'; if(nodesDS.get(leftId)) network.moveNode(leftId, x - 38, y - 28); if(nodesDS.get(rightId)) network.moveNode(rightId, x + 38, y + 28); }); }); }
function isNodeHiddenByCurrentView(node){ return currentView === 'architecture' && Boolean(node?._baseHidden); }
function isEdgeHiddenByCurrentView(edge){ return currentView === 'architecture' && Boolean(edge?._baseHidden); }
function setGraphView(view){ currentView = view === 'leaf' ? 'leaf' : 'architecture'; nodesDS.update(RAW_NODES.map(node => ({ id: node.id, hidden: hiddenCommunities.has(node._community) || isNodeHiddenByCurrentView(node) }))); edgesDS.update(RAW_EDGES.map(edge => ({ id: edge.id, hidden: isEdgeHiddenByCurrentView(edge) }))); document.querySelectorAll('.view-toggle').forEach(button => button.classList.toggle('active', button.dataset.view === currentView)); }
function setMacroClusterCollapsed(collapsed){ clustersCollapsed = collapsed; getMacroNodes().forEach(macro => { const ids = getMacroClusterNodeIds(macro); nodesDS.update(ids.map(id => { const raw = RAW_NODES.find(node => node.id === id); return { id, hidden: collapsed || hiddenCommunities.has(raw?._community) || isNodeHiddenByCurrentView(raw) }; })); }); const button = document.getElementById('toggle-clusters'); if(button) button.textContent = collapsed ? 'Expand Macro Clusters' : 'Collapse Macro Clusters'; }
function withAlpha(color, alpha){ if(!color) return color; if(color.startsWith('#')){ const hex = color.slice(1); const expanded = hex.length === 3 ? hex.split('').map(ch => ch + ch).join('') : hex.slice(0,6); const normalized = Math.max(0, Math.min(1, alpha)); const alphaHex = Math.round(normalized * 255).toString(16).padStart(2,'0'); return '#' + expanded + alphaHex; } if(color.startsWith('rgb(')){ return color.replace('rgb(', 'rgba(').replace(')', ',' + alpha + ')'); } if(color.startsWith('rgba(')){ return color.replace(/rgba\(([^)]+),[^,]+\)$/, 'rgba($1,' + alpha + ')'); } return color; }
function getMacroById(macroId){ return getMacroNodes().find(node => node.id === macroId); }
function getFocusedMacroIdForNode(nodeId){ const node = nodesDS.get(nodeId); if(!node) return ''; if(node._status === 'macro') return node.id; return node._macroOwner || ''; }
function getFeatureFingerprintForNode(nodeId){ const node = nodesDS.get(nodeId); if(!node) return null; if(node._status === 'macro') return MAYA_DATA.byMacro[node.id] || null; const ownerId = node._triadOwner || node.id; return MAYA_DATA.byOwner[ownerId] || null; }
function renderMayaStrip(sequence){ if(!Array.isArray(sequence) || !sequence.length) return '<span class="empty">None</span>'; const cells = sequence.map(v => '<div class="maya-cell ' + (v ? 'black' : 'white') + '"><span class="maya-pebble"></span></div>').join(''); const bits = sequence.map(v => '<div class="maya-bit">' + esc(v) + '</div>').join(''); return '<div class="maya-strip">' + cells + '</div><div class="maya-bitline">' + bits + '</div>'; }
function renderMayaFingerprint(data, interactive){ if(!data) return '<span class="empty">Fingerprint skipped in fast mode; enable strictFingerprint to precompute this local fragment.</span>'; const partition = Array.isArray(data.partition) && data.partition.length ? data.partition.map(v => '<span class="maya-pill">' + esc(v) + '</span>').join('') : '<span class="empty">[]</span>'; const sequence = Array.isArray(data.sequence) && data.sequence.length ? data.sequence.map(v => '<span class="maya-pill">' + esc(v) + '</span>').join('') : '<span class="empty">[]</span>'; const nodes = Array.isArray(data.normalizedNodeIds) && data.normalizedNodeIds.length ? data.normalizedNodeIds.map(id => interactive ? '<span class="maya-node" onclick="focusNode(' + JSON.stringify(id).replace(/"/g,'&quot;') + ')">' + esc(id) + '</span>' : '<span class="maya-pill">' + esc(id) + '</span>').join('') : '<span class="empty">None</span>'; return '<div class="maya-grid">' + '<div class="maya-line"><span class="maya-key">Scope</span><br>' + esc(data.title) + '</div>' + '<div class="maya-line"><span class="maya-key">Mode</span><br><span class="pill">' + esc(data.mode || 'fallback') + '</span> ' + esc(data.reason || '') + '</div>' + '<div class="maya-line"><span class="maya-key">Maya-ID</span><br><span class="pill">' + esc(data.hash) + '</span></div>' + '<div class="maya-line"><span class="maya-key">Young Partition</span><div class="maya-pills">' + partition + '</div></div>' + '<div class="maya-line"><span class="maya-key">Maya Strip</span>' + renderMayaStrip(data.sequence) + '</div>' + '<div class="maya-line"><span class="maya-key">Maya Sequence</span><div class="maya-pills">' + sequence + '</div></div>' + '<div class="maya-line"><span class="maya-key">Normalized Fragment</span><div class="maya-node-list">' + nodes + '</div></div>' + '</div>'; }
function showMaya(nodeId){ const panel = document.getElementById('maya-feature'); if(!panel) return; panel.innerHTML = renderMayaFingerprint(getFeatureFingerprintForNode(nodeId), true); }
function applyMacroFocus(macroId){ focusedMacroId = macroId || ''; const macro = focusedMacroId ? getMacroById(focusedMacroId) : null; const focusSet = new Set(macro ? [macro.id, ...getMacroClusterNodeIds(macro)] : []); nodesDS.update(RAW_NODES.map(node => { const inFocus = !macro || focusSet.has(node.id); const baseColor = node.color || {}; return { id: node.id, color: { background: inFocus ? baseColor.background : withAlpha(baseColor.background, 0.42), border: inFocus ? baseColor.border : withAlpha(baseColor.border, 0.56), highlight: baseColor.highlight }, font: { ...(node.font || {}), color: inFocus ? '#f8fafc' : 'rgba(248,250,252,0.58)' } }; })); edgesDS.update(RAW_EDGES.map(edge => { const connected = !macro || (focusSet.has(edge.from) && focusSet.has(edge.to)); return { id: edge.id, color: { ...(edge.color || {}), opacity: connected ? (edge.color?.opacity ?? 1) : 0.36 }, hidden: isEdgeHiddenByCurrentView(edge), width: connected ? edge.width : Math.max((edge.width || 1) * 0.7, 1.6) }; })); }
function drawMacroClusterHull(ctx, macro){ const ids = [macro.id, ...getMacroClusterNodeIds(macro)].filter(id => !nodesDS.get(id)?.hidden); if(ids.length <= 1) return; const positions = network.getPositions(ids); const points = ids.map(id => positions[id]).filter(Boolean); if(points.length === 0) return; const minX = Math.min(...points.map(p => p.x)); const maxX = Math.max(...points.map(p => p.x)); const minY = Math.min(...points.map(p => p.y)); const maxY = Math.max(...points.map(p => p.y)); const pad = 44; const radius = 26; const color = macro._macroColor || '#f43f5e'; const x = minX - pad; const y = minY - pad; const width = (maxX - minX) + pad * 2; const height = (maxY - minY) + pad * 2; ctx.save(); ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y); ctx.quadraticCurveTo(x + width, y, x + width, y + radius); ctx.lineTo(x + width, y + height - radius); ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height); ctx.lineTo(x + radius, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - radius); ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath(); ctx.fillStyle = color + '2e'; ctx.strokeStyle = color + 'ff'; ctx.lineWidth = 3.2; ctx.setLineDash([9,6]); ctx.shadowColor = color; ctx.shadowBlur = 28; ctx.fill(); ctx.stroke(); ctx.restore(); }
network.once('stabilizationIterationsDone', () => { applyMacroClusterLayout(); network.setOptions({ physics: { enabled: false } }); });
network.on('afterDrawing', function(ctx){ getMacroNodes().forEach(macro => drawMacroClusterHull(ctx, macro)); RAW_NODES.filter(n => (n._status === 'new' || n._status === 'macro') && (n._kind === 'vertex' || n._kind === 'macro')).forEach(n => { const pos = network.getPositions([n.id])[n.id]; if(!pos) return; ctx.save(); ctx.beginPath(); ctx.arc(pos.x, pos.y, n._status === 'macro' ? 56 : 50, 0, Math.PI * 2); ctx.strokeStyle = n._macroColor ? n._macroColor + 'ff' : (n._status === 'macro' ? 'rgba(255,228,235,.96)' : 'rgba(248,251,255,.96)'); ctx.lineWidth = 4.4; ctx.shadowColor = n._macroColor || '#f8fbff'; ctx.shadowBlur = 32; ctx.stroke(); ctx.restore(); }); });
function esc(s){ return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function selectNode(nodeId){ const macroId = getFocusedMacroIdForNode(nodeId); applyMacroFocus(macroId); network.selectNodes([nodeId]); showInfo(nodeId); showMaya(nodeId); }
function focusNode(nodeId){ selectNode(nodeId); network.focus(nodeId,{ scale:1.35, animation:true }); }
function clearNodeSelection(){ if (typeof network.unselectAll === 'function') { network.unselectAll(); } else { network.selectNodes([]); } applyMacroFocus(''); container.style.cursor = 'default'; document.getElementById('info-content').innerHTML = '<span class="empty">Click a node to inspect it</span>'; document.getElementById('maya-feature').innerHTML = '<span class="empty">Click a vertex or macro node to inspect its Young partition and Maya stones</span>'; }
function showInfo(nodeId){ const n = nodesDS.get(nodeId); if(!n) return; const ownerId = n._triadOwner || n.id; const owner = nodesDS.get(ownerId) || n; const left = nodesDS.get(ownerId + '::__left'); const right = nodesDS.get(ownerId + '::__right'); const neighborIds = network.getConnectedNodes(nodeId); const neighborItems = neighborIds.map(nid => { const nb = nodesDS.get(nid); const color = nb?.color?.background ?? '#555'; return '<span class="neighbor-link" style="border-left-color:' + esc(color) + '" onclick="focusNode(' + JSON.stringify(nid).replace(/"/g,'&quot;') + ')">' + esc(nb ? nb.label : nid) + '</span>'; }).join(''); const demand = Array.isArray(n._demand) && n._demand.length ? n._demand.map(x => '<span class="pill">' + esc(x) + '</span>').join('') : '<span class="empty">None</span>'; const answer = Array.isArray(n._answer) && n._answer.length ? n._answer.map(x => '<span class="pill">' + esc(x) + '</span>').join('') : '<span class="empty">None</span>'; const absorbed = Array.isArray(n._absorbedNodes) && n._absorbedNodes.length ? n._absorbedNodes.map(x => '<span class="pill" onclick="focusNode(' + JSON.stringify(x).replace(/"/g,'&quot;') + ')" style="cursor:pointer">' + esc(x) + '</span>').join('') : '<span class="empty">None</span>'; const ownerDemand = Array.isArray(owner._demand) && owner._demand.length ? owner._demand.map(x => '<span class="pill">' + esc(x) + '</span>').join('') : '<span class="empty">None</span>'; const ownerAnswer = Array.isArray(owner._answer) && owner._answer.length ? owner._answer.map(x => '<span class="pill">' + esc(x) + '</span>').join('') : '<span class="empty">None</span>'; document.getElementById('info-content').innerHTML = '<div class="field"><b>' + esc(n.label) + '</b></div>' + '<div class="field">Triad Kind: <span class="pill">' + esc(n._kind) + '</span></div>' + '<div class="field">Triad Owner: <span class="pill" onclick="focusNode(' + JSON.stringify(ownerId).replace(/"/g,'&quot;') + ')" style="cursor:pointer">' + esc(ownerId) + '</span></div>' + '<div class="field">Status: <span class="pill">' + esc(n._status) + '</span></div>' + '<div class="field">Community: ' + esc(n._community_name) + '</div>' + '<div class="field">Source: ' + esc(n._sourcePath || '-') + '</div>' + '<div class="field">Role: ' + esc(n._branchTitle || '-') + '</div>' + '<div class="field">Problem: ' + esc(n._problem || '-') + '</div>' + '<div class="field">Demand: ' + demand + '</div>' + '<div class="field">Answer: ' + answer + '</div>' + (n._kind === 'macro' ? '<div class="field">Absorbed Nodes: ' + absorbed + '</div><div class="field">Rationale: ' + esc(n._rationale || '-') + '</div>' : '') + '<div class="triad-card"><div class="triad-col triad-left" onclick="focusNode(' + JSON.stringify(left?.id || ownerId).replace(/"/g,'&quot;') + ')"><b>Left</b><small>dynamic branch</small><span>' + esc(owner._problem || '-') + '</span></div><div class="triad-col triad-vertex" onclick="focusNode(' + JSON.stringify(ownerId).replace(/"/g,'&quot;') + ')"><b>Vertex</b><small>feature wrapper</small><span>' + esc(owner.label || ownerId) + '</span></div><div class="triad-col triad-right" onclick="focusNode(' + JSON.stringify(right?.id || ownerId).replace(/"/g,'&quot;') + ')"><b>Right</b><small>static contract</small><span>Demand: ' + ownerDemand + '</span><span>Answer: ' + ownerAnswer + '</span></div></div><div class="field">Degree: ' + esc(n._degree) + '</div>' + (neighborIds.length ? '<div class="field" style="margin-top:8px;color:#aaa;font-size:11px">Neighbors (' + neighborIds.length + ')</div>' + neighborItems : ''); }
network.on('hoverNode', () => { container.style.cursor = 'pointer'; }); network.on('blurNode', () => { container.style.cursor = 'default'; }); network.on('click', params => { if (params.nodes.length > 0) { selectNode(params.nodes[0]); } else { clearNodeSelection(); } });
const searchInput = document.getElementById('search'); const searchResults = document.getElementById('search-results'); searchInput.addEventListener('input', () => { const q = searchInput.value.toLowerCase().trim(); searchResults.innerHTML = ''; if (!q) { searchResults.style.display = 'none'; return; } const matches = RAW_NODES.filter(n => n.label.toLowerCase().includes(q)).slice(0,20); if (!matches.length) { searchResults.style.display = 'none'; return; } searchResults.style.display = 'block'; matches.forEach(n => { const el = document.createElement('div'); el.className = 'search-item'; el.textContent = n.label; el.style.borderLeft = '3px solid ' + (n.color?.border ?? '#555'); el.onclick = () => { focusNode(n.id); searchResults.style.display = 'none'; searchInput.value = ''; }; searchResults.appendChild(el); }); });
const hiddenCommunities = new Set(); const legendEl = document.getElementById('legend'); LEGEND.forEach(c => { const item = document.createElement('div'); item.className = 'legend-item'; item.innerHTML = '<div class="legend-dot" style="background:' + esc(c.color) + '"></div><span class="legend-label">' + esc(c.label) + '</span><span class="legend-count">' + esc(c.count) + '</span>'; item.onclick = () => { if (hiddenCommunities.has(c.cid)) { hiddenCommunities.delete(c.cid); item.classList.remove('dimmed'); } else { hiddenCommunities.add(c.cid); item.classList.add('dimmed'); } nodesDS.update(RAW_NODES.filter(n => n._community === c.cid).map(n => ({ id:n.id, hidden:hiddenCommunities.has(c.cid) || isNodeHiddenByCurrentView(n) }))); }; legendEl.appendChild(item); });
const toggleClustersButton = document.getElementById('toggle-clusters'); if (toggleClustersButton) { toggleClustersButton.addEventListener('click', () => setMacroClusterCollapsed(!clustersCollapsed)); }
document.querySelectorAll('.view-toggle').forEach(button => button.addEventListener('click', () => { setGraphView(button.dataset.view); network.fit({ animation: true }); }));
setGraphView(currentView);
const firstFocus = RAW_NODES.find(n => n._lifecycle === 'proposed') || RAW_NODES.find(n => n._status === 'new') || RAW_NODES.find(n => n._status === 'macro'); if (firstFocus) setTimeout(() => focusNode(firstFocus.id), 350);
</script>`;
}
function buildPreviewTopology(originalMap, protocol, mode = 'review') {
    const preview = new Map();
    originalMap.forEach((node) => preview.set(node.nodeId, cloneNode(node)));
    protocol.actions.forEach((action) => {
        if (action.op === 'modify') {
            preview.set(action.nodeId, {
                nodeId: action.nodeId,
                category: action.category,
                sourcePath: action.sourcePath,
                lifecycle: 'existing',
                fission: {
                    problem: action.fission.problem,
                    demand: [...action.fission.demand],
                    answer: [...action.fission.answer]
                }
            });
            return;
        }
        if (action.op === 'create_child') {
            const createdNode = cloneNode(action.node);
            preview.set(action.node.nodeId, {
                ...createdNode,
                lifecycle: mode === 'impact' ? 'proposed' : createdNode.lifecycle
            });
        }
    });
    return Array.from(preview.values());
}
function buildMayaPanelData(previewMap, protocol, renormalizeProtocol, options) {
    const projectProjection = buildModuleProjection(previewMap);
    const project = createMayaFingerprint('project::topology', 'Whole project topology (module projection)', 'project', projectProjection, options);
    const { outgoing, incoming, nodeMap } = buildContractNeighborhood(previewMap, options.analyzer);
    const byOwner = {};
    const focusOwnerIds = collectHighlightedOwnerIds(protocol, renormalizeProtocol);
    const allOwnerIds = options.fastMode || !options.strictFingerprint
        ? Array.from(focusOwnerIds).filter((nodeId) => nodeMap.has(nodeId))
        : previewMap.map((node) => node.nodeId);
    const ownerIds = allOwnerIds.slice(0, options.maxFingerprintOwners);
    const skippedOwnerCount = Math.max(0, allOwnerIds.length - ownerIds.length) +
        (options.fastMode || !options.strictFingerprint ? previewMap.length - allOwnerIds.length : 0);
    const fingerprintCache = new Map();
    ownerIds.forEach((ownerId) => {
        const neighborIds = new Set([ownerId, ...(outgoing.get(ownerId) ?? []), ...(incoming.get(ownerId) ?? [])]);
        const fragment = Array.from(neighborIds)
            .map((nodeId) => nodeMap.get(nodeId))
            .filter((item) => Boolean(item));
        byOwner[ownerId] = createCachedMayaFingerprint(fingerprintCache, `feature::${ownerId}`, ownerId, 'feature', fragment, options);
    });
    const byMacro = {};
    (renormalizeProtocol?.actions ?? []).forEach((action) => {
        const fragment = action.absorbed_nodes
            .map((nodeId) => nodeMap.get(nodeId))
            .filter((item) => Boolean(item));
        byMacro[action.macro_node_id] = createCachedMayaFingerprint(fingerprintCache, `macro::${action.macro_node_id}`, `${action.macro_node_id} macro cluster`, 'macro', fragment, options);
    });
    return {
        project,
        byOwner,
        byMacro,
        fastMode: options.fastMode,
        defaultView: options.defaultView,
        skippedOwnerCount,
        strictFingerprintSkipped: options.fastMode || !options.strictFingerprint || project.mode === 'fallback'
    };
}
function createCachedMayaFingerprint(cache, key, title, scope, nodes, options) {
    const cacheKey = nodes
        .map((node) => node.nodeId)
        .sort()
        .join('|');
    const cached = cache.get(cacheKey);
    if (cached) {
        return { ...cached, key, title, scope };
    }
    const fingerprint = createMayaFingerprint(key, title, scope, nodes, options);
    cache.set(cacheKey, fingerprint);
    return fingerprint;
}
function createMayaFingerprint(key, title, scope, nodes, options) {
    let normalized;
    let partition;
    let mode = 'strict';
    let reason = 'strict canonical normalization';
    try {
        if (options.fastMode || !options.strictFingerprint) {
            throw new Error('fallback mode enabled');
        }
        if (nodes.length > options.maxFingerprintNodes) {
            throw new Error(`fragment has ${nodes.length} nodes, max strict nodes is ${options.maxFingerprintNodes}`);
        }
        if (nodes.length > options.fastMayaThreshold) {
            throw new Error('Use stable fallback for larger visualizer fragments');
        }
        const startedAt = Date.now();
        normalized = (0, analyzer_1.normalizeSubgraph)(nodes);
        partition = (0, analyzer_1.mapTopologyToYoungPartition)(nodes);
        const elapsedMs = Date.now() - startedAt;
        if (elapsedMs > options.fingerprintTimeoutMs) {
            throw new Error(`strict fingerprint exceeded ${options.fingerprintTimeoutMs}ms`);
        }
    }
    catch (error) {
        mode = 'fallback';
        reason = error instanceof Error ? error.message : 'strict fingerprint unavailable';
        normalized = nodes
            .slice()
            .sort((left, right) => left.nodeId.localeCompare(right.nodeId))
            .map((node) => cloneNode(node));
        partition = buildFallbackPartition(normalized, options.analyzer);
    }
    const sequence = (0, analyzer_1.generateMayaSequence)(partition);
    return {
        key,
        title,
        scope,
        mode,
        reason,
        nodeIds: nodes.map((node) => node.nodeId),
        normalizedNodeIds: normalized.map((node) => node.nodeId),
        partition,
        sequence,
        hash: (0, analyzer_1.generateMayaFeatureHash)(sequence),
        stones: sequence.map((value) => (value ? '⚫' : '⚪'))
    };
}
function buildFallbackPartition(nodes, analyzerOptions) {
    return nodes
        .map((node) => {
        const demandCount = (node.fission?.demand ?? []).filter((entry) => normalizeContractKey(entry, true, analyzerOptions)).length;
        const answerCount = (node.fission?.answer ?? []).filter((entry) => normalizeContractKey(entry, false, analyzerOptions)).length;
        return 1 + demandCount + answerCount;
    })
        .filter((value) => value > 0)
        .sort((left, right) => right - left);
}
function renderMayaFingerprintMarkup(fingerprint) {
    const partition = fingerprint.partition.length
        ? fingerprint.partition.map((value) => `<span class="maya-pill">${value}</span>`).join('')
        : '<span class="empty">[]</span>';
    const sequence = fingerprint.sequence.length
        ? fingerprint.sequence.map((value) => `<span class="maya-pill">${value}</span>`).join('')
        : '<span class="empty">[]</span>';
    const normalizedNodes = fingerprint.normalizedNodeIds.length
        ? fingerprint.normalizedNodeIds.map((nodeId) => `<span class="maya-pill">${escapeHtml(nodeId)}</span>`).join('')
        : '<span class="empty">None</span>';
    return `<div class="maya-grid">
  <div class="maya-line"><span class="maya-key">Scope</span><br>${escapeHtml(fingerprint.title)}</div>
  <div class="maya-line"><span class="maya-key">Mode</span><br><span class="pill">${escapeHtml(fingerprint.mode)}</span> ${escapeHtml(fingerprint.reason)}</div>
  <div class="maya-line"><span class="maya-key">Maya-ID</span><br><span class="pill">${escapeHtml(fingerprint.hash)}</span></div>
  <div class="maya-line"><span class="maya-key">Young Partition</span><div class="maya-pills">${partition}</div></div>
  <div class="maya-line"><span class="maya-key">Maya Strip</span>${renderMayaStripMarkup(fingerprint.sequence)}</div>
  <div class="maya-line"><span class="maya-key">Maya Sequence</span><div class="maya-pills">${sequence}</div></div>
  <div class="maya-line"><span class="maya-key">Normalized Fragment</span><div class="maya-node-list">${normalizedNodes}</div></div>
</div>`;
}
function renderMayaStripMarkup(sequence) {
    if (!sequence.length) {
        return '<span class="empty">None</span>';
    }
    const cells = sequence
        .map((value) => `<div class="maya-cell ${value ? 'black' : 'white'}"><span class="maya-pebble"></span></div>`)
        .join('');
    const bits = sequence.map((value) => `<div class="maya-bit">${value}</div>`).join('');
    return `<div class="maya-strip">${cells}</div><div class="maya-bitline">${bits}</div>`;
}
function buildContractNeighborhood(map, analyzerOptions) {
    const nodeMap = new Map();
    const producersByContract = new Map();
    const outgoing = new Map();
    const incoming = new Map();
    map.forEach((node) => {
        nodeMap.set(node.nodeId, node);
        outgoing.set(node.nodeId, new Set());
        incoming.set(node.nodeId, new Set());
        (node.fission?.answer ?? [])
            .map((entry) => normalizeContractKey(entry, false, analyzerOptions))
            .filter((entry) => Boolean(entry))
            .forEach((contract) => {
            const items = producersByContract.get(contract) ?? [];
            items.push(node.nodeId);
            producersByContract.set(contract, items);
        });
    });
    map.forEach((node) => {
        (node.fission?.demand ?? [])
            .map((entry) => normalizeContractKey(entry, true, analyzerOptions))
            .filter((entry) => Boolean(entry))
            .forEach((contract) => {
            (producersByContract.get(contract) ?? []).forEach((producerId) => {
                if (producerId === node.nodeId)
                    return;
                outgoing.get(producerId)?.add(node.nodeId);
                incoming.get(node.nodeId)?.add(producerId);
            });
        });
    });
    return { nodeMap, outgoing, incoming };
}
function normalizeContractKey(entry, isDemand, analyzerOptions) {
    const raw = String(entry ?? '').trim();
    if (!raw)
        return null;
    if (isDemand && /^\[Ghost/i.test(raw))
        return null;
    const match = raw.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    const value = (match ? match[1] : raw)
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/\s*([<>{}()[\]|,:=&?])\s*/g, '$1');
    if (/^(none|void|null|undefined)$/i.test(value)) {
        return null;
    }
    const compact = value.toLowerCase().replace(/\s+/g, '');
    const ignoreGenericContracts = analyzerOptions?.ignoreGenericContracts !== false;
    const genericIgnoreSet = new Set((analyzerOptions?.genericContractIgnoreList ?? [])
        .map((item) => String(item ?? '').toLowerCase().replace(/\s+/g, ''))
        .filter(Boolean));
    if (ignoreGenericContracts &&
        (genericIgnoreSet.has(compact) ||
            /^(str|string|std::string|int|integer|short|byte|long|usize|isize|u8|u16|u32|u64|u128|i8|i16|i32|i64|i128|float|double|number|bool|boolean|dict|list|vec|set|tuple|any|unknown|object|json|request|response|path|optional\[str\]|optional\[int\]|list\[str\]|list\[string\]|dict\[(str|string),(any|object)\]|record<(str|string),(any|unknown|object)>|map<(str|string),(any|unknown|object)>)$/i.test(compact) ||
            /^(optional\[(str|string|std::string|int|integer|short|byte|long|usize|isize|u8|u16|u32|u64|u128|i8|i16|i32|i64|i128|double|float|number|bool|boolean|bigint|symbol|dict|list|vec|set|tuple|any|unknown|object|json|request|response|path)\]|(list|sequence|vec)\[(str|string|std::string|int|integer|short|byte|long|usize|isize|u8|u16|u32|u64|u128|i8|i16|i32|i64|i128|double|float|number|bool|boolean|bigint|symbol|dict|list|vec|set|tuple|any|unknown|object|json|request|response|path)\]|array<(str|string|std::string|int|integer|short|byte|long|usize|isize|u8|u16|u32|u64|u128|i8|i16|i32|i64|i128|double|float|number|bool|boolean|bigint|symbol|dict|list|vec|set|tuple|any|unknown|object|json|request|response|path)>)$/i.test(compact))) {
        return null;
    }
    return value;
}
function resolveProjectRootFromMapPath(mapPath) {
    const parent = path.dirname(path.resolve(mapPath));
    return path.basename(parent).toLowerCase() === '.triadmind' ? path.dirname(parent) : parent;
}
function buildVisualizerOptions(config, originalMap, protocol, dashboardOptions) {
    const previewNodeCount = originalMap.length + protocol.actions.filter((action) => action.op === 'create_child').length;
    const strictFingerprint = dashboardOptions.strictFingerprint === true;
    const fastMode = dashboardOptions.fastMode ?? (!strictFingerprint || config.visualizer.fastMode || previewNodeCount > config.visualizer.maxRenderNodes);
    return {
        analyzer: (0, analyzerOptionsSupport_1.resolveAnalyzerOptionsFromConfig)(config),
        defaultView: dashboardOptions.defaultView ?? config.visualizer.defaultView,
        showIsolatedCapabilities: dashboardOptions.showIsolatedCapabilities ?? config.visualizer.showIsolatedCapabilities,
        maxContractEdges: dashboardOptions.fullContractEdges
            ? Number.MAX_SAFE_INTEGER
            : config.visualizer.maxPrimaryEdges || config.visualizer.maxContractEdges,
        fastMayaThreshold: config.visualizer.fastFingerprintThreshold ?? config.visualizer.fastMayaThreshold,
        strictFingerprint,
        maxFingerprintNodes: config.visualizer.maxFingerprintNodes,
        maxFingerprintOwners: config.visualizer.maxFingerprintOwners,
        fingerprintTimeoutMs: config.visualizer.fingerprintTimeoutMs,
        maxRenderNodes: config.visualizer.maxRenderNodes,
        compressExistingBranches: previewNodeCount > config.visualizer.maxRenderNodes,
        fastMode
    };
}
function isHideableIsolatedCapability(node, nodeDegrees) {
    if (node.kind !== 'vertex') {
        return false;
    }
    const degree = nodeDegrees.get(node.id) ?? 0;
    if (degree > 0) {
        return false;
    }
    return !isImportantCapabilityNode(node);
}
function isPrimaryTopologyEdge(edge) {
    return edge.type !== 'triad_left' && edge.type !== 'triad_right';
}
function isImportantCapabilityNode(node) {
    if (node.status === 'new' || node.status === 'modified' || node.status === 'macro') {
        return true;
    }
    const text = `${node.id} ${node.problem} ${node.sourcePath}`.toLowerCase();
    return /(api|route|endpoint|handler|controller|command|event|consumer|adapter|gateway|worker|tool|agent|execute|run|handle|dispatch)/i.test(text);
}
function collectHighlightedOwnerIds(protocol, renormalizeProtocol) {
    const ids = new Set();
    for (const action of protocol.actions) {
        if (action.op === 'reuse') {
            ids.add(action.nodeId);
            continue;
        }
        if (action.op === 'modify') {
            ids.add(action.nodeId);
            (action.reuse ?? []).forEach((nodeId) => ids.add(nodeId));
            continue;
        }
        ids.add(action.node.nodeId);
        ids.add(action.parentNodeId);
    }
    for (const action of renormalizeProtocol?.actions ?? []) {
        ids.add(action.macro_node_id);
        (action.absorbed_nodes ?? []).forEach((nodeId) => ids.add(nodeId));
    }
    return ids;
}
function cloneNode(node) {
    return {
        nodeId: node.nodeId,
        category: node.category,
        sourcePath: node.sourcePath,
        lifecycle: node.lifecycle ?? 'existing',
        fission: {
            problem: node.fission?.problem,
            demand: [...(node.fission?.demand ?? [])],
            answer: [...(node.fission?.answer ?? [])]
        }
    };
}
function buildModuleProjection(map) {
    const moduleMap = new Map();
    map.forEach((node) => {
        const moduleId = toModuleNodeId(node);
        const current = moduleMap.get(moduleId) ??
            {
                nodeId: moduleId,
                category: node.category ?? 'core',
                sourcePath: node.sourcePath ?? '',
                problems: new Set(),
                demand: new Set(),
                answer: new Set()
            };
        if (node.fission?.problem)
            current.problems.add(node.fission.problem);
        (node.fission?.demand ?? []).forEach((entry) => current.demand.add(entry));
        (node.fission?.answer ?? []).forEach((entry) => current.answer.add(entry));
        moduleMap.set(moduleId, current);
    });
    return Array.from(moduleMap.values()).map((entry) => ({
        nodeId: entry.nodeId,
        category: entry.category,
        sourcePath: entry.sourcePath,
        fission: {
            problem: `module projection of ${entry.sourcePath || entry.nodeId}`,
            demand: Array.from(entry.demand).sort(),
            answer: Array.from(entry.answer).sort()
        }
    }));
}
function toModuleNodeId(node) {
    const sourcePath = String(node.sourcePath ?? '').replace(/\\/g, '/').trim();
    const moduleName = sourcePath ? sourcePath.replace(/\.ts$/i, '') : node.nodeId.split('.')[0] ?? node.nodeId;
    return `Module.${moduleName}`;
}
function jsSafe(value) { return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026'); }
function escapeHtml(value) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
//# sourceMappingURL=visualizer.js.map