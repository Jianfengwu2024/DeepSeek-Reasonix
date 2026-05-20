import { RuntimeEdge, RuntimeMap, RuntimeNode, RuntimeNodeType } from './types';
export type RuntimeTraceDirection = 'upstream' | 'downstream' | 'both';
export interface NormalizedRuntimeEdge extends RuntimeEdge {
    id: string;
}
export interface RuntimeGraphIndex {
    nodes: RuntimeNode[];
    edges: NormalizedRuntimeEdge[];
    nodeById: Map<string, RuntimeNode>;
    edgeById: Map<string, NormalizedRuntimeEdge>;
    incoming: Map<string, NormalizedRuntimeEdge[]>;
    outgoing: Map<string, NormalizedRuntimeEdge[]>;
}
export interface RuntimeTraceResult {
    nodeIds: Set<string>;
    edgeIds: Set<string>;
}
export interface RuntimeGraphFilters {
    query?: string;
    nodeTypes?: Set<RuntimeNodeType> | RuntimeNodeType[];
    edgeTypes?: Set<string> | string[];
    hideIsolated?: boolean;
    includeNodeIds?: Set<string> | string[];
}
export declare function buildRuntimeGraphIndex(runtimeMap: RuntimeMap): RuntimeGraphIndex;
export declare function traceRuntimeGraph(index: RuntimeGraphIndex, startNodeId: string, direction: RuntimeTraceDirection, depth: number): RuntimeTraceResult;
export declare function filterRuntimeGraph(index: RuntimeGraphIndex, filters?: RuntimeGraphFilters): {
    nodes: RuntimeNode[];
    edges: NormalizedRuntimeEdge[];
};
