"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTopologyIR = buildTopologyIR;
const protocol_1 = require("./protocol");
function buildTopologyIR(nodes, language) {
    const vertexMap = new Map();
    for (const node of nodes) {
        const ref = (0, protocol_1.parseNodeRef)(node.nodeId, node.category);
        const vertexKey = `${node.category ?? 'core'}:${ref.className}:${node.sourcePath ?? ''}`;
        const existing = vertexMap.get(vertexKey) ??
            {
                nodeId: `${ref.className}`,
                category: node.category,
                sourcePath: node.sourcePath,
                lifecycle: node.lifecycle,
                container: {
                    kind: node.sourcePath ? 'class' : 'module',
                    name: ref.className
                },
                staticRightBranch: dedupeStrings(node.fission.demand),
                dynamicLeftBranch: []
            };
        existing.staticRightBranch = dedupeStrings([...existing.staticRightBranch, ...node.fission.demand]);
        existing.dynamicLeftBranch.push({
            nodeId: node.nodeId,
            name: ref.methodName,
            demand: node.fission.demand,
            answer: node.fission.answer,
            responsibility: node.fission.problem,
            lifecycle: node.lifecycle
        });
        vertexMap.set(vertexKey, existing);
    }
    return {
        language,
        vertices: Array.from(vertexMap.values()).sort((left, right) => left.nodeId.localeCompare(right.nodeId))
    };
}
function dedupeStrings(values) {
    return Array.from(new Set(values));
}
//# sourceMappingURL=ir.js.map