import { TriadConfigPaths } from './workspace';
import { TriadCategory } from './protocol';
import { RuntimeConfig } from './runtime/types';
export type TriadLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'cpp' | 'java';
export type TriadParserEngine = 'native' | 'tree-sitter';
export type TriadScanMode = 'leaf' | 'capability' | 'module' | 'domain';
export type HelperVerbPolicy = 'suppress' | 'allow';
export type GhostPolicyLanguageKey = TriadLanguage | 'default';
export type NavigatorLlmProvider = 'openai' | 'anthropic';
export type TriadSourcePolicy = 'api' | 'ui' | 'cli' | 'agent' | 'types' | 'tests' | 'migrations' | 'nodes' | 'tasks' | 'services' | 'utils' | 'other';
export interface GhostLanguagePolicy {
    includeInDemand: boolean;
    topK: number;
    minConfidence: number;
}
export type GhostPolicyByLanguage = Partial<Record<GhostPolicyLanguageKey, GhostLanguagePolicy>>;
export type TriadCategoryMap = Record<string, string[]>;
export interface TriadScanScopeRule {
    pathPrefixes?: string[];
    pathSegments?: string[];
    filePatterns?: string[];
    includePatterns?: string[];
    excludePatterns?: string[];
}
export interface TriadScanScope {
    name: string;
    kind: TriadSourcePolicy;
    priority?: number;
    category?: string;
    match?: TriadScanScopeRule;
}
export type TriadCoverageGateScope = 'category' | 'root';
export type TriadCoverageGateMetric = 'triad' | 'runtime' | 'combined';
export type TriadCoverageGateOperator = 'gt' | 'gte';
export interface TriadCoverageGate {
    target: string;
    scope?: TriadCoverageGateScope;
    metric?: TriadCoverageGateMetric;
    op?: TriadCoverageGateOperator;
    value: number;
    mustPass?: boolean;
    phase?: string;
}
export interface TriadGovernanceProfile {
    coverageGates?: TriadCoverageGate[];
}
export type TriadImpactTier = 'exempt' | 'advisory' | 'strict';
export interface TriadImpactTiersConfig {
    shortChainMax: number;
    mediumChainMax: number;
    forceTier: Record<string, TriadImpactTier>;
}
export interface TriadGovernanceScopeConfig {
    scope: 'full' | 'impact';
}
export interface TriadProfile {
    schemaVersion: string;
    categories?: TriadCategoryMap;
    scanScopes?: TriadScanScope[];
    languageAdapters?: Partial<Record<TriadLanguage, string>>;
    extractors?: {
        parser?: string[];
        runtime?: string[];
    };
    governance?: TriadGovernanceProfile;
}
export interface TriadConfig {
    schemaVersion: string;
    architecture: {
        language: TriadLanguage;
        parserEngine: TriadParserEngine;
        adapter: string;
    };
    categories: TriadCategoryMap;
    parser: {
        excludePatterns: string[];
        excludePathPatterns: string[];
        scanCategories: string[];
        scanMode: TriadScanMode;
        leafOutputFile: string;
        capabilityOutputFile: string;
        capabilityThreshold: number;
        excludeTestFiles: boolean;
        excludeMagicMethods: boolean;
        excludePrivateMethods: boolean;
        helperVerbPolicy: HelperVerbPolicy;
        foldHelpersIntoOwner: boolean;
        entryMethodNames: string[];
        excludeNodeNamePatterns: string[];
        ignoreGenericContracts: boolean;
        genericContractIgnoreList: string[];
        includeUntaggedExports: boolean;
        ghostPolicyByLanguage: GhostPolicyByLanguage;
        jsDocTags: {
            triadNode: string;
            leftBranch: string;
            rightBranch: string;
        };
    };
    visualizer: {
        defaultView: 'architecture' | 'leaf';
        showIsolatedCapabilities: boolean;
        maxContractEdges: number;
        maxPrimaryEdges: number;
        fastMode: boolean;
        strictFingerprint: boolean;
        fastMayaThreshold: number;
        fastFingerprintThreshold: number;
        maxFingerprintNodes: number;
        maxFingerprintOwners: number;
        fingerprintTimeoutMs: number;
        maxRenderNodes: number;
        showFoldedLeaves: boolean;
    };
    protocol: {
        minConfidence: number;
        requireConfidence: boolean;
    };
    navigator: {
        autoGenerateProtocol: boolean;
        provider: NavigatorLlmProvider;
        model: string;
        apiKeyEnv: string;
        baseUrl: string;
        timeoutMs: number;
        maxOutputTokens: number;
        temperature: number;
        maxRepairRounds: number;
        failOnLlmError: boolean;
    };
    runtime: RuntimeConfig;
    dream: {
        enabled: boolean;
        idleOnly: boolean;
        minHoursBetweenRuns: number;
        minConfidence: number;
        maxProposals: number;
        autoTriggerEnabled: boolean;
        autoTriggerCommands: string[];
        minEventsBetweenRuns: number;
        scanThrottleMinutes: number;
        lockTimeoutMinutes: number;
        daemonEnabled: boolean;
        daemonIntervalSeconds: number;
        daemonMaxTicksPerRun: number;
        failOnDreamError: boolean;
    };
    runtimeHealing: {
        enabled: boolean;
        maxAutoRetries: number;
        requireHumanApprovalForContractChanges: boolean;
        snapshotStrategy: 'manual' | 'git_commit';
    };
    abstractionMemory: {
        enabled: boolean;
        autoSyncOnPrompt: boolean;
        excludeMatureStableSources: boolean;
        excludeSourcePaths: string[];
        excludeSourcePathPatterns: string[];
        minAbstractionRatio: number;
        maxPromptEntries: number;
        maxSearchResults: number;
    };
    topologyRisk: {
        matureStableNodeIds: string[];
        matureStableNodePatterns: string[];
        matureStableSourcePaths: string[];
        matureStableSourcePathPatterns: string[];
    };
    impactTiers: TriadImpactTiersConfig;
    governance: TriadGovernanceScopeConfig;
    profile?: TriadProfile;
}
export declare function ensureTriadConfig(paths: TriadConfigPaths, force?: boolean): void;
export declare function loadTriadConfig(paths: TriadConfigPaths): TriadConfig;
export declare function registerMatureStableArchitectureAnchor(paths: TriadConfigPaths, anchor: {
    nodeId?: string;
    sourcePath?: string;
}): {
    matureStableNodeIds: string[];
    matureStableNodePatterns: string[];
    matureStableSourcePaths: string[];
    matureStableSourcePathPatterns: string[];
};
export declare function ensureTriadProfile(paths: TriadConfigPaths, force?: boolean): void;
export declare function loadTriadProfile(paths: TriadConfigPaths): TriadProfile;
export declare function resolveCategoryFromConfig(sourcePath: string, config: TriadConfig): TriadCategory;
export declare function resolveCategoryBySourcePath(sourcePath: string | undefined, categories: TriadCategoryMap): TriadCategory | 'unknown';
export declare function resolveSourceScanScope(sourcePath: string | undefined, config: TriadConfig): TriadScanScope | undefined;
export declare function shouldExcludeSourcePath(sourcePath: string, config: TriadConfig): boolean;
export declare function createSourcePathFilter(projectRoot: string, config: TriadConfig): (sourcePath: string) => boolean;
export declare function shouldIncludeRuntimePath(sourcePath: string, config: TriadConfig): boolean;
export declare function describeSourceScanScope(projectRoot: string, config: TriadConfig): {
    mode: string;
    patterns: string[];
};
export declare function shouldSkipWalkPath(value: string): boolean;
export declare function isIgnorableFsError(error: any): boolean;
