import Parser = require('triadmind-tree-sitter');

export type PythonDefinitionType = 'class_definition' | 'function_definition';

export function unwrapPythonDefinition(
    node: Parser.SyntaxNode,
    expectedType: PythonDefinitionType
): Parser.SyntaxNode | null {
    if (node.type === expectedType) {
        return node;
    }

    if (node.type === 'decorated_definition') {
        return node.namedChildren.find((child) => child.type === expectedType) ?? null;
    }

    return null;
}

export function getPythonFunctionDefinitions(parentNode: Parser.SyntaxNode) {
    return parentNode.namedChildren
        .map((child) => unwrapPythonDefinition(child, 'function_definition'))
        .filter((node): node is Parser.SyntaxNode => Boolean(node));
}
