import { FunctionDeclarationStructure, MethodDeclarationStructure, OptionalKind, ParameterDeclarationStructure, SourceFile } from 'ts-morph';
import { ParsedNodeRef, TriadNodeDefinition } from './protocol';
export interface NodeLocationMap {
    [nodeId: string]: string;
}
/**
 * @RightBranch
 */
export declare function getBuiltinTypeNames(): Set<string>;
/**
 * @RightBranch
 */
export declare function resolveSourceFilePath(projectRoot: string, ref: ParsedNodeRef, node: TriadNodeDefinition, nodeLocations: NodeLocationMap): string;
/**
 * @RightBranch
 */
export declare function buildParameters(demand: string[]): OptionalKind<ParameterDeclarationStructure>[];
/**
 * @RightBranch
 */
export declare function buildMethodStructure(ref: ParsedNodeRef, node: TriadNodeDefinition, parameters: OptionalKind<ParameterDeclarationStructure>[], returnType: string, includeTodo: boolean): OptionalKind<MethodDeclarationStructure>;
/**
 * @RightBranch
 */
export declare function buildFunctionStructure(ref: ParsedNodeRef, node: TriadNodeDefinition, parameters: OptionalKind<ParameterDeclarationStructure>[], returnType: string, includeTodo: boolean): OptionalKind<FunctionDeclarationStructure>;
/**
 * @RightBranch
 */
export declare function shouldUseTopLevelFunction(sourceFile: SourceFile, ref: ParsedNodeRef, sourcePath?: string): boolean;
/**
 * @RightBranch
 */
export declare function collectTypeTokens(typeText: string): string[];
/**
 * @RightBranch
 */
export declare function normalizeToken(value: string): string;
/**
 * @RightBranch
 */
export declare function resolveTypesModuleSpecifier(projectRoot: string, sourceFile: SourceFile): string;
/**
 * @RightBranch
 */
export declare function buildTodoStatement(nodeId: string, responsibility: string): string;
/**
 * @RightBranch
 */
export declare function buildTriadGeneratedDoc(responsibility: string): string;
