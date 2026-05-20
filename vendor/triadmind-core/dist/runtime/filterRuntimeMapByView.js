"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterRuntimeMapByView = filterRuntimeMapByView;
exports.normalizeRuntimeView = normalizeRuntimeView;
const VIEW_NODE_TYPES = {
    workflow: ['Workflow', 'WorkflowNode', 'WorkflowEdge', 'Task', 'Worker', 'Queue', 'Service'],
    'request-flow': [
        'FrontendEntry',
        'FrontendComponent',
        'ApiRoute',
        'Service',
        'Task',
        'Worker',
        'Queue',
        'DataStore',
        'Cache',
        'ObjectStore',
        'ExternalApi'
    ],
    resources: [
        'Service',
        'WorkflowNode',
        'Task',
        'DataStore',
        'ObjectStore',
        'Cache',
        'FileSystem',
        'ExternalApi',
        'ExternalTool',
        'ModelProvider'
    ],
    events: ['MessageProducer', 'EventConsumer', 'Queue', 'Worker', 'Task'],
    infra: ['DataStore', 'ObjectStore', 'Cache', 'Queue', 'Config', 'Secret', 'Scheduler']
};
function filterRuntimeMapByView(runtimeMap, view) {
    if (view === 'full') {
        return {
            ...runtimeMap,
            view
        };
    }
    const allowedTypes = new Set(VIEW_NODE_TYPES[view]);
    const nodes = runtimeMap.nodes.filter((node) => allowedTypes.has(node.type));
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = runtimeMap.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
    return {
        ...runtimeMap,
        view,
        nodes,
        edges
    };
}
function normalizeRuntimeView(value, fallback = 'full') {
    if (value === 'workflow' ||
        value === 'request-flow' ||
        value === 'resources' ||
        value === 'events' ||
        value === 'infra' ||
        value === 'full') {
        return value;
    }
    return fallback;
}
//# sourceMappingURL=filterRuntimeMapByView.js.map