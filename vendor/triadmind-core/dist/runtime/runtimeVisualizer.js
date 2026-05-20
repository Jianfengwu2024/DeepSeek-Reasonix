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
exports.generateRuntimeDashboard = generateRuntimeDashboard;
exports.calculateRuntimeRenderStats = calculateRuntimeRenderStats;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const runtimeGraph_1 = require("./runtimeGraph");
const runtimeLabeling_1 = require("./runtimeLabeling");
const GROUP_THEME = {
    frontend: { label: 'Frontend', color: '#2563eb', border: '#93c5fd', highlight: '#dbeafe' },
    api: { label: 'API', color: '#0f766e', border: '#5eead4', highlight: '#ccfbf1' },
    service: { label: 'Service', color: '#9a3412', border: '#fdba74', highlight: '#ffedd5' },
    workflow: { label: 'Workflow', color: '#6d28d9', border: '#d8b4fe', highlight: '#f3e8ff' },
    worker: { label: 'Worker', color: '#57534e', border: '#facc15', highlight: '#fef08a' },
    resource: { label: 'Resource', color: '#334155', border: '#e2e8f0', highlight: '#f8fafc' },
    external: { label: 'External', color: '#9f1239', border: '#fda4af', highlight: '#ffe4e6' },
    infra: { label: 'Infra', color: '#155e75', border: '#67e8f9', highlight: '#cffafe' },
    other: { label: 'Other', color: '#475569', border: '#cbd5e1', highlight: '#f8fafc' }
};
const EDGE_THEME = {
    calls: { color: '#7dd3fc', highlight: '#e0f2fe' },
    invokes: { color: '#fb923c', highlight: '#ffedd5' },
    dispatches: { color: '#c4b5fd', highlight: '#ede9fe' },
    enqueues: { color: '#fcd34d', highlight: '#fef3c7', dashes: [8, 4] },
    consumes: { color: '#fde047', highlight: '#fef9c3', dashes: [8, 4] },
    executes: { color: '#4ade80', highlight: '#dcfce7' },
    reads: { color: '#cbd5e1', highlight: '#f8fafc', dashes: [4, 4] },
    writes: { color: '#f87171', highlight: '#fee2e2', dashes: [4, 4] },
    caches: { color: '#5eead4', highlight: '#ccfbf1', dashes: [6, 4] },
    depends_on: { color: '#bfdbfe', highlight: '#eff6ff', dashes: [4, 6] }
};
const RESOURCE_NODE_TYPES = new Set(['DataStore', 'ObjectStore', 'Cache', 'FileSystem', 'Queue']);
function generateRuntimeDashboard(runtimeMapPath, outputPath, options = {}) {
    const startedAt = Date.now();
    const runtimeMap = JSON.parse(fs.readFileSync(runtimeMapPath, 'utf-8'));
    const runtimeMapForView = normalizeRuntimeMapForVisualizer(runtimeMap);
    const dashboardOptions = normalizeRuntimeDashboardOptions(options);
    const payload = buildRuntimeDashboardPayload(runtimeMapForView, dashboardOptions.maxRenderEdges);
    const html = renderRuntimeDashboard(payload, dashboardOptions, options.title ?? `TriadMind Runtime Topology - ${runtimeMapForView.project}`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(`[TriadMind] Runtime visualizer mode: interactive=${dashboardOptions.interactive} layout=${dashboardOptions.layout} theme=${dashboardOptions.theme} view=${runtimeMapForView.view ?? 'full'} nodes=${payload.nodes.length} edges=${payload.edges.length} diagnostics=${(runtimeMapForView.diagnostics ?? []).length}`);
    if (payload.edgeCapApplied) {
        console.log(`[TriadMind] Runtime visualizer edge cap active: ${payload.edges.length}/${payload.sourceEdgeCount}`);
    }
    console.log(`[TriadMind] Runtime dashboard generated in ${Date.now() - startedAt}ms`);
}
function calculateRuntimeRenderStats(runtimeMap, maxRenderEdges) {
    const runtimeMapForView = normalizeRuntimeMapForVisualizer(runtimeMap);
    const payload = buildRuntimeDashboardPayload(runtimeMapForView, maxRenderEdges);
    return {
        sourceEdges: payload.sourceEdgeCount,
        renderedEdges: payload.edges.length,
        edgeCapApplied: payload.edgeCapApplied,
        nodeCount: payload.nodes.length
    };
}
function buildRuntimeDashboardPayload(runtimeMap, maxRenderEdges) {
    const hydratedMap = ensureRuntimeMapHasEdgeEndpoints(runtimeMap);
    const graphIndex = (0, runtimeGraph_1.buildRuntimeGraphIndex)(hydratedMap);
    const edgeLimit = maxRenderEdges && maxRenderEdges > 0 ? maxRenderEdges : graphIndex.edges.length;
    const selectedEdges = graphIndex.edges
        .slice()
        .sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0))
        .slice(0, Math.max(1, edgeLimit));
    const edgeIds = new Set(selectedEdges.map((edge) => edge.id));
    const degree = new Map();
    selectedEdges.forEach((edge) => {
        degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
        degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
    });
    const nodes = hydratedMap.nodes.map((node) => toVisualNode(node, degree));
    const nodeById = new Set(nodes.map((node) => node.id));
    const edges = selectedEdges.filter((edge) => nodeById.has(edge.from) && nodeById.has(edge.to) && edgeIds.has(edge.id)).map((edge) => toVisualEdge(edge));
    const legend = buildLegend(nodes);
    const denseResourceNodeIds = nodes.filter((node) => node._group === 'resource' && (degree.get(node.id) ?? 0) >= 12).map((node) => node.id);
    return {
        runtimeMap: hydratedMap,
        nodes,
        edges,
        legend,
        denseResourceNodeIds,
        sourceEdgeCount: graphIndex.edges.length,
        edgeCapApplied: Boolean(maxRenderEdges && maxRenderEdges > 0 && graphIndex.edges.length > edgeLimit)
    };
}
function toVisualNode(node, degreeMap) {
    const group = resolveRuntimeNodeGroup(node.type);
    const theme = GROUP_THEME[group];
    const degree = degreeMap.get(node.id) ?? 0;
    return {
        id: node.id,
        label: truncate(node.label || node.id, 42),
        title: `${node.label} [${node.type}]${node.sourcePath ? `\\n${node.sourcePath}` : ''}`,
        shape: resolveNodeShape(node.type),
        size: Math.max(18, Math.min(42, 18 + Math.floor(Math.log2(Math.max(1, degree + 1)) * 8))),
        borderWidth: 2.2,
        font: { color: '#f8fafc', face: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', size: 12, strokeWidth: 4, strokeColor: '#06111f' },
        color: { background: theme.color, border: theme.border, highlight: { background: theme.highlight, border: theme.border } },
        _type: node.type,
        _group: group,
        _sourcePath: node.sourcePath,
        _framework: node.framework,
        _metadata: node.metadata ?? {},
        _evidence: node.evidence ?? [],
        _searchText: [node.id, node.label, node.type, node.sourcePath ?? '', node.framework ?? ''].join(' ').toLowerCase()
    };
}
function toVisualEdge(edge) {
    const style = EDGE_THEME[edge.type] ?? EDGE_THEME.depends_on;
    const confidence = Math.max(0, Math.min(1, Number(edge.confidence ?? 0.55)));
    return {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        label: edge.type,
        title: `${edge.type}\\nconfidence: ${confidence.toFixed(2)}\\nevidence: ${Array.isArray(edge.evidence) ? edge.evidence.length : 0}`,
        arrows: { to: { enabled: true, scaleFactor: 0.72 } },
        width: 1.8 + confidence * 2.6,
        dashes: style.dashes ?? false,
        color: { color: style.color, highlight: style.highlight, opacity: 0.94 },
        font: { align: 'middle', color: '#e2e8f0', strokeWidth: 4, strokeColor: '#06111f', size: 11 },
        smooth: { enabled: true, type: 'continuous', roundness: 0.18 },
        _type: edge.type,
        _confidence: confidence,
        _metadata: edge.metadata ?? {},
        _evidence: edge.evidence ?? []
    };
}
function buildLegend(nodes) {
    const counts = new Map();
    nodes.forEach((node) => counts.set(node._group, (counts.get(node._group) ?? 0) + 1));
    return Array.from(counts.entries())
        .map(([cid, count]) => ({ cid, label: GROUP_THEME[cid].label, color: GROUP_THEME[cid].border, count }))
        .sort((left, right) => right.count - left.count);
}
function resolveRuntimeNodeGroup(type) {
    if (type === 'FrontendEntry' || type === 'FrontendComponent')
        return 'frontend';
    if (type === 'ApiRoute' || type === 'CliCommand' || type === 'RpcEndpoint')
        return 'api';
    if (type === 'Service')
        return 'service';
    if (type === 'Workflow' || type === 'WorkflowNode' || type === 'WorkflowEdge')
        return 'workflow';
    if (type === 'Worker' || type === 'Task' || type === 'Queue' || type === 'Scheduler')
        return 'worker';
    if (RESOURCE_NODE_TYPES.has(type))
        return 'resource';
    if (type === 'ExternalApi' || type === 'ExternalTool' || type === 'ModelProvider' || type === 'Plugin')
        return 'external';
    if (type === 'Config' || type === 'Secret' || type === 'Kernel')
        return 'infra';
    return 'other';
}
function resolveNodeShape(type) {
    if (type === 'ApiRoute' || type === 'CliCommand' || type === 'RpcEndpoint')
        return 'box';
    if (type === 'Workflow' || type === 'WorkflowNode')
        return 'diamond';
    if (type === 'FrontendEntry' || type === 'FrontendComponent')
        return 'ellipse';
    return 'dot';
}
function normalizeRuntimeMapForVisualizer(runtimeMap) {
    return {
        ...runtimeMap,
        nodes: runtimeMap.nodes.map((node) => {
            const normalized = (0, runtimeLabeling_1.normalizeRuntimeNodeLabel)(node);
            const lowSignalFallback = normalized.lowSignal ? buildLowSignalFallbackLabel(node) : undefined;
            return {
                ...node,
                label: lowSignalFallback ?? normalized.label,
                metadata: {
                    ...(node.metadata ?? {}),
                    originalLabel: node.label,
                    runtimeLabelSource: normalized.source,
                    runtimeLowSignalLabel: normalized.lowSignal,
                    runtimeFallbackLabel: lowSignalFallback
                }
            };
        })
    };
}
function ensureRuntimeMapHasEdgeEndpoints(runtimeMap) {
    const nodeById = new Map(runtimeMap.nodes.map((node) => [node.id, node]));
    const nodes = [...runtimeMap.nodes];
    for (const edge of runtimeMap.edges) {
        for (const endpoint of [edge.from, edge.to]) {
            if (nodeById.has(endpoint)) {
                continue;
            }
            const inferredNode = {
                id: endpoint,
                type: 'UnknownRuntime',
                label: endpoint,
                category: 'core',
                metadata: {
                    generatedBy: 'RuntimeVisualizer',
                    reason: 'dangling-edge-endpoint'
                },
                evidence: [
                    {
                        kind: 'inferred',
                        text: `Synthesized runtime node for edge endpoint: ${endpoint}`,
                        confidence: 0.4
                    }
                ]
            };
            nodeById.set(endpoint, inferredNode);
            nodes.push(inferredNode);
        }
    }
    return {
        ...runtimeMap,
        nodes
    };
}
function buildLowSignalFallbackLabel(node) {
    const sourceName = node.sourcePath ? path.basename(node.sourcePath) : '';
    const handler = typeof node.metadata?.handler === 'string'
        ? String(node.metadata.handler)
        : typeof node.metadata?.service === 'string'
            ? String(node.metadata.service)
            : '';
    if (handler.trim()) {
        return `${node.type} ${handler.trim()}`;
    }
    if (sourceName) {
        return `${node.type} ${sourceName}`;
    }
    return `${node.type} ${node.id.split('.').slice(0, 2).join('.')}`;
}
function normalizeRuntimeDashboardOptions(options) {
    return {
        interactive: options.interactive ?? true,
        layout: options.layout === 'dagre' ? 'dagre' : 'leaf-force',
        traceDepth: normalizePositiveInteger(options.traceDepth, 2),
        hideIsolated: options.hideIsolated ?? false,
        maxRenderEdges: normalizeOptionalPositiveInteger(options.maxRenderEdges),
        theme: options.theme === 'runtime-dark' ? 'runtime-dark' : 'leaf-like'
    };
}
function renderRuntimeDashboard(payload, options, title) {
    const safePayload = JSON.stringify(payload).replace(/</g, '\\u003c');
    const safeOptions = JSON.stringify(options).replace(/</g, '\\u003c');
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
${buildRuntimeStyle(options.theme)}
</head>
<body data-runtime-visualizer-version="3">
<div id="canvas-wrap">
  <div id="graph"></div>
  <div id="cluster-controls"><button id="view-leaf" class="active" type="button">Leaf View</button><button id="view-flow" type="button">Flow View</button><button id="toggle-clusters" class="active" type="button">Edge Bundling: on</button></div>
  <div id="runtime-toolbar">
    <input id="search-inline" class="search-chip" placeholder="Search id / label / type / sourcePath">
    <select id="layout-select"><option value="leaf-force">leaf-force</option><option value="dagre">dagre</option></select>
    <input id="trace-depth" class="trace-chip" type="number" min="1" max="8" value="${options.traceDepth}">
    <button id="trace-upstream" type="button">Upstream</button><button id="trace-downstream" type="button">Downstream</button><button id="trace-both" type="button">Both</button>
    <button id="edge-label-toggle" class="active" type="button">Edge Labels: on</button>
    <label class="filter-row"><input id="hide-isolated" type="checkbox" ${options.hideIsolated ? 'checked' : ''}>Hide isolated</label>
    <button id="reset-view" type="button">Reset</button><button id="fit-view" type="button">Fit</button>
  </div>
  <div id="runtime-notice">Runtime graph uses vis-network and matches visualizer control semantics.</div>
</div>
<aside id="sidebar">
  <section id="hero"><div class="eyebrow">TriadMind Runtime Graph</div><h1>${escapeHtml(payload.runtimeMap.project)}</h1><p>Interactive runtime topology aligned with visualizer.html patterns.</p><div class="stats">view: ${escapeHtml(payload.runtimeMap.view ?? 'full')} | nodes: ${payload.nodes.length} | edges: ${payload.edges.length}</div></section>
  <section id="search-wrap"><input id="search" type="text" placeholder="Search nodes..." autocomplete="off"><div id="search-results"></div></section>
  <section id="status-legend"><h3>Status</h3><div class="status-row"><span class="status-dot status-selected"></span><span>selected node / edge</span></div><div class="status-row"><span class="status-dot status-neighbor"></span><span>1-hop neighbors</span></div><div class="status-row"><span class="status-dot status-trace"></span><span>trace path</span></div><div class="status-row"><span class="status-dot status-focus"></span><span>focus lock</span></div></section>
  <section id="filters-panel"><h3>Node Types</h3><div id="node-type-filters"></div><h3 style="margin-top:10px">Edge Types</h3><div id="edge-type-filters"></div></section>
  <section id="info-panel"><h3 id="info-title">Node Info</h3><div id="info-content"><span class="empty">Click a node or edge to inspect.</span></div></section>
  <section id="diagnostic-wrap"><h3>Runtime Diagnostics</h3><div id="diagnostic-content"></div></section>
  <section id="legend-wrap"><h3>Communities</h3><div id="legend"></div></section>
</aside>
<script>
const runtimePayload = ${safePayload};
const dashboardOptions = ${safeOptions};
${buildRuntimeVisualizerScript()}
</script>
</body></html>`;
}
function buildRuntimeStyle(theme) {
    const dark = theme === 'runtime-dark';
    const pageBg = dark ? '#08111f' : '#0b1324';
    const panel = dark ? 'rgba(15,27,51,.96)' : 'rgba(18,28,46,.96)';
    const section = dark ? 'rgba(11,21,41,.36)' : 'rgba(13,22,39,.36)';
    const line = dark ? '#34506f' : '#3f5675';
    const fieldBg = dark ? '#0b1529' : '#10203a';
    const fieldBorder = dark ? '#56708f' : '#5f7595';
    const titleTint = dark ? '#7dd3fc' : '#93c5fd';
    const headingTint = dark ? '#c4b5fd' : '#bfdbfe';
    return `<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
  background:radial-gradient(circle at 14% 10%,rgba(56,189,248,.18) 0,transparent 38%),radial-gradient(circle at 78% 16%,rgba(167,139,250,.11) 0,transparent 28%),${pageBg};
  color:#e6eef9;
  font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  display:flex;
  height:100vh;
  overflow:hidden
}
#canvas-wrap{position:relative;flex:1;min-width:0}
#graph{
  width:100%;
  height:100%;
  background:radial-gradient(circle at 14% 10%,rgba(56,189,248,.18) 0,transparent 38%),radial-gradient(circle at 78% 16%,rgba(167,139,250,.11) 0,transparent 28%),${pageBg}
}
#sidebar{
  width:390px;
  background:${panel};
  border-left:1px solid ${line};
  display:flex;
  flex-direction:column;
  overflow:hidden;
  box-shadow:-18px 0 40px rgba(2,8,23,.38)
}
#hero{padding:16px;border-bottom:1px solid ${line};background:rgba(11,21,41,.5)}
.eyebrow{color:${titleTint};font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
h1{font-size:18px;margin-bottom:8px;color:#f8fbff}
#hero p{color:#d7e7fb;font-size:12px;line-height:1.5}
.stats{color:#a9c0d9;font-size:11px;margin-top:8px}
#search-wrap,#status-legend,#filters-panel,#info-panel,#legend-wrap,#diagnostic-wrap{
  padding:14px;
  border-bottom:1px solid ${line};
  background:${section}
}
#legend-wrap{flex:1;overflow-y:auto}
#search{
  width:100%;
  background:${fieldBg};
  border:1px solid ${fieldBorder};
  color:#f8fbff;
  padding:8px 10px;
  border-radius:8px;
  font-size:13px;
  outline:none;
  box-shadow:inset 0 0 0 1px rgba(148,163,184,.05)
}
#search:focus{border-color:${titleTint};box-shadow:0 0 0 3px rgba(125,211,252,.14)}
#search-results{max-height:170px;overflow-y:auto;display:none;padding-top:8px}
#cluster-controls{position:absolute;top:16px;left:16px;z-index:20;display:flex;gap:8px;flex-wrap:wrap}
#cluster-controls button,#runtime-toolbar button,#runtime-toolbar select,#runtime-toolbar input{
  background:#102440;
  border:1px solid ${fieldBorder};
  color:#eff6ff;
  padding:8px 12px;
  border-radius:999px;
  cursor:pointer;
  font-size:12px;
  box-shadow:0 12px 30px rgba(2,8,23,.32)
}
#cluster-controls button.active,#runtime-toolbar button.active{
  background:#123455;
  border-color:${titleTint};
  color:#f8fbff;
  box-shadow:0 0 0 1px rgba(125,211,252,.16),0 0 22px rgba(56,189,248,.22)
}
#runtime-toolbar{position:absolute;top:60px;left:16px;z-index:20;display:flex;gap:8px;flex-wrap:wrap;max-width:calc(100% - 24px)}
#runtime-toolbar .search-chip{width:230px;border-radius:8px}
#runtime-toolbar .trace-chip{width:72px;border-radius:8px}
h3{font-size:12px;color:${headingTint};margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em}
.status-row{display:flex;align-items:center;gap:8px;color:#d7e7fb;font-size:12px;padding:3px 0;line-height:1.5}
.status-dot{width:12px;height:12px;border-radius:999px;display:inline-block;border:2px solid currentColor;flex-shrink:0}
.status-selected{color:#7dd3fc;background:#123455}
.status-neighbor{color:#f8fbff;background:#334155}
.status-trace{color:#fcd34d;background:#5a430b}
.status-focus{color:#d8b4fe;background:#6d28d9}
.search-item,.neighbor-link,.legend-item{display:block;padding:6px 8px;cursor:pointer;border-radius:6px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.search-item:hover,.neighbor-link:hover,.legend-item:hover{background:#1c2a41}
.legend-item{display:flex;align-items:center;gap:8px;padding:5px 0}
.legend-item.dimmed{opacity:.38}
.legend-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0;box-shadow:0 0 0 1px rgba(248,251,255,.12)}
.legend-label{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.legend-count{color:#a9c0d9;font-size:11px}
.detail-grid{display:grid;grid-template-columns:96px 1fr;gap:6px;font-size:12px;line-height:1.45}
.detail-grid b{color:#a9c0d9;font-weight:500}
.pill{display:inline-block;padding:2px 6px;border-radius:999px;background:#102440;border:1px solid ${fieldBorder};margin:2px 4px 2px 0;color:#eff6ff;font-size:11px}
.runtime-flow-card{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin:10px 0}
.flow-col{border-radius:10px;padding:8px;border:1px solid ${fieldBorder};background:#0f1b33;color:#d7e7fb;box-shadow:0 10px 24px rgba(2,8,23,.12)}
.flow-in{background:rgba(15,90,58,.78);border-color:#4ade80}
.flow-core{background:rgba(13,95,133,.78);border-color:#7dd3fc}
.flow-out{background:rgba(109,40,217,.78);border-color:#d8b4fe}
.filter-row{display:flex;align-items:center;gap:6px;font-size:12px;color:#d7e7fb;padding:2px 0}
.filter-row input{accent-color:${titleTint}}
.empty{color:#8aa0b9;font-style:italic}
#runtime-notice{
  position:absolute;
  left:16px;
  bottom:14px;
  z-index:20;
  background:rgba(11,21,41,.94);
  border:1px solid ${fieldBorder};
  border-radius:10px;
  padding:8px 10px;
  color:#c8d7ea;
  font-size:12px;
  max-width:min(640px,calc(100% - 24px));
  line-height:1.45;
  box-shadow:0 12px 30px rgba(2,8,23,.28)
}
@media (max-width:1100px){#sidebar{display:none}#runtime-toolbar .search-chip{width:170px}}
</style>`;
}
function buildRuntimeVisualizerScript() {
    return `
const runtimeMap = runtimePayload.runtimeMap;
const runtimeNodes = runtimePayload.nodes;
const runtimeEdges = runtimePayload.edges;
const runtimeLegend = runtimePayload.legend;
const denseResourceNodeIds = new Set(runtimePayload.denseResourceNodeIds || []);
const FLOW_ALLOWED = new Set(['frontend','api','service','workflow','worker','resource','external']);

const dom = {
  graph: document.getElementById('graph'),
  search: document.getElementById('search'),
  searchInline: document.getElementById('search-inline'),
  searchResults: document.getElementById('search-results'),
  infoTitle: document.getElementById('info-title'),
  infoContent: document.getElementById('info-content'),
  legend: document.getElementById('legend'),
  diagnostics: document.getElementById('diagnostic-content'),
  nodeTypeFilters: document.getElementById('node-type-filters'),
  edgeTypeFilters: document.getElementById('edge-type-filters'),
  hideIsolated: document.getElementById('hide-isolated'),
  traceDepth: document.getElementById('trace-depth'),
  layoutSelect: document.getElementById('layout-select'),
  viewLeaf: document.getElementById('view-leaf'),
  viewFlow: document.getElementById('view-flow'),
  toggleClusters: document.getElementById('toggle-clusters'),
  traceUpstream: document.getElementById('trace-upstream'),
  traceDownstream: document.getElementById('trace-downstream'),
  traceBoth: document.getElementById('trace-both'),
  resetView: document.getElementById('reset-view'),
  fitView: document.getElementById('fit-view'),
  edgeLabelToggle: document.getElementById('edge-label-toggle'),
  notice: document.getElementById('runtime-notice')
};

const nodesDS = new vis.DataSet(runtimeNodes);
const edgesDS = new vis.DataSet(runtimeEdges);
const network = new vis.Network(dom.graph, { nodes: nodesDS, edges: edgesDS }, buildNetworkOptions(dashboardOptions.layout));
const adjacency = buildAdjacency(runtimeNodes, runtimeEdges);

const state = {
  currentView: 'leaf',
  selectedNodeId: '',
  selectedEdgeId: '',
  focusRootId: '',
  traceDirection: 'both',
  enabledNodeTypes: new Set(runtimeNodes.map((node) => node._type)),
  enabledEdgeTypes: new Set(runtimeEdges.map((edge) => edge._type)),
  hiddenGroups: new Set(),
  showEdgeLabels: true,
  hideIsolated: Boolean(dashboardOptions.hideIsolated),
  compactResourceEdges: true,
  resourceEdgeCap: 10
};

const firstRenderStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
wireControls();
renderLegend();
renderDiagnostics();
renderTypeFilters();
showWelcome();
applyGraphState();
fitGraph();
console.log('[TriadMind] Runtime first render: ' + elapsedMs(firstRenderStartedAt) + 'ms');

if (dashboardOptions.interactive !== false) {
  network.on('click', onGraphClick);
  network.on('doubleClick', onGraphDoubleClick);
}
network.on('hoverNode', function() { dom.graph.style.cursor = 'pointer'; });
network.on('blurNode', function() { dom.graph.style.cursor = 'default'; });

function buildNetworkOptions(layout) {
  if (layout === 'dagre') {
    return {
      layout: { hierarchical: { enabled: true, direction: 'LR', sortMethod: 'directed', levelSeparation: 180, nodeSpacing: 220 } },
      physics: { enabled: false },
      interaction: { hover: true, tooltipDelay: 80, hideEdgesOnDrag: true, navigationButtons: true, keyboard: false },
      edges: { selectionWidth: 4 }
    };
  }
  return {
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: { gravitationalConstant: -78, centralGravity: 0.007, springLength: 150, springConstant: 0.08, damping: 0.42, avoidOverlap: 0.88 },
      stabilization: { iterations: 240, fit: true }
    },
    interaction: { hover: true, tooltipDelay: 80, hideEdgesOnDrag: true, navigationButtons: true, keyboard: false },
    nodes: { shadow: { enabled: true, color: 'rgba(0,0,0,.35)', size: 10, x: 0, y: 2 } },
    edges: { selectionWidth: 4 }
  };
}

function buildAdjacency(nodes, edges) {
  const byNode = new Map();
  const incoming = new Map();
  const outgoing = new Map();
  nodes.forEach((node) => {
    byNode.set(node.id, []);
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  });
  edges.forEach((edge) => {
    byNode.get(edge.from).push(edge);
    byNode.get(edge.to).push(edge);
    outgoing.get(edge.from).push(edge);
    incoming.get(edge.to).push(edge);
  });
  return { byNode, incoming, outgoing };
}

function wireControls() {
  dom.search.addEventListener('input', onSearchInput);
  dom.searchInline.addEventListener('input', function(event) {
    dom.search.value = event.target.value;
    onSearchInput();
  });
  dom.hideIsolated.checked = state.hideIsolated;
  dom.hideIsolated.addEventListener('change', function() {
    state.hideIsolated = dom.hideIsolated.checked;
    applyGraphState();
  });
  dom.layoutSelect.value = dashboardOptions.layout;
  dom.layoutSelect.addEventListener('change', function() {
    network.setOptions(buildNetworkOptions(dom.layoutSelect.value === 'dagre' ? 'dagre' : 'leaf-force'));
    fitGraph();
  });
  dom.viewLeaf.addEventListener('click', function() {
    state.currentView = 'leaf';
    syncViewButtons();
    applyGraphState();
  });
  dom.viewFlow.addEventListener('click', function() {
    state.currentView = 'flow';
    syncViewButtons();
    applyGraphState();
  });
  dom.traceUpstream.addEventListener('click', function() {
    state.traceDirection = 'upstream';
    applyGraphState();
  });
  dom.traceDownstream.addEventListener('click', function() {
    state.traceDirection = 'downstream';
    applyGraphState();
  });
  dom.traceBoth.addEventListener('click', function() {
    state.traceDirection = 'both';
    applyGraphState();
  });
  dom.resetView.addEventListener('click', resetViewState);
  dom.fitView.addEventListener('click', fitGraph);
  dom.edgeLabelToggle.addEventListener('click', function() {
    state.showEdgeLabels = !state.showEdgeLabels;
    dom.edgeLabelToggle.classList.toggle('active', state.showEdgeLabels);
    dom.edgeLabelToggle.textContent = state.showEdgeLabels ? 'Edge Labels: on' : 'Edge Labels: off';
    applyGraphState();
  });
  dom.toggleClusters.addEventListener('click', function() {
    state.compactResourceEdges = !state.compactResourceEdges;
    dom.toggleClusters.classList.toggle('active', state.compactResourceEdges);
    dom.toggleClusters.textContent = state.compactResourceEdges ? 'Edge Bundling: on' : 'Edge Bundling: off';
    applyGraphState();
  });
  dom.infoContent.addEventListener('click', function(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const nodeId = target.getAttribute('data-node-id');
    if (!nodeId) return;
    focusNode(nodeId);
  });
}

function syncViewButtons() {
  dom.viewLeaf.classList.toggle('active', state.currentView === 'leaf');
  dom.viewFlow.classList.toggle('active', state.currentView === 'flow');
}

function onSearchInput() {
  const query = (dom.search.value || '').trim().toLowerCase();
  dom.searchInline.value = dom.search.value;
  dom.searchResults.innerHTML = '';
  if (!query) {
    dom.searchResults.style.display = 'none';
    return;
  }
  const matches = runtimeNodes.filter((node) => node._searchText.includes(query)).slice(0, 25);
  if (!matches.length) {
    dom.searchResults.style.display = 'none';
    return;
  }
  dom.searchResults.style.display = 'block';
  matches.forEach((node) => {
    const item = document.createElement('div');
    item.className = 'search-item';
    item.textContent = node.label + ' [' + node._type + ']';
    item.style.borderLeft = '3px solid ' + (node.color && node.color.border ? node.color.border : '#64748b');
    item.addEventListener('click', function() {
      focusNode(node.id);
      dom.search.value = '';
      dom.searchInline.value = '';
      dom.searchResults.style.display = 'none';
    });
    dom.searchResults.appendChild(item);
  });
}

function renderTypeFilters() {
  const nodeTypes = Array.from(new Set(runtimeNodes.map((node) => node._type))).sort();
  dom.nodeTypeFilters.innerHTML = '';
  nodeTypes.forEach((type) => {
    const row = document.createElement('label');
    row.className = 'filter-row';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = true;
    input.addEventListener('change', function() {
      if (input.checked) state.enabledNodeTypes.add(type); else state.enabledNodeTypes.delete(type);
      applyGraphState();
    });
    row.appendChild(input);
    row.appendChild(document.createTextNode(type));
    dom.nodeTypeFilters.appendChild(row);
  });
  const edgeTypes = Array.from(new Set(runtimeEdges.map((edge) => edge._type))).sort();
  dom.edgeTypeFilters.innerHTML = '';
  edgeTypes.forEach((type) => {
    const row = document.createElement('label');
    row.className = 'filter-row';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = true;
    input.addEventListener('change', function() {
      if (input.checked) state.enabledEdgeTypes.add(type); else state.enabledEdgeTypes.delete(type);
      applyGraphState();
    });
    row.appendChild(input);
    row.appendChild(document.createTextNode(type));
    dom.edgeTypeFilters.appendChild(row);
  });
}

function renderLegend() {
  dom.legend.innerHTML = '';
  runtimeLegend.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'legend-item';
    row.innerHTML = '<span class="legend-dot" style="background:' + esc(item.color) + '"></span><span class="legend-label">' + esc(item.label) + '</span><span class="legend-count">' + esc(item.count) + '</span>';
    row.addEventListener('click', function() {
      if (state.hiddenGroups.has(item.cid)) state.hiddenGroups.delete(item.cid); else state.hiddenGroups.add(item.cid);
      row.classList.toggle('dimmed', state.hiddenGroups.has(item.cid));
      applyGraphState();
    });
    dom.legend.appendChild(row);
  });
}

function renderDiagnostics() {
  const diagnostics = runtimeMap.diagnostics || [];
  if (!diagnostics.length) {
    dom.diagnostics.innerHTML = '<span class="empty">No runtime diagnostics.</span>';
    return;
  }
  dom.diagnostics.innerHTML = diagnostics.slice(0, 60).map((item) => {
    const source = item.sourcePath ? ' [' + esc(item.sourcePath) + ']' : '';
    const extractor = item.extractor ? ' (' + esc(item.extractor) + ')' : '';
    return '<div style="font-size:12px;line-height:1.5;margin-bottom:6px">[' + esc(item.level) + ']' + extractor + ' ' + esc(item.message) + source + '</div>';
  }).join('');
}

function onGraphClick(params) {
  if (params.nodes && params.nodes.length > 0) {
    selectNode(params.nodes[0]);
    return;
  }
  if (params.edges && params.edges.length > 0) {
    selectEdge(params.edges[0]);
    return;
  }
  clearSelection();
}

function onGraphDoubleClick(params) {
  if (!params.nodes || params.nodes.length === 0) return;
  const nodeId = params.nodes[0];
  state.focusRootId = state.focusRootId === nodeId ? '' : nodeId;
  applyGraphState();
}

function clearSelection() {
  state.selectedNodeId = '';
  state.selectedEdgeId = '';
  showWelcome();
  applyGraphState();
}

function focusNode(nodeId) {
  selectNode(nodeId);
  network.focus(nodeId, { scale: 1.3, animation: true });
}

function selectNode(nodeId) {
  state.selectedNodeId = nodeId;
  state.selectedEdgeId = '';
  network.selectNodes([nodeId]);
  showNodeInfo(nodeId);
  applyGraphState();
}

function selectEdge(edgeId) {
  state.selectedEdgeId = edgeId;
  state.selectedNodeId = '';
  network.selectEdges([edgeId]);
  showEdgeInfo(edgeId);
  applyGraphState();
}

function resetViewState() {
  state.selectedNodeId = '';
  state.selectedEdgeId = '';
  state.focusRootId = '';
  state.traceDirection = 'both';
  state.currentView = 'leaf';
  syncViewButtons();
  showWelcome();
  applyGraphState();
}

function showWelcome() {
  dom.infoTitle.textContent = 'Node Info';
  dom.infoContent.innerHTML = '<span class="empty">Click a node or edge to inspect.</span>';
}

function showNodeInfo(nodeId) {
  const node = nodesDS.get(nodeId);
  if (!node) return;
  const neighbors = network.getConnectedNodes(nodeId);
  const incomingCount = (adjacency.incoming.get(nodeId) || []).length;
  const outgoingCount = (adjacency.outgoing.get(nodeId) || []).length;
  const neighborsHtml = neighbors.length ? neighbors.map((id) => {
    const target = nodesDS.get(id);
    if (!target) return '';
    return '<span class="neighbor-link" data-node-id="' + escAttr(id) + '" style="border-left:3px solid ' + esc(target.color && target.color.border ? target.color.border : '#64748b') + '">' + esc(target.label) + '</span>';
  }).join('') : '<span class="empty">No neighbors</span>';
  dom.infoTitle.textContent = 'Node Info';
  dom.infoContent.innerHTML =
    '<div style="font-size:14px;color:#f8fafc;margin-bottom:8px">' + esc(node.label) + '</div>' +
    '<div class="detail-grid"><b>ID</b><span>' + esc(node.id) + '</span><b>Type</b><span><span class="pill">' + esc(node._type) + '</span></span><b>Group</b><span><span class="pill">' + esc(node._group) + '</span></span><b>Source</b><span>' + esc(node._sourcePath || '-') + '</span><b>Framework</b><span>' + esc(node._framework || '-') + '</span></div>' +
    '<div class="runtime-flow-card"><div class="flow-col flow-in"><b>Upstream</b><small>incoming</small>' + esc(incomingCount) + '</div><div class="flow-col flow-core"><b>Node</b><small>current</small>' + esc(node.label) + '</div><div class="flow-col flow-out"><b>Downstream</b><small>outgoing</small>' + esc(outgoingCount) + '</div></div>' +
    '<div style="margin-top:8px;font-size:11px;color:#94a3b8">Neighbors</div>' + neighborsHtml +
    '<div style="margin-top:10px;font-size:11px;color:#94a3b8">Metadata</div>' + renderJson(node._metadata) +
    '<div style="margin-top:10px;font-size:11px;color:#94a3b8">Evidence</div>' + renderEvidence(node._evidence);
}

function showEdgeInfo(edgeId) {
  const edge = edgesDS.get(edgeId);
  if (!edge) return;
  const from = nodesDS.get(edge.from);
  const to = nodesDS.get(edge.to);
  dom.infoTitle.textContent = 'Edge Info';
  dom.infoContent.innerHTML =
    '<div style="font-size:14px;color:#f8fafc;margin-bottom:8px">' + esc(edge._type) + '</div>' +
    '<div class="detail-grid"><b>ID</b><span>' + esc(edge.id) + '</span><b>From</b><span><span class="neighbor-link" data-node-id="' + escAttr(edge.from) + '">' + esc(from ? from.label : edge.from) + '</span></span><b>To</b><span><span class="neighbor-link" data-node-id="' + escAttr(edge.to) + '">' + esc(to ? to.label : edge.to) + '</span></span><b>Type</b><span><span class="pill">' + esc(edge._type) + '</span></span><b>Confidence</b><span>' + esc((edge._confidence || 0).toFixed(2)) + '</span></div>' +
    '<div style="margin-top:10px;font-size:11px;color:#94a3b8">Metadata</div>' + renderJson(edge._metadata) +
    '<div style="margin-top:10px;font-size:11px;color:#94a3b8">Evidence</div>' + renderEvidence(edge._evidence);
}

function renderJson(value) {
  if (!value || Object.keys(value).length === 0) return '<span class="empty">None</span>';
  return '<pre style="white-space:pre-wrap;word-break:break-word;background:#0b1224;border:1px solid #334155;border-radius:8px;padding:8px;color:#dce8ff;font-size:12px;max-height:180px;overflow:auto">' + esc(JSON.stringify(value, null, 2)) + '</pre>';
}

function renderEvidence(evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) return '<span class="empty">No evidence</span>';
  return evidence.slice(0, 20).map((item) => {
    const source = item && item.sourcePath ? item.sourcePath : '-';
    const line = item && item.line ? ':' + item.line : '';
    const kind = item && item.kind ? item.kind : 'inferred';
    const text = item && item.text ? item.text : '';
    return '<div style="font-size:12px;line-height:1.5;margin-bottom:6px;border-left:2px solid #334155;padding-left:8px"><div><span class="pill">' + esc(kind) + '</span> ' + esc(source + line) + '</div><div style="color:#94a3b8">' + esc(text) + '</div></div>';
  }).join('');
}

function applyGraphState() {
  const visible = computeVisibleSets();
  const highlight = computeHighlightSets(visible.nodeIds, visible.edgeIds);
  nodesDS.update(runtimeNodes.map((node) => {
    const isVisible = visible.nodeIds.has(node.id);
    const isSelected = state.selectedNodeId === node.id;
    const isNeighbor = highlight.neighborNodeIds.has(node.id);
    const isTrace = highlight.traceNodeIds.has(node.id);
    const isDimmed = !isSelected && !isNeighbor && !isTrace && (state.selectedNodeId || state.selectedEdgeId);
    return {
      id: node.id,
      hidden: !isVisible,
      borderWidth: isSelected ? 4 : isTrace ? 3.2 : isNeighbor ? 2.8 : 1.8,
      color: { background: isDimmed ? withAlpha(node.color.background, 0.3) : node.color.background, border: isSelected ? '#7dd3fc' : isTrace ? '#fcd34d' : isNeighbor ? '#f8fafc' : node.color.border, highlight: node.color.highlight },
      font: { ...node.font, color: isDimmed ? 'rgba(248,250,252,0.42)' : '#f8fafc' }
    };
  }));
  edgesDS.update(runtimeEdges.map((edge) => {
    const isVisible = visible.edgeIds.has(edge.id);
    const isSelected = state.selectedEdgeId === edge.id;
    const isNeighbor = highlight.neighborEdgeIds.has(edge.id);
    const isTrace = highlight.traceEdgeIds.has(edge.id);
    const isDimmed = !isSelected && !isNeighbor && !isTrace && (state.selectedNodeId || state.selectedEdgeId);
    return {
      id: edge.id,
      hidden: !isVisible,
      label: state.showEdgeLabels ? edge.label : '',
      width: isSelected ? Math.max(edge.width, 4.2) : isTrace ? Math.max(edge.width, 3.8) : isNeighbor ? Math.max(edge.width, 3.2) : edge.width,
      color: { ...edge.color, color: isSelected ? '#7dd3fc' : isTrace ? '#fcd34d' : edge.color.color, opacity: isDimmed ? 0.28 : edge.color.opacity },
      font: { ...edge.font, color: isDimmed ? 'rgba(226,232,240,0.4)' : edge.font.color }
    };
  }));
  if (visible.suppressedEdges > 0 && state.compactResourceEdges) {
    dom.notice.textContent = 'Edge bundling active: hidden ' + visible.suppressedEdges + ' dense resource edges.';
  } else {
    dom.notice.textContent = 'Runtime graph uses vis-network and matches visualizer control semantics.';
  }
}

function computeVisibleSets() {
  const nodeIds = new Set();
  runtimeNodes.forEach((node) => {
    if (!state.enabledNodeTypes.has(node._type)) return;
    if (state.hiddenGroups.has(node._group)) return;
    if (state.currentView === 'flow' && !FLOW_ALLOWED.has(node._group)) return;
    nodeIds.add(node.id);
  });
  let edgeIds = new Set();
  runtimeEdges.forEach((edge) => {
    if (!state.enabledEdgeTypes.has(edge._type)) return;
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) return;
    edgeIds.add(edge.id);
  });
  if (state.hideIsolated) {
    const connected = new Set();
    edgeIds.forEach((id) => {
      const edge = edgesDS.get(id);
      if (!edge) return;
      connected.add(edge.from); connected.add(edge.to);
    });
    Array.from(nodeIds).forEach((id) => { if (!connected.has(id)) nodeIds.delete(id); });
    edgeIds = new Set(Array.from(edgeIds).filter((id) => {
      const edge = edgesDS.get(id);
      return edge && nodeIds.has(edge.from) && nodeIds.has(edge.to);
    }));
  }
  if (state.focusRootId && nodeIds.has(state.focusRootId)) {
    const focused = traceFrom(state.focusRootId, 'both', normalizedDepth(), edgeIds);
    edgeIds = focused.edgeIds;
    Array.from(nodeIds).forEach((id) => { if (!focused.nodeIds.has(id)) nodeIds.delete(id); });
  }
  let suppressedEdges = 0;
  if (state.compactResourceEdges) {
    const keep = new Set(edgeIds);
    denseResourceNodeIds.forEach((resourceId) => {
      if (!nodeIds.has(resourceId) || state.selectedNodeId === resourceId) return;
      const connected = (adjacency.byNode.get(resourceId) || []).map((edge) => edge.id).filter((id) => keep.has(id));
      if (connected.length <= state.resourceEdgeCap) return;
      const preferred = connected
        .map((id) => edgesDS.get(id))
        .filter(Boolean)
        .sort((a, b) => (b._confidence || 0) - (a._confidence || 0))
        .slice(0, state.resourceEdgeCap)
        .map((edge) => edge.id);
      const preferredSet = new Set(preferred);
      connected.forEach((id) => {
        if (!preferredSet.has(id)) { keep.delete(id); suppressedEdges += 1; }
      });
    });
    edgeIds = keep;
  }
  return { nodeIds, edgeIds, suppressedEdges };
}

function computeHighlightSets(nodeIds, edgeIds) {
  const neighborNodeIds = new Set();
  const neighborEdgeIds = new Set();
  const traceNodeIds = new Set();
  const traceEdgeIds = new Set();
  if (state.selectedNodeId && nodeIds.has(state.selectedNodeId)) {
    neighborNodeIds.add(state.selectedNodeId);
    (adjacency.byNode.get(state.selectedNodeId) || []).forEach((edge) => {
      if (!edgeIds.has(edge.id)) return;
      neighborEdgeIds.add(edge.id);
      neighborNodeIds.add(edge.from);
      neighborNodeIds.add(edge.to);
    });
    const trace = traceFrom(state.selectedNodeId, state.traceDirection, normalizedDepth(), edgeIds);
    trace.nodeIds.forEach((id) => traceNodeIds.add(id));
    trace.edgeIds.forEach((id) => traceEdgeIds.add(id));
  }
  if (state.selectedEdgeId && edgeIds.has(state.selectedEdgeId)) {
    const edge = edgesDS.get(state.selectedEdgeId);
    if (edge) {
      neighborEdgeIds.add(edge.id);
      neighborNodeIds.add(edge.from);
      neighborNodeIds.add(edge.to);
    }
  }
  return { neighborNodeIds, neighborEdgeIds, traceNodeIds, traceEdgeIds };
}

function traceFrom(startNodeId, direction, depth, edgeIdFilter) {
  const nodeIds = new Set([startNodeId]);
  const edgeIds = new Set();
  const queue = [{ id: startNodeId, depth: 0 }];
  const visited = new Set([startNodeId + ':0']);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= depth) continue;
    const candidates = getTraceEdges(current.id, direction);
    candidates.forEach((edge) => {
      if (edgeIdFilter && !edgeIdFilter.has(edge.id)) return;
      edgeIds.add(edge.id);
      nodeIds.add(edge.from);
      nodeIds.add(edge.to);
      const next = edge.from === current.id ? edge.to : edge.from;
      const key = next + ':' + (current.depth + 1);
      if (!visited.has(key)) { visited.add(key); queue.push({ id: next, depth: current.depth + 1 }); }
    });
  }
  return { nodeIds, edgeIds };
}

function getTraceEdges(nodeId, direction) {
  if (direction === 'upstream') return adjacency.incoming.get(nodeId) || [];
  if (direction === 'downstream') return adjacency.outgoing.get(nodeId) || [];
  return [...(adjacency.incoming.get(nodeId) || []), ...(adjacency.outgoing.get(nodeId) || [])];
}

function normalizedDepth() {
  const value = Number(dom.traceDepth.value);
  if (Number.isFinite(value) && value > 0) return Math.min(8, Math.floor(value));
  return 2;
}

function fitGraph() {
  network.fit({ animation: true });
}

function withAlpha(color, alpha) {
  if (!color || typeof color !== 'string') return color;
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const expanded = hex.length === 3 ? hex.split('').map((ch) => ch + ch).join('') : hex.slice(0, 6);
    const safeAlpha = Math.max(0, Math.min(1, alpha));
    const alphaHex = Math.round(safeAlpha * 255).toString(16).padStart(2, '0');
    return '#' + expanded + alphaHex;
  }
  return color;
}

function elapsedMs(startedAt) {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return Math.max(0, Math.round(now - startedAt));
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"]/g, function(char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]); });
}

function escAttr(value) {
  return esc(value).replace(/'/g, '&#39;');
}
`;
}
function truncate(value, maxLength) {
    const text = String(value || '');
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}
function normalizePositiveInteger(value, fallback) {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
function normalizeOptionalPositiveInteger(value) {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}
function escapeHtml(value) {
    return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] ?? char));
}
//# sourceMappingURL=runtimeVisualizer.js.map