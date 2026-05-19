import Parser = require('tree-sitter');
export type TreeSitterGhostAccessMode = 'read' | 'write' | 'readwrite';
export type TreeSitterGhostReferenceKind = 'self' | 'external';
export interface TreeSitterGhostReference {
    kind: TreeSitterGhostReferenceKind;
    label: string;
    rootName: string;
    propertyName?: string;
    mode: TreeSitterGhostAccessMode;
}
export interface TreeSitterGhostScanOptions {
    parameterNodes?: string[];
    localDeclarationNodes?: string[];
    identifierNodes?: string[];
    memberExpressionNodes?: string[];
    functionBodyNodes?: string[];
    selfNames?: string[];
    ignoreNames?: string[];
}
export declare function scanTreeSitterGhostReferences(executableNode: Parser.SyntaxNode, options?: TreeSitterGhostScanOptions): TreeSitterGhostReference[];
