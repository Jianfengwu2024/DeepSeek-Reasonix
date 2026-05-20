"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unwrapPythonDefinition = unwrapPythonDefinition;
exports.getPythonFunctionDefinitions = getPythonFunctionDefinitions;
function unwrapPythonDefinition(node, expectedType) {
    if (node.type === expectedType) {
        return node;
    }
    if (node.type === 'decorated_definition') {
        return node.namedChildren.find((child) => child.type === expectedType) ?? null;
    }
    return null;
}
function getPythonFunctionDefinitions(parentNode) {
    return parentNode.namedChildren
        .map((child) => unwrapPythonDefinition(child, 'function_definition'))
        .filter((node) => Boolean(node));
}
//# sourceMappingURL=treeSitterPythonSupport.js.map