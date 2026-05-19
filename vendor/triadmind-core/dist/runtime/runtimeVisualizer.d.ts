import { RuntimeMap } from './types';
export type RuntimeVisualizerLayout = 'leaf-force' | 'dagre';
export type RuntimeVisualizerTheme = 'leaf-like' | 'runtime-dark';
export interface RuntimeDashboardOptions {
    title?: string;
    interactive?: boolean;
    layout?: RuntimeVisualizerLayout;
    traceDepth?: number;
    hideIsolated?: boolean;
    maxRenderEdges?: number;
    theme?: RuntimeVisualizerTheme;
}
export interface RuntimeRenderStats {
    sourceEdges: number;
    renderedEdges: number;
    edgeCapApplied: boolean;
    nodeCount: number;
}
export declare function generateRuntimeDashboard(runtimeMapPath: string, outputPath: string, options?: RuntimeDashboardOptions): void;
export declare function calculateRuntimeRenderStats(runtimeMap: RuntimeMap, maxRenderEdges?: number): RuntimeRenderStats;
