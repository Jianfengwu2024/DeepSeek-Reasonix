import Parser = require('triadmind-tree-sitter');
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
export declare function extractParameterBindingNames(parametersNode: Parser.SyntaxNode | null, profile: TreeSitterBindingProfile): TreeSitterBindingNameList;
export declare function extractBindingNames(node: Parser.SyntaxNode | null, profile: TreeSitterBindingProfile): TreeSitterBindingNameList;
