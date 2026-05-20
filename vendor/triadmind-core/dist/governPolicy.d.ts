import { WorkspacePaths } from './workspace';
export type GovernMetricKey = 'diagnostics_no_code' | 'execute_like_ratio' | 'ghost_ratio' | 'rendered_edges_consistency' | 'runtime_unmatched_route_count' | 'triad_completeness_violations' | 'protocol_focus_alignment_violations' | 'focus_closure_violations' | 'c2c_coupling_count';
export type GovernRuleOperator = 'eq' | 'lt' | 'lte' | 'lte_baseline_factor';
export type GovernCoverageRuleOperator = 'gt' | 'gte';
export type ForbiddenRunMutation = 'modify_policy' | 'modify_baseline';
export interface GovernMetricRule {
    op: GovernRuleOperator;
    value: number | boolean;
}
export interface GovernLanguageGhostPolicy {
    include_in_demand: boolean;
    top_k: number;
    min_confidence: number | 'low' | 'medium' | 'high';
}
export interface GovernCoverageRule {
    metric?: 'triad' | 'runtime' | 'combined';
    op: GovernCoverageRuleOperator;
    value: number;
    must_pass?: boolean;
}
export interface GovernPolicy {
    version: string;
    mode: 'hard';
    must_pass: Record<string, GovernMetricRule>;
    coverage_by_root?: Record<string, GovernCoverageRule>;
    language_ghost_policy?: Record<string, GovernLanguageGhostPolicy>;
    forbidden_in_run?: ForbiddenRunMutation[];
    baseline_path?: string;
}
export declare const DEFAULT_GOVERN_POLICY: GovernPolicy;
export declare function buildDefaultGovernPolicy(): GovernPolicy;
export declare function resolveGovernPolicyPath(paths: WorkspacePaths, overridePath?: string): string;
export declare function ensureGovernPolicyFile(paths: WorkspacePaths): void;
