"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractParameterBindingNames = extractParameterBindingNames;
exports.extractBindingNames = extractBindingNames;
const DEFAULT_TYPE_ONLY_NODES = ['type_annotation', 'predefined_type', 'type_identifier', 'generic_type', 'type_arguments'];
function extractParameterBindingNames(parametersNode, profile) {
    if (!parametersNode) {
        return [];
    }
    return _finalizeBindingNames(parametersNode.namedChildren.flatMap((child) => extractBindingNames(_resolveBindingTargetNode(child), profile)), profile);
}
function extractBindingNames(node, profile) {
    if (!node || _isTypeOnlyNode(node.type, profile)) {
        return [];
    }
    if (_shouldSkipBindingNode(node, profile)) {
        return [];
    }
    const identifier = _normalizeBindingIdentifier(node, profile);
    if (identifier) {
        return [identifier];
    }
    return _finalizeBindingNames(_resolveBindingChildNodes(node).flatMap((child) => extractBindingNames(child, profile)), profile);
}
function _resolveBindingTargetNode(node) {
    return (node.childForFieldName('pattern') ??
        node.childForFieldName('name') ??
        node.childForFieldName('left') ??
        node.childForFieldName('value') ??
        node.namedChildren[0] ??
        node);
}
function _resolveBindingChildNodes(node) {
    const valueNode = node.childForFieldName('value');
    if (valueNode) {
        return [valueNode];
    }
    const leftNode = node.childForFieldName('left');
    if (leftNode) {
        return [leftNode];
    }
    const patternNode = node.childForFieldName('pattern');
    if (patternNode) {
        return [patternNode];
    }
    return node.namedChildren;
}
function _normalizeBindingIdentifier(node, profile) {
    if (!_matchesNodeType(node.type, profile.identifierNodes) || profile.isMemberPropertyName?.(node)) {
        return null;
    }
    const identifier = profile.mapIdentifierText ? profile.mapIdentifierText(node.text) : node.text;
    return identifier || null;
}
function _shouldSkipBindingNode(node, profile) {
    return _matchesNodeType(node.type, profile.memberExpressionNodes) || _matchesNodeType(node.type, profile.skipNodeTypes);
}
function _isTypeOnlyNode(nodeType, profile) {
    return _matchesNodeType(nodeType, profile.typeOnlyNodes ?? DEFAULT_TYPE_ONLY_NODES);
}
function _matchesNodeType(nodeType, nodeTypes) {
    return Boolean(nodeTypes?.includes(nodeType));
}
function _finalizeBindingNames(names, profile) {
    return profile.dedupe ? Array.from(new Set(names)) : names;
}
//# sourceMappingURL=treeSitterBindingSupport.js.map