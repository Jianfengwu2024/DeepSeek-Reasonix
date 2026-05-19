import { RuntimeEdge, RuntimeEvidence, RuntimeNode, RuntimeSourceFile } from './types';
export declare function normalizeRuntimeId(value: string): string;
export declare function findLineColumn(content: string, index: number): {
    line: number;
    column: number;
};
export declare function lineEvidence(file: RuntimeSourceFile, kind: RuntimeEvidence['kind'], text: string, index?: number, confidence?: number): RuntimeEvidence;
export declare function inferredEvidence(sourcePath?: string, confidence?: number, text?: string): {
    sourcePath: string | undefined;
    kind: "inferred";
    text: string;
    confidence: number;
};
export declare function ensureNodeEvidence(node: RuntimeNode): RuntimeNode;
export declare function ensureEdgeEvidence(edge: RuntimeEdge): RuntimeEdge;
export declare function dedupeEvidence(evidence: RuntimeEvidence[]): RuntimeEvidence[];
export declare function mergeRuntimeNodes(nodes: RuntimeNode[]): RuntimeNode[];
export declare function mergeRuntimeEdges(edges: RuntimeEdge[]): {
    id: string;
    from: string;
    to: string;
    type: import("./types").RuntimeEdgeType;
    label?: string;
    metadata?: Record<string, unknown>;
    evidence?: RuntimeEvidence[];
    confidence?: number;
}[];
export declare function inferServiceId(callExpression: string): string;
export declare function toPascalServiceName(value: string): string;
export declare function toPascalCase(value: string): string;
export declare function labelFromPath(relativePath: string): string;
export declare function normalizeApiPath(pathValue: string): string;
export declare function normalizeApiComparablePath(pathValue: string): string;
export declare function buildApiPathVariants(pathValue: string): string[];
export declare function apiRouteId(method: string, routePath: string): string;
