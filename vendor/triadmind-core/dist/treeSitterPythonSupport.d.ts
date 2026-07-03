import Parser = require('triadmind-tree-sitter');
export type PythonDefinitionType = 'class_definition' | 'function_definition';
export declare function unwrapPythonDefinition(node: Parser.SyntaxNode, expectedType: PythonDefinitionType): Parser.SyntaxNode | null;
export declare function getPythonFunctionDefinitions(parentNode: Parser.SyntaxNode): Parser.SyntaxNode[];
