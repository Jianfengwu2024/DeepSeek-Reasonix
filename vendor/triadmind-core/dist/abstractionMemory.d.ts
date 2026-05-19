import type { ModifyAction, ReuseAction } from './protocolRightBranch';
import { type WorkspacePaths } from './workspace';
export type AbstractionMemoryEntryKind = 'interface_or_contract' | 'abstract_class' | 'abstract_function' | 'contract_dependency' | 'abstraction_module';
export interface AbstractionMemoryEntry {
    id: string;
    name: string;
    kind: AbstractionMemoryEntryKind;
    primarySourcePath: string;
    sourcePaths: string[];
    nodeIds: string[];
    providerNodeIds: string[];
    consumerNodeIds: string[];
    variantClusters: string[];
    relatedAbstractions: string[];
    signatures: string[];
    tags: string[];
    abstractionRatio: number;
    reusabilityScore: number;
    whyReusable: string;
}
export interface AbstractionMemoryArtifact {
    schemaVersion: '1.0';
    generatedAt: string;
    project: string;
    sourceMapFile: string;
    summary: {
        scannedSourceCount: number;
        excludedStableSourceCount: number;
        excludedConfiguredSourceCount: number;
        rememberedEntryCount: number;
        contractEntryCount: number;
        abstractFunctionEntryCount: number;
        moduleEntryCount: number;
        hotspotCount: number;
        variantClusterCount: number;
    };
    entries: AbstractionMemoryEntry[];
}
export interface AbstractionMemorySearchResult {
    entry: AbstractionMemoryEntry;
    score: number;
    matchedTerms: string[];
}
export interface AbstractionMemoryRecommendation {
    entry: AbstractionMemoryEntry;
    score: number;
    matchedTerms: string[];
    rationale: string[];
    suggestedUsage: 'reuse_first' | 'adapt_before_create';
}
export interface AbstractionProtocolActionCandidate {
    kind: 'reuse_seed' | 'modify_seed';
    action: ReuseAction | ModifyAction;
    score: number;
    basedOnEntry: {
        id: string;
        name: string;
        kind: AbstractionMemoryEntryKind;
    };
    rationale: string[];
}
interface PromptMemoryContext {
    summaryLines: string[];
    matches: AbstractionMemoryEntry[];
    recommendations: AbstractionMemoryRecommendation[];
    protocolActionCandidates: AbstractionProtocolActionCandidate[];
}
export declare function syncAbstractionMemory(paths: WorkspacePaths): AbstractionMemoryArtifact;
export declare function loadAbstractionMemory(filePath: string): AbstractionMemoryArtifact | undefined;
export declare function ensureAbstractionMemory(paths: WorkspacePaths, options?: {
    force?: boolean;
    autoSync?: boolean;
}): AbstractionMemoryArtifact;
export declare function searchAbstractionMemory(artifact: AbstractionMemoryArtifact, query: string, limit?: number): AbstractionMemorySearchResult[];
export declare function recommendAbstractionMemory(artifact: AbstractionMemoryArtifact, options: {
    query: string;
    focusNodeId?: string;
    focusSourcePath?: string;
    limit?: number;
}): {
    entry: AbstractionMemoryEntry;
    score: number;
    matchedTerms: string[];
    rationale: string[];
    suggestedUsage: "reuse_first" | "adapt_before_create";
}[];
export declare function buildAbstractionProtocolActionCandidates(paths: WorkspacePaths, input: {
    demand: string;
    focusNodeId?: string;
    limit?: number;
}): AbstractionProtocolActionCandidate[];
export declare function buildAbstractionMemoryPromptContext(paths: WorkspacePaths, demand: string): PromptMemoryContext;
export declare function buildAbstractionMemoryPromptContextWithFocus(paths: WorkspacePaths, input: {
    demand: string;
    focusNodeId?: string;
}): PromptMemoryContext;
export declare function formatAbstractionMemoryPromptJson(entries: AbstractionMemoryEntry[]): string;
export declare function formatAbstractionMemoryRecommendationsJson(recommendations: AbstractionMemoryRecommendation[]): string;
export declare function formatAbstractionProtocolActionCandidatesJson(candidates: AbstractionProtocolActionCandidate[]): string;
export {};
