import Parser = require('tree-sitter');

export interface TreeSitterBindingProfile {
    identifierNodes: readonly string[];
    typeOnlyNodes?: readonly string[];
    memberExpressionNodes?: readonly string[];
    skipNodeTypes?: readonly string[];
    dedupe?: boolean;
    mapIdentifierText?: (text: string) => string;
    isMemberPropertyName?: (node: Parser.SyntaxNode) => boolean;
}

export type TreeSitterBindingName = string;
export type TreeSitterBindingNameList = TreeSitterBindingName[];

const DEFAULT_TYPE_ONLY_NODES = ['type_annotation', 'predefined_type', 'type_identifier', 'generic_type', 'type_arguments'] as const;

export function extractParameterBindingNames(
    parametersNode: Parser.SyntaxNode | null,
    profile: TreeSitterBindingProfile
): TreeSitterBindingNameList {
    if (!parametersNode) {
        return [];
    }

    return _finalizeBindingNames(
        parametersNode.namedChildren.flatMap((child) =>
            extractBindingNames(
                _resolveBindingTargetNode(child),
                profile
            )
        ),
        profile
    );
}

export function extractBindingNames(
    node: Parser.SyntaxNode | null,
    profile: TreeSitterBindingProfile
): TreeSitterBindingNameList {
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

    return _finalizeBindingNames(
        _resolveBindingChildNodes(node).flatMap((child) => extractBindingNames(child, profile)),
        profile
    );
}

function _resolveBindingTargetNode(node: Parser.SyntaxNode) {
    return (
        node.childForFieldName('pattern') ??
        node.childForFieldName('name') ??
        node.childForFieldName('left') ??
        node.childForFieldName('value') ??
        node.namedChildren[0] ??
        node
    );
}

function _resolveBindingChildNodes(node: Parser.SyntaxNode) {
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

function _normalizeBindingIdentifier(node: Parser.SyntaxNode, profile: TreeSitterBindingProfile) {
    if (!_matchesNodeType(node.type, profile.identifierNodes) || profile.isMemberPropertyName?.(node)) {
        return null;
    }

    const identifier = profile.mapIdentifierText ? profile.mapIdentifierText(node.text) : node.text;
    return identifier || null;
}

function _shouldSkipBindingNode(node: Parser.SyntaxNode, profile: TreeSitterBindingProfile) {
    return _matchesNodeType(node.type, profile.memberExpressionNodes) || _matchesNodeType(node.type, profile.skipNodeTypes);
}

function _isTypeOnlyNode(nodeType: string, profile: TreeSitterBindingProfile): boolean {
    return _matchesNodeType(nodeType, profile.typeOnlyNodes ?? DEFAULT_TYPE_ONLY_NODES);
}

function _matchesNodeType(nodeType: string, nodeTypes?: readonly string[]): boolean {
    return Boolean(nodeTypes?.includes(nodeType));
}

function _finalizeBindingNames(
    names: TreeSitterBindingNameList,
    profile: TreeSitterBindingProfile
): TreeSitterBindingNameList {
    return profile.dedupe ? Array.from(new Set(names)) : names;
}
