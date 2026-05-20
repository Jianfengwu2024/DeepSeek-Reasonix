import type { WorkspacePaths } from './workspace';
export type ProjectAbsToolkitEntryKind = 'interface_or_contract' | 'abstract_class' | 'abstract_function' | 'contract_dependency' | 'abstraction_module';
export type ProjectAbsToolkitStatus = 'candidate' | 'promoted' | 'shared' | 'deprecated';
export type ProjectAbsToolkitReusePolicy = 'reuse_first' | 'reuse_with_adaptation' | 'reference_only';
export type ProjectAbsToolkitStability = 'experimental' | 'candidate' | 'stable' | 'canonical';
export interface ProjectAbsToolkitEntry {
    id: string;
    name: string;
    kind: ProjectAbsToolkitEntryKind;
    status: ProjectAbsToolkitStatus;
    category: string;
    subcategory: string;
    toolkitRelativeDir: string;
    toolkitDocPath: string;
    sourceEntryId: string;
    primarySourcePath: string;
    sourcePaths: string[];
    providerNodeIds: string[];
    consumerNodeIds: string[];
    relatedAbstractions: string[];
    signatures: string[];
    tags: string[];
    abstractionRatio: number;
    reusabilityScore: number;
    whyReusable: string;
    intent: string;
    reusePolicy: ProjectAbsToolkitReusePolicy;
    applicability: string[];
    nonApplicability: string[];
    adaptationRules: string[];
    examples: string[];
    owner: string;
    stability: ProjectAbsToolkitStability;
    notes: string;
    promotedAt: string;
    lastReviewedAt?: string;
}
export interface ProjectAbsToolkitSummary {
    scannedMemoryEntryCount: number;
    promotedEntryCount: number;
    categoryCount: number;
    subcategoryCount: number;
    reuseFirstEntryCount: number;
    stableEntryCount: number;
    canonicalEntryCount: number;
    experimentalEntryCount: number;
}
export interface ProjectAbsToolkitArtifact {
    schemaVersion: '1.0';
    generatedAt: string;
    project: string;
    sourceMemoryFile: string;
    sourceMapFile: string;
    summary: ProjectAbsToolkitSummary;
    entries: ProjectAbsToolkitEntry[];
}
export interface ProjectAbsToolkitSearchResult {
    entry: ProjectAbsToolkitEntry;
    score: number;
    matchedTerms: string[];
}
export interface ProjectAbsToolkitPromptContext {
    summaryLines: string[];
    matches: ProjectAbsToolkitEntry[];
}
export declare function syncProjectAbsToolkitFromMemory(paths: WorkspacePaths): ProjectAbsToolkitArtifact;
export declare function ensureProjectAbsToolkit(paths: WorkspacePaths, options?: {
    force?: boolean;
}): ProjectAbsToolkitArtifact;
export declare function loadProjectAbsToolkit(filePath: string): ProjectAbsToolkitArtifact | undefined;
export declare function searchProjectAbsToolkit(artifact: ProjectAbsToolkitArtifact, query: string, limit?: number): ProjectAbsToolkitSearchResult[];
export declare function buildProjectAbsToolkitPromptContext(paths: WorkspacePaths, demand: string): ProjectAbsToolkitPromptContext;
export declare function formatProjectAbsToolkitPromptJson(entries: ProjectAbsToolkitEntry[]): string;
export declare function renderProjectAbsToolkitMarkdown(artifact: ProjectAbsToolkitArtifact): string;
export declare function exportProjectAbsToolkitMarkdown(artifact: ProjectAbsToolkitArtifact, markdownFile: string): void;
export declare function exportProjectAbsToolkitDirectory(artifact: ProjectAbsToolkitArtifact, toolkitDir: string): void;
export declare function persistProjectAbsToolkit(paths: WorkspacePaths, artifact: ProjectAbsToolkitArtifact): void;
export declare function recalculateProjectAbsToolkitSummary(artifact: ProjectAbsToolkitArtifact, scannedMemoryEntryCount?: number): ProjectAbsToolkitSummary;
