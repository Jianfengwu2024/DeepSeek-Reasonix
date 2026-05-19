"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRuntimeGraphIndex = buildRuntimeGraphIndex;
exports.traceRuntimeGraph = traceRuntimeGraph;
exports.filterRuntimeGraph = filterRuntimeGraph;
const runtimeUtils_1 = require("./runtimeUtils");
function buildRuntimeGraphIndex(runtimeMap) {
    const nodeById = new Map();
    const edgeById = new Map();
    const incoming = new Map();
    const outgoing = new Map();
    for (const node of runtimeMap.nodes) {
        nodeById.set(node.id, node);
        incoming.set(node.id, []);
        outgoing.set(node.id, []);
    }
    const edges = runtimeMap.edges
        .filter((edge) => nodeById.has(edge.from) && nodeById.has(edge.to))
        .map((edge) => ({
        ...edge,
        id: edge.id ?? (0, runtimeUtils_1.normalizeRuntimeId)(`RuntimeEdge.${edge.from}.${edge.type}.${edge.to}`)
    }));
    for (const edge of edges) {
        edgeById.set(edge.id, edge);
        outgoing.get(edge.from)?.push(edge);
        incoming.get(edge.to)?.push(edge);
    }
    return {
        nodes: runtimeMap.nodes,
        edges,
        nodeById,
        edgeById,
        incoming,
        outgoing
    };
}
function traceRuntimeGraph(index, startNodeId, direction, depth) {
    const maxDepth = Math.max(0, Math.floor(depth));
    const nodeIds = new Set();
    const edgeIds = new Set();
    if (!index.nodeById.has(startNodeId)) {
        return { nodeIds, edgeIds };
    }
    nodeIds.add(startNodeId);
    const queue = [{ nodeId: startNodeId, depth: 0 }];
    const visited = new Set([`${startNodeId}:0`]);
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || current.depth >= maxDepth) {
            continue;
        }
        const edges = getTraceEdges(index, current.nodeId, direction);
        for (const edge of edges) {
            const nextNodeId = edge.from === current.nodeId ? edge.to : edge.from;
            edgeIds.add(edge.id);
            nodeIds.add(edge.from);
            nodeIds.add(edge.to);
            const visitKey = `${nextNodeId}:${current.depth + 1}`;
            if (!visited.has(visitKey)) {
                visited.add(visitKey);
                queue.push({ nodeId: nextNodeId, depth: current.depth + 1 });
            }
        }
    }
    return { nodeIds, edgeIds };
}
function filterRuntimeGraph(index, filters = {}) {
    const query = normalizeQuery(filters.query);
    const nodeTypes = toSet(filters.nodeTypes);
    const edgeTypes = toSet(filters.edgeTypes);
    const includeNodeIds = toSet(filters.includeNodeIds);
    const nodes = index.nodes.filter((node) => {
        if (nodeTypes && !nodeTypes.has(node.type)) {
            return false;
        }
        if (includeNodeIds && !includeNodeIds.has(node.id)) {
            return false;
        }
        if (query && !matchesNodeQuery(node, query)) {
            return false;
        }
        return true;
    });
    const visibleNodeIds = new Set(nodes.map((node) => node.id));
    const edges = index.edges.filter((edge) => visibleNodeIds.has(edge.from) &&
        visibleNodeIds.has(edge.to) &&
        (!edgeTypes || edgeTypes.has(edge.type)));
    if (!filters.hideIsolated) {
        return { nodes, edges };
    }
    const connectedNodeIds = new Set();
    for (const edge of edges) {
        connectedNodeIds.add(edge.from);
        connectedNodeIds.add(edge.to);
    }
    return {
        nodes: nodes.filter((node) => connectedNodeIds.has(node.id)),
        edges
    };
}
function getTraceEdges(index, nodeId, direction) {
    if (direction === 'upstream') {
        return index.incoming.get(nodeId) ?? [];
    }
    if (direction === 'downstream') {
        return index.outgoing.get(nodeId) ?? [];
    }
    return [...(index.incoming.get(nodeId) ?? []), ...(index.outgoing.get(nodeId) ?? [])];
}
function matchesNodeQuery(node, query) {
    return [node.id, node.label, node.type, node.sourcePath ?? '', node.framework ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query);
}
function normalizeQuery(value) {
    return String(value ?? '').trim().toLowerCase();
}
function toSet(value) {
    if (!value) {
        return undefined;
    }
    return value instanceof Set ? value : new Set(value);
}
//# sourceMappingURL=runtimeGraph.js.map