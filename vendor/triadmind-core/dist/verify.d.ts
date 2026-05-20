import { TriadizationFocusGateReport } from './triadizationFocus';
import { WorkspacePaths } from './workspace';
export interface VerifyMetrics {
    triad_nodes: number;
    triad_vertices: number;
    execute_like_count: number;
    execute_like_ratio: number;
    abstraction_profiled_source_count: number;
    abstraction_signal_count: number;
    concrete_signal_count: number;
    abstraction_deficit_index: number;
    flat_variant_cluster_count: number;
    variant_without_contract_cluster_count: number;
    abstraction_hotspot_count: number;
    zero_abstraction_hotspot_count: number;
    ghost_nodes: number;
    ghost_ratio: number;
    runtime_nodes: number;
    runtime_edges: number;
    rendered_runtime_edges: number;
    rendered_edges_consistency: boolean;
    runtime_unmatched_route_count: number;
    diagnostics_total: number;
    diagnostics_no_code: number;
    ghost_ratio_by_language: Record<string, number>;
    ghost_in_demand_count_by_language: Record<string, number>;
    ghost_policy_violations: number;
    left_only_vertices: number;
    right_only_vertices: number;
    empty_vertices: number;
    scale_mixing_vertices: number;
    triad_completeness_violations: number;
    protocol_focus_alignment_violations: number;
    focus_closure_violations: number;
    c2c_coupling_count: number;
    c2c_coupling_hotspots: number;
}
export interface VerifyThresholds {
    diagnostics_no_code: number;
    execute_like_ratio: number;
    ghost_ratio: number;
    abstraction_deficit_index: number;
    variant_without_contract_cluster_count: number;
    zero_abstraction_hotspot_count: number;
    rendered_edges_consistency: boolean;
    runtime_unmatched_route_count?: number;
    ghost_policy_compliance: boolean;
    left_only_vertices: number;
    right_only_vertices: number;
    empty_vertices: number;
    scale_mixing_vertices: number;
    triad_completeness: boolean;
    protocol_focus_alignment: boolean;
    triad_focus_closure: boolean;
}
export interface VerifyCheckResult {
    key: keyof VerifyThresholds;
    status: 'pass' | 'fail' | 'skip';
    expected: number | boolean | string;
    actual: number | boolean | null;
    detail: string;
}
export interface VerifyReport {
    generatedAt: string;
    projectRoot: string;
    artifacts: {
        triadMapFile: string;
        runtimeMapFile: string;
        runtimeDiagnosticsFile: string;
        draftProtocolFile: string;
        microSplitFile: string;
    };
    strict: boolean;
    thresholds: VerifyThresholds;
    metrics: VerifyMetrics;
    checks: VerifyCheckResult[];
    passed: boolean;
    baseline?: {
        path: string;
        runtime_unmatched_route_count: number;
    };
    focus: {
        scope: 'full' | 'impact';
        fallbackToFull: boolean;
        originalTriadNodes: number;
        scopedTriadNodes: number;
        impactProtocolFile: string;
    };
}
export interface VerifyOptions {
    strict?: boolean;
    maxExecuteLikeRatio?: number;
    maxGhostRatio?: number;
    maxUnmatchedRouteCount?: number;
    baselinePath?: string;
    maxRenderEdges?: number;
    updateBaseline?: boolean;
    focus?: 'full' | 'impact';
}
export declare const DEFAULT_ABSTRACTION_DEFICIT_INDEX_LIMIT = 0.55;
export declare const DEFAULT_VARIANT_WITHOUT_CONTRACT_CLUSTER_LIMIT = 0;
export declare const DEFAULT_ZERO_ABSTRACTION_HOTSPOT_LIMIT = 0;
export declare const DEFAULT_ABSTRACTION_HOTSPOT_MIN_CONCRETE_SIGNALS = 4;
export declare const DEFAULT_ABSTRACTION_HOTSPOT_MAX_RATIO = 0.2;
export type { TriadizationFocusGateFailureKind, TriadizationFocusGateReport } from './triadizationFocus';
export declare function evaluateTriadizationFocusGateArtifacts(draftProtocol: unknown, microSplit: unknown): TriadizationFocusGateReport;
export declare function runTopologyVerify(paths: WorkspacePaths, options?: VerifyOptions): VerifyReport;
export declare function formatVerifyReport(report: VerifyReport): string;
