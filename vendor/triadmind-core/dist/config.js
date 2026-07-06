"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureTriadConfig = ensureTriadConfig;
exports.loadTriadConfig = loadTriadConfig;
exports.registerMatureStableArchitectureAnchor = registerMatureStableArchitectureAnchor;
exports.ensureTriadProfile = ensureTriadProfile;
exports.loadTriadProfile = loadTriadProfile;
exports.resolveCategoryFromConfig = resolveCategoryFromConfig;
exports.resolveCategoryBySourcePath = resolveCategoryBySourcePath;
exports.resolveSourceScanScope = resolveSourceScanScope;
exports.shouldExcludeSourcePath = shouldExcludeSourcePath;
exports.createSourcePathFilter = createSourcePathFilter;
exports.shouldIncludeRuntimePath = shouldIncludeRuntimePath;
exports.describeSourceScanScope = describeSourceScanScope;
exports.shouldSkipWalkPath = shouldSkipWalkPath;
exports.isIgnorableFsError = isIgnorableFsError;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const artifactPathContracts_1 = require("./artifactPathContracts");
const artifactReaders_1 = require("./artifactReaders");
const supportAbstraction_1 = require("./supportAbstraction");
const workspace_1 = require("./workspace");
const DEFAULT_CONFIG = {
    schemaVersion: '1.1',
    architecture: {
        language: 'typescript',
        parserEngine: 'tree-sitter',
        adapter: '@triadmind/plugin-ts'
    },
    categories: {
        core: []
    },
    parser: {
        excludePatterns: ['node_modules', '.triadmind'],
        excludePathPatterns: [
            'tests',
            'test',
            'schema',
            'schemas',
            'model',
            'models',
            'entity',
            'entities',
            'dto',
            'vo',
            'types',
            'types.py',
            'migrations',
            'alembic/versions',
            '__pycache__',
            'node_modules',
            'venv',
            '.venv',
            '.next',
            'dist',
            'build'
        ],
        scanCategories: ['core'],
        scanMode: 'capability',
        leafOutputFile: '.triadmind/leaf-map.json',
        capabilityOutputFile: '.triadmind/triad-map.json',
        capabilityThreshold: 4,
        excludeTestFiles: true,
        excludeMagicMethods: true,
        excludePrivateMethods: true,
        helperVerbPolicy: 'suppress',
        foldHelpersIntoOwner: true,
        entryMethodNames: [
            'execute',
            'run',
            'handle',
            'process',
            'dispatch',
            'apply',
            'invoke',
            'plan',
            'schedule',
            'orchestrate'
        ],
        excludeNodeNamePatterns: [
            '^(__.*__|_(?!_).*)$',
            '^(test_.+)$',
            '^__.*__$',
            '^(upgrade|downgrade)$'
        ],
        ignoreGenericContracts: true,
        genericContractIgnoreList: [
            'str',
            'string',
            'int',
            'number',
            'bool',
            'boolean',
            'float',
            'dict',
            'object',
            'list',
            'array',
            'any',
            'unknown',
            'json',
            'request',
            'response',
            'path',
            'void',
            'none',
            'dict[str,any]',
            'optional[str]',
            'optional[int]',
            'list[str]',
            'list[any]',
            ...artifactPathContracts_1.INTERNAL_ARTIFACT_PATH_CONTRACT_TYPES
        ],
        includeUntaggedExports: true,
        ghostPolicyByLanguage: {
            default: {
                includeInDemand: true,
                topK: 5,
                minConfidence: 4
            },
            python: {
                includeInDemand: false,
                topK: 0,
                minConfidence: 5
            },
            javascript: {
                includeInDemand: false,
                topK: 0,
                minConfidence: 5
            },
            typescript: {
                includeInDemand: true,
                topK: 4,
                minConfidence: 4
            },
            java: {
                includeInDemand: true,
                topK: 4,
                minConfidence: 4
            },
            go: {
                includeInDemand: true,
                topK: 4,
                minConfidence: 4
            },
            rust: {
                includeInDemand: true,
                topK: 4,
                minConfidence: 5
            },
            cpp: {
                includeInDemand: true,
                topK: 3,
                minConfidence: 4
            }
        },
        jsDocTags: {
            triadNode: 'TriadNode',
            leftBranch: 'LeftBranch',
            rightBranch: 'RightBranch'
        }
    },
    visualizer: {
        defaultView: 'architecture',
        showIsolatedCapabilities: false,
        maxContractEdges: 1200,
        maxPrimaryEdges: 1500,
        fastMode: true,
        strictFingerprint: false,
        fastMayaThreshold: 0,
        fastFingerprintThreshold: 0,
        maxFingerprintNodes: 8,
        maxFingerprintOwners: 50,
        fingerprintTimeoutMs: 50,
        maxRenderNodes: 400,
        showFoldedLeaves: false
    },
    protocol: {
        minConfidence: 0.6,
        requireConfidence: false
    },
    navigator: {
        autoGenerateProtocol: false,
        provider: 'openai',
        model: 'gpt-5',
        apiKeyEnv: 'OPENAI_API_KEY',
        baseUrl: 'https://api.openai.com/v1',
        timeoutMs: 60000,
        maxOutputTokens: 4000,
        temperature: 0.1,
        maxRepairRounds: 1,
        failOnLlmError: false
    },
    runtime: {
        enabled: true,
        defaultView: 'full',
        includeFrontend: true,
        includeInfra: true,
        frameworkHints: [],
        excludePathPatterns: [
            'node_modules',
            '.git',
            '.triadmind',
            'venv',
            '.venv',
            '__pycache__',
            '.pytest_cache',
            '.next',
            'dist',
            'build',
            'tests',
            'test',
            'logs',
            'uploads',
            'fastgpt_data',
            '.run_state',
            'tmp'
        ],
        maxSourceFileBytes: 500000,
        maxScannedFiles: 5000,
        failOnExtractorError: false,
        minConfidence: 0.4
    },
    dream: {
        enabled: true,
        idleOnly: false,
        minHoursBetweenRuns: 24,
        minConfidence: 0.55,
        maxProposals: 5,
        autoTriggerEnabled: true,
        autoTriggerCommands: ['init', 'sync', 'runtime', 'plan', 'apply', 'verify', 'govern', 'trend'],
        minEventsBetweenRuns: 5,
        scanThrottleMinutes: 10,
        lockTimeoutMinutes: 30,
        daemonEnabled: true,
        daemonIntervalSeconds: 180,
        daemonMaxTicksPerRun: 0,
        failOnDreamError: false
    },
    runtimeHealing: {
        enabled: true,
        maxAutoRetries: 3,
        requireHumanApprovalForContractChanges: true,
        snapshotStrategy: 'manual'
    },
    abstractionMemory: {
        enabled: true,
        autoSyncOnPrompt: true,
        excludeMatureStableSources: true,
        excludeSourcePaths: [],
        excludeSourcePathPatterns: [],
        minAbstractionRatio: 0.2,
        maxPromptEntries: 6,
        maxSearchResults: 10
    },
    topologyRisk: {
        matureStableNodeIds: [],
        matureStableNodePatterns: [],
        matureStableSourcePaths: [],
        matureStableSourcePathPatterns: []
    },
    interrogation: {
        autoApproveMaxImpactEdgeCount: 6
    },
    impactTiers: {
        shortChainMax: 2,
        mediumChainMax: 5,
        forceTier: {}
    },
    governance: {
        scope: 'full'
    },
    profile: undefined
};
const LANGUAGE_ADAPTER_PACKAGE = {
    typescript: '@triadmind/plugin-ts',
    javascript: '@triadmind/plugin-js',
    python: '@triadmind/plugin-python',
    go: '@triadmind/plugin-go',
    rust: '@triadmind/plugin-rust',
    cpp: '@triadmind/plugin-cpp',
    java: '@triadmind/plugin-java'
};
const LANGUAGE_PARSER_ENGINE = {
    typescript: 'tree-sitter',
    javascript: 'tree-sitter',
    python: 'tree-sitter',
    go: 'tree-sitter',
    rust: 'tree-sitter',
    cpp: 'tree-sitter',
    java: 'tree-sitter'
};
const DEFAULT_PROFILE = {
    schemaVersion: '1.0',
    categories: {},
    scanScopes: [
        {
            name: 'tests',
            kind: 'tests',
            priority: 100,
            match: {
                pathSegments: ['test', 'tests', '__tests__'],
                filePatterns: ['test_*.py', '*_test.py', '*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx', '*.test.js', '*.spec.js']
            }
        },
        {
            name: 'migrations',
            kind: 'migrations',
            priority: 95,
            match: {
                pathSegments: ['migration', 'migrations', 'alembic']
            }
        },
        {
            name: 'types',
            kind: 'types',
            priority: 90,
            match: {
                pathSegments: ['types', 'schemas', 'schema', 'models', 'model', 'entities', 'entity', 'dto', 'vo']
            }
        },
        {
            name: 'api',
            kind: 'api',
            priority: 80,
            match: {
                pathSegments: ['api', 'apis', 'routes', 'route', 'endpoint', 'endpoints', 'transport', 'http']
            }
        },
        {
            name: 'ui',
            kind: 'ui',
            priority: 70,
            match: {
                pathSegments: ['ui', 'app', 'pages', 'page', 'layouts', 'layout', 'components', 'hooks', 'screens', 'views']
            }
        },
        {
            name: 'cli',
            kind: 'cli',
            priority: 70,
            match: {
                pathSegments: ['cli', 'command', 'commands', 'subcommands', 'handlers', 'parsers']
            }
        },
        {
            name: 'agentic',
            kind: 'agent',
            priority: 65,
            match: {
                pathSegments: ['chat', 'conversation', 'assistant', 'memory', 'planner', 'reasoning', 'tools', 'tooling', 'function_calling', 'session']
            }
        },
        {
            name: 'tasks',
            kind: 'tasks',
            priority: 60,
            match: {
                pathSegments: ['workflow', 'workflows', 'tasks', 'task', 'jobs', 'job', 'orchestration', 'pipelines', 'pipeline', 'stages', 'stage']
            }
        },
        {
            name: 'nodes',
            kind: 'nodes',
            priority: 55,
            match: {
                pathSegments: ['nodes', 'node']
            }
        },
        {
            name: 'services',
            kind: 'services',
            priority: 50,
            match: {
                pathSegments: ['services', 'service', 'integrations', 'integration', 'adapters', 'adapter', 'gateways', 'gateway']
            }
        },
        {
            name: 'utils',
            kind: 'utils',
            priority: 40,
            match: {
                pathSegments: ['utils', 'util', 'helpers', 'helper']
            }
        }
    ],
    languageAdapters: LANGUAGE_ADAPTER_PACKAGE,
    extractors: {
        parser: [],
        runtime: []
    },
    governance: {
        coverageGates: []
    }
};
const HARD_EXCLUDE_SEGMENTS = new Set([
    'db',
    'database',
    'databases',
    'prisma',
    'migration',
    'migrations',
    'test',
    'tests',
    '__tests__',
    'spec',
    'specs',
    '.next',
    'venv',
    '.venv',
    '__pycache__',
    '.pytest_cache',
    'script',
    'scripts',
    'env',
    'vendor',
    'logs',
    'uploads',
    'fastgpt_data',
    '.run_state',
    'tmp',
    'dist',
    'build',
    'target'
]);
const HARD_EXCLUDE_BASENAME_PATTERNS = [/^\.env(\..+)?$/i, /^diagnostic\.data$/i];
const HARD_EXCLUDE_SOURCE_FILE_PATTERNS = [
    /^test_.*\.py$/i,
    /^.*_test\.py$/i,
    /^.*\.(spec|test)\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i,
    /^.*_test\.go$/i
];
function ensureTriadConfig(paths, force = false) {
    fs.mkdirSync(paths.triadDir, { recursive: true });
    if (force || !fs.existsSync(paths.configFile)) {
        const detectedLanguage = detectProjectLanguage(paths.projectRoot);
        fs.writeFileSync(paths.configFile, JSON.stringify(buildDefaultConfig(detectedLanguage), null, 2), 'utf-8');
    }
    ensureTriadProfile(paths, force);
}
function loadTriadConfig(paths) {
    ensureTriadConfig(paths);
    const merged = loadMergedJsonArtifact(paths.configFile, DEFAULT_CONFIG, mergeWithDefault);
    return applyProfileToConfig(merged, loadTriadProfile(paths));
}
function registerMatureStableArchitectureAnchor(paths, anchor) {
    ensureTriadConfig(paths);
    const current = loadMergedJsonArtifact(paths.configFile, DEFAULT_CONFIG, mergeWithDefault);
    const nodeId = String(anchor.nodeId ?? '').trim();
    const sourcePath = normalizeStableSourcePath(anchor.sourcePath);
    const next = {
        ...current,
        topologyRisk: {
            ...current.topologyRisk,
            matureStableNodeIds: mergeExactStableNodeIds(current.topologyRisk.matureStableNodeIds, nodeId),
            matureStableNodePatterns: [...current.topologyRisk.matureStableNodePatterns],
            matureStableSourcePaths: mergeExactStableSourcePaths(current.topologyRisk.matureStableSourcePaths, sourcePath),
            matureStableSourcePathPatterns: [...current.topologyRisk.matureStableSourcePathPatterns]
        }
    };
    fs.writeFileSync(paths.configFile, JSON.stringify(next, null, 2), 'utf-8');
    return next.topologyRisk;
}
function ensureTriadProfile(paths, force = false) {
    fs.mkdirSync(paths.triadDir, { recursive: true });
    if (force || !fs.existsSync(paths.profileFile)) {
        fs.writeFileSync(paths.profileFile, JSON.stringify(buildDefaultProfile(), null, 2), 'utf-8');
    }
}
function loadTriadProfile(paths) {
    ensureTriadProfile(paths);
    return loadMergedJsonArtifact(paths.profileFile, buildDefaultProfile(), mergeProfileWithDefault);
}
function resolveCategoryFromConfig(sourcePath, config) {
    const resolved = resolveCategoryBySourcePath(sourcePath, config.categories);
    if (resolved !== 'unknown') {
        return resolved;
    }
    const scopedCategory = normalizeCategoryFromScope(resolveSourceScanScope(sourcePath, config));
    return scopedCategory || 'core';
}
function resolveCategoryBySourcePath(sourcePath, categories) {
    const normalizedPath = (0, workspace_1.normalizePath)(String(sourcePath ?? '')).toLowerCase().replace(/^\/+/, '');
    if (!normalizedPath) {
        return 'unknown';
    }
    const categoryOrder = Object.keys(categories).filter(Boolean);
    let bestMatch;
    for (const category of categoryOrder) {
        const patterns = Array.isArray(categories[category]) ? categories[category] : [];
        for (const rawPattern of patterns) {
            const pattern = (0, workspace_1.normalizePath)(String(rawPattern ?? '')).toLowerCase().replace(/^\/+|\/+$/g, '');
            if (!pattern) {
                continue;
            }
            const isExactPrefix = normalizedPath === pattern || normalizedPath.startsWith(`${pattern}/`);
            if (!isExactPrefix) {
                continue;
            }
            const score = pattern.length;
            if (!bestMatch || score > bestMatch.score) {
                bestMatch = {
                    category,
                    score
                };
            }
        }
    }
    return bestMatch?.category ?? 'unknown';
}
function resolveSourceScanScope(sourcePath, config) {
    const normalizedPath = normalizeScopePath(String(sourcePath ?? ''));
    if (!normalizedPath) {
        return undefined;
    }
    const segments = normalizedPath.split('/').filter(Boolean);
    const scopes = config.profile?.scanScopes ?? [];
    let bestMatch;
    for (const scope of scopes) {
        const score = scoreScanScopeMatch(normalizedPath, segments, scope);
        if (score <= 0) {
            continue;
        }
        if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
                scope,
                score
            };
        }
    }
    return bestMatch?.scope;
}
function shouldExcludeSourcePath(sourcePath, config) {
    const normalizedPath = (0, workspace_1.normalizePath)(sourcePath).toLowerCase();
    if (isHardExcludedSourcePath(normalizedPath)) {
        return true;
    }
    if (config.parser.excludeTestFiles && isHardExcludedSourceFile(normalizedPath)) {
        return true;
    }
    const configuredPatterns = [...(config.parser.excludePatterns ?? []), ...(config.parser.excludePathPatterns ?? [])];
    return configuredPatterns.some((pattern) => matchesSourcePathPattern(normalizedPath, pattern));
}
function createSourcePathFilter(projectRoot, config) {
    const activePatterns = resolveActiveScanPatterns(projectRoot, config);
    const selectedScopes = resolveSelectedScanScopes(config);
    const hasScopedRules = activePatterns.length > 0 || selectedScopes.length > 0;
    return (sourcePath) => {
        if (shouldExcludeSourcePath(sourcePath, config)) {
            return false;
        }
        if (!hasScopedRules) {
            return true;
        }
        const normalizedPath = normalizeScopePath(sourcePath);
        if (activePatterns.some((pattern) => normalizedPath === pattern || normalizedPath.startsWith(`${pattern}/`))) {
            return true;
        }
        if (matchesAnyScanScope(normalizedPath, selectedScopes)) {
            return true;
        }
        return (0, supportAbstraction_1.isRootLevelSupportAbstractionSourcePath)(normalizedPath);
    };
}
function shouldIncludeRuntimePath(sourcePath, config) {
    const normalizedPath = (0, workspace_1.normalizePath)(sourcePath).toLowerCase();
    if (isHardExcludedSourcePath(normalizedPath) || isHardExcludedSourceFile(normalizedPath)) {
        return false;
    }
    const configuredPatterns = [
        ...(config.parser.excludePatterns ?? []),
        ...(config.parser.excludePathPatterns ?? []),
        ...(config.runtime.excludePathPatterns ?? [])
    ];
    return !configuredPatterns.some((pattern) => matchesSourcePathPattern(normalizedPath, pattern));
}
function describeSourceScanScope(projectRoot, config) {
    const activePatterns = resolveActiveScanPatterns(projectRoot, config);
    const selectedScopes = resolveSelectedScanScopes(config).map((scope) => `scope:${scope.name}`);
    const patterns = Array.from(new Set([...activePatterns, ...selectedScopes]));
    return {
        mode: patterns.length > 0 ? 'scoped' : 'fallback_all',
        patterns
    };
}
function loadMergedJsonArtifact(filePath, fallback, merge) {
    const result = (0, artifactReaders_1.readJsonObjectArtifactResult)(filePath);
    if (result.status !== 'ok' || !result.value) {
        return fallback;
    }
    const parsed = result.value;
    const merged = merge(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(merged)) {
        fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf-8');
    }
    return merged;
}
function mergeWithDefault(value) {
    const language = normalizeLanguage(value.architecture?.language, value.architecture?.adapter, DEFAULT_CONFIG.architecture.language);
    const mergedCategories = mergeCategoryRecord(value.categories, DEFAULT_CONFIG.categories);
    return {
        schemaVersion: DEFAULT_CONFIG.schemaVersion,
        architecture: {
            language,
            parserEngine: normalizeParserEngine(value.architecture?.parserEngine, language),
            adapter: value.architecture?.adapter ?? LANGUAGE_ADAPTER_PACKAGE[language]
        },
        categories: mergedCategories,
        parser: {
            excludePatterns: value.parser?.excludePatterns ?? DEFAULT_CONFIG.parser.excludePatterns,
            excludePathPatterns: mergeStringList(value.parser?.excludePathPatterns, DEFAULT_CONFIG.parser.excludePathPatterns),
            scanCategories: normalizeScanCategories(value.parser?.scanCategories, mergedCategories),
            scanMode: normalizeScanMode(value.parser?.scanMode),
            leafOutputFile: normalizeRelativeOutputFile(value.parser?.leafOutputFile, DEFAULT_CONFIG.parser.leafOutputFile),
            capabilityOutputFile: normalizeRelativeOutputFile(value.parser?.capabilityOutputFile, DEFAULT_CONFIG.parser.capabilityOutputFile),
            capabilityThreshold: normalizePositiveInteger(value.parser?.capabilityThreshold, DEFAULT_CONFIG.parser.capabilityThreshold),
            excludeTestFiles: value.parser?.excludeTestFiles ?? DEFAULT_CONFIG.parser.excludeTestFiles,
            excludeMagicMethods: value.parser?.excludeMagicMethods ?? DEFAULT_CONFIG.parser.excludeMagicMethods,
            excludePrivateMethods: value.parser?.excludePrivateMethods ?? DEFAULT_CONFIG.parser.excludePrivateMethods,
            helperVerbPolicy: normalizeHelperVerbPolicy(value.parser?.helperVerbPolicy),
            foldHelpersIntoOwner: value.parser?.foldHelpersIntoOwner ?? DEFAULT_CONFIG.parser.foldHelpersIntoOwner,
            entryMethodNames: mergeStringList(value.parser?.entryMethodNames, DEFAULT_CONFIG.parser.entryMethodNames),
            excludeNodeNamePatterns: mergeStringList(value.parser?.excludeNodeNamePatterns, DEFAULT_CONFIG.parser.excludeNodeNamePatterns),
            ignoreGenericContracts: value.parser?.ignoreGenericContracts ?? DEFAULT_CONFIG.parser.ignoreGenericContracts,
            genericContractIgnoreList: mergeGenericContractIgnoreList(value.parser?.genericContractIgnoreList),
            includeUntaggedExports: value.parser?.includeUntaggedExports ?? DEFAULT_CONFIG.parser.includeUntaggedExports,
            ghostPolicyByLanguage: normalizeGhostPolicyByLanguage(value.parser?.ghostPolicyByLanguage),
            jsDocTags: {
                triadNode: value.parser?.jsDocTags?.triadNode ?? DEFAULT_CONFIG.parser.jsDocTags.triadNode,
                leftBranch: value.parser?.jsDocTags?.leftBranch ?? DEFAULT_CONFIG.parser.jsDocTags.leftBranch,
                rightBranch: value.parser?.jsDocTags?.rightBranch ?? DEFAULT_CONFIG.parser.jsDocTags.rightBranch
            }
        },
        visualizer: {
            defaultView: value.visualizer?.defaultView === 'leaf' || value.visualizer?.defaultView === 'architecture'
                ? value.visualizer.defaultView
                : DEFAULT_CONFIG.visualizer.defaultView,
            showIsolatedCapabilities: value.visualizer?.showIsolatedCapabilities ?? DEFAULT_CONFIG.visualizer.showIsolatedCapabilities,
            maxContractEdges: normalizePositiveInteger(value.visualizer?.maxContractEdges ?? value.visualizer?.maxPrimaryEdges, DEFAULT_CONFIG.visualizer.maxContractEdges),
            maxPrimaryEdges: normalizePositiveInteger(value.visualizer?.maxPrimaryEdges ?? value.visualizer?.maxContractEdges, DEFAULT_CONFIG.visualizer.maxPrimaryEdges),
            fastMode: value.visualizer?.fastMode ?? DEFAULT_CONFIG.visualizer.fastMode,
            strictFingerprint: value.visualizer?.strictFingerprint ?? DEFAULT_CONFIG.visualizer.strictFingerprint,
            fastMayaThreshold: normalizeNonNegativeInteger(value.visualizer?.fastMayaThreshold ?? value.visualizer?.fastFingerprintThreshold, DEFAULT_CONFIG.visualizer.fastMayaThreshold),
            fastFingerprintThreshold: normalizeNonNegativeInteger(value.visualizer?.fastFingerprintThreshold ?? value.visualizer?.fastMayaThreshold, DEFAULT_CONFIG.visualizer.fastFingerprintThreshold),
            maxFingerprintNodes: normalizePositiveInteger(value.visualizer?.maxFingerprintNodes, DEFAULT_CONFIG.visualizer.maxFingerprintNodes),
            maxFingerprintOwners: normalizePositiveInteger(value.visualizer?.maxFingerprintOwners, DEFAULT_CONFIG.visualizer.maxFingerprintOwners),
            fingerprintTimeoutMs: normalizePositiveInteger(value.visualizer?.fingerprintTimeoutMs, DEFAULT_CONFIG.visualizer.fingerprintTimeoutMs),
            maxRenderNodes: normalizePositiveInteger(value.visualizer?.maxRenderNodes, DEFAULT_CONFIG.visualizer.maxRenderNodes),
            showFoldedLeaves: value.visualizer?.showFoldedLeaves ?? DEFAULT_CONFIG.visualizer.showFoldedLeaves
        },
        protocol: {
            minConfidence: value.protocol?.minConfidence ?? DEFAULT_CONFIG.protocol.minConfidence,
            requireConfidence: value.protocol?.requireConfidence ?? DEFAULT_CONFIG.protocol.requireConfidence
        },
        navigator: {
            autoGenerateProtocol: value.navigator?.autoGenerateProtocol ?? DEFAULT_CONFIG.navigator.autoGenerateProtocol,
            provider: normalizeNavigatorLlmProvider(value.navigator?.provider),
            model: normalizeNonEmptyText(value.navigator?.model, DEFAULT_CONFIG.navigator.model),
            apiKeyEnv: normalizeNonEmptyText(value.navigator?.apiKeyEnv, DEFAULT_CONFIG.navigator.apiKeyEnv),
            baseUrl: normalizeNonEmptyText(value.navigator?.baseUrl, DEFAULT_CONFIG.navigator.baseUrl),
            timeoutMs: normalizePositiveInteger(value.navigator?.timeoutMs, DEFAULT_CONFIG.navigator.timeoutMs),
            maxOutputTokens: normalizePositiveInteger(value.navigator?.maxOutputTokens, DEFAULT_CONFIG.navigator.maxOutputTokens),
            temperature: normalizeTemperature(value.navigator?.temperature, DEFAULT_CONFIG.navigator.temperature),
            maxRepairRounds: normalizeNonNegativeInteger(value.navigator?.maxRepairRounds, DEFAULT_CONFIG.navigator.maxRepairRounds),
            failOnLlmError: value.navigator?.failOnLlmError ?? DEFAULT_CONFIG.navigator.failOnLlmError
        },
        runtime: {
            enabled: value.runtime?.enabled ?? DEFAULT_CONFIG.runtime.enabled,
            defaultView: normalizeRuntimeView(value.runtime?.defaultView),
            includeFrontend: value.runtime?.includeFrontend ?? DEFAULT_CONFIG.runtime.includeFrontend,
            includeInfra: value.runtime?.includeInfra ?? DEFAULT_CONFIG.runtime.includeInfra,
            frameworkHints: mergeStringList(value.runtime?.frameworkHints, DEFAULT_CONFIG.runtime.frameworkHints),
            excludePathPatterns: mergeStringList(value.runtime?.excludePathPatterns, DEFAULT_CONFIG.runtime.excludePathPatterns),
            maxSourceFileBytes: normalizePositiveInteger(value.runtime?.maxSourceFileBytes, DEFAULT_CONFIG.runtime.maxSourceFileBytes),
            maxScannedFiles: normalizePositiveInteger(value.runtime?.maxScannedFiles, DEFAULT_CONFIG.runtime.maxScannedFiles),
            failOnExtractorError: value.runtime?.failOnExtractorError ?? DEFAULT_CONFIG.runtime.failOnExtractorError,
            minConfidence: normalizeConfidence(value.runtime?.minConfidence, DEFAULT_CONFIG.runtime.minConfidence)
        },
        dream: {
            enabled: value.dream?.enabled ?? DEFAULT_CONFIG.dream.enabled,
            idleOnly: value.dream?.idleOnly ?? DEFAULT_CONFIG.dream.idleOnly,
            minHoursBetweenRuns: normalizePositiveInteger(value.dream?.minHoursBetweenRuns, DEFAULT_CONFIG.dream.minHoursBetweenRuns),
            minConfidence: normalizeConfidence(value.dream?.minConfidence, DEFAULT_CONFIG.dream.minConfidence),
            maxProposals: normalizePositiveInteger(value.dream?.maxProposals, DEFAULT_CONFIG.dream.maxProposals),
            autoTriggerEnabled: value.dream?.autoTriggerEnabled ?? DEFAULT_CONFIG.dream.autoTriggerEnabled,
            autoTriggerCommands: mergeStringList(value.dream?.autoTriggerCommands, DEFAULT_CONFIG.dream.autoTriggerCommands),
            minEventsBetweenRuns: normalizePositiveInteger(value.dream?.minEventsBetweenRuns, DEFAULT_CONFIG.dream.minEventsBetweenRuns),
            scanThrottleMinutes: normalizePositiveInteger(value.dream?.scanThrottleMinutes, DEFAULT_CONFIG.dream.scanThrottleMinutes),
            lockTimeoutMinutes: normalizePositiveInteger(value.dream?.lockTimeoutMinutes, DEFAULT_CONFIG.dream.lockTimeoutMinutes),
            daemonEnabled: value.dream?.daemonEnabled ?? DEFAULT_CONFIG.dream.daemonEnabled,
            daemonIntervalSeconds: normalizePositiveInteger(value.dream?.daemonIntervalSeconds, DEFAULT_CONFIG.dream.daemonIntervalSeconds),
            daemonMaxTicksPerRun: normalizeNonNegativeInteger(value.dream?.daemonMaxTicksPerRun, DEFAULT_CONFIG.dream.daemonMaxTicksPerRun),
            failOnDreamError: value.dream?.failOnDreamError ?? DEFAULT_CONFIG.dream.failOnDreamError
        },
        runtimeHealing: {
            enabled: value.runtimeHealing?.enabled ?? DEFAULT_CONFIG.runtimeHealing.enabled,
            maxAutoRetries: value.runtimeHealing?.maxAutoRetries ?? DEFAULT_CONFIG.runtimeHealing.maxAutoRetries,
            requireHumanApprovalForContractChanges: value.runtimeHealing?.requireHumanApprovalForContractChanges ??
                DEFAULT_CONFIG.runtimeHealing.requireHumanApprovalForContractChanges,
            snapshotStrategy: value.runtimeHealing?.snapshotStrategy ?? DEFAULT_CONFIG.runtimeHealing.snapshotStrategy
        },
        abstractionMemory: {
            enabled: value.abstractionMemory?.enabled ?? DEFAULT_CONFIG.abstractionMemory.enabled,
            autoSyncOnPrompt: value.abstractionMemory?.autoSyncOnPrompt ?? DEFAULT_CONFIG.abstractionMemory.autoSyncOnPrompt,
            excludeMatureStableSources: value.abstractionMemory?.excludeMatureStableSources ??
                DEFAULT_CONFIG.abstractionMemory.excludeMatureStableSources,
            excludeSourcePaths: normalizeStringArray(value.abstractionMemory?.excludeSourcePaths).map((entry) => normalizeStableSourcePath(entry)),
            excludeSourcePathPatterns: normalizeStringArray(value.abstractionMemory?.excludeSourcePathPatterns),
            minAbstractionRatio: normalizeConfidence(value.abstractionMemory?.minAbstractionRatio, DEFAULT_CONFIG.abstractionMemory.minAbstractionRatio),
            maxPromptEntries: normalizePositiveInteger(value.abstractionMemory?.maxPromptEntries, DEFAULT_CONFIG.abstractionMemory.maxPromptEntries),
            maxSearchResults: normalizePositiveInteger(value.abstractionMemory?.maxSearchResults, DEFAULT_CONFIG.abstractionMemory.maxSearchResults)
        },
        topologyRisk: {
            matureStableNodeIds: normalizeStringArray(value.topologyRisk?.matureStableNodeIds),
            matureStableNodePatterns: normalizeStringArray(value.topologyRisk?.matureStableNodePatterns),
            matureStableSourcePaths: normalizeStringArray(value.topologyRisk?.matureStableSourcePaths).map((entry) => normalizeStableSourcePath(entry)),
            matureStableSourcePathPatterns: normalizeStringArray(value.topologyRisk?.matureStableSourcePathPatterns)
        },
        interrogation: normalizeInterrogationConfig(value.interrogation),
        impactTiers: normalizeImpactTiers(value.impactTiers),
        governance: {
            scope: value.governance?.scope === 'impact' ? 'impact' : DEFAULT_CONFIG.governance.scope
        },
        profile: undefined
    };
}
function buildDefaultConfig(language) {
    return {
        ...DEFAULT_CONFIG,
        architecture: {
            language,
            parserEngine: LANGUAGE_PARSER_ENGINE[language],
            adapter: LANGUAGE_ADAPTER_PACKAGE[language]
        }
    };
}
function normalizeScanCategories(value, categories = DEFAULT_CONFIG.categories) {
    if (!Array.isArray(value) || value.length === 0) {
        return defaultScanCategories(categories);
    }
    const allowed = new Set(Object.keys(categories).filter(Boolean));
    const normalized = value
        .map((entry) => String(entry ?? '').trim())
        .filter((entry) => allowed.has(entry));
    return normalized.length > 0 ? Array.from(new Set(normalized)) : defaultScanCategories(categories);
}
function normalizeScanMode(value) {
    if (value === 'capability' || value === 'module' || value === 'domain' || value === 'leaf') {
        return value;
    }
    return DEFAULT_CONFIG.parser.scanMode;
}
function normalizeRuntimeView(value) {
    if (value === 'workflow' ||
        value === 'request-flow' ||
        value === 'resources' ||
        value === 'events' ||
        value === 'infra' ||
        value === 'full') {
        return value;
    }
    return DEFAULT_CONFIG.runtime.defaultView;
}
function normalizeHelperVerbPolicy(value) {
    return value === 'allow' || value === 'suppress' ? value : DEFAULT_CONFIG.parser.helperVerbPolicy;
}
function normalizeNavigatorLlmProvider(value) {
    return value === 'anthropic' || value === 'openai' ? value : DEFAULT_CONFIG.navigator.provider;
}
function normalizeRelativeOutputFile(value, fallback) {
    const normalized = (0, workspace_1.normalizePath)(String(value ?? '').trim());
    if (!normalized || path.isAbsolute(normalized) || normalized.includes('..')) {
        return fallback;
    }
    return normalized;
}
function mergeGenericContractIgnoreList(value) {
    return mergeStringList(value, DEFAULT_CONFIG.parser.genericContractIgnoreList);
}
function normalizeGhostPolicyByLanguage(value) {
    const merged = {
        ...DEFAULT_CONFIG.parser.ghostPolicyByLanguage,
        ...(value ?? {})
    };
    const normalized = {};
    const keys = ['default', 'typescript', 'javascript', 'python', 'go', 'rust', 'cpp', 'java'];
    for (const key of keys) {
        const policy = merged[key];
        const fallback = DEFAULT_CONFIG.parser.ghostPolicyByLanguage[key] ?? DEFAULT_CONFIG.parser.ghostPolicyByLanguage.default;
        normalized[key] = {
            includeInDemand: policy?.includeInDemand ?? fallback.includeInDemand,
            topK: normalizeNonNegativeInteger(policy?.topK, fallback.topK),
            minConfidence: normalizeNonNegativeInteger(policy?.minConfidence, fallback.minConfidence)
        };
    }
    return normalized;
}
function matchesSourcePathPattern(normalizedPath, pattern) {
    const normalizedPattern = (0, workspace_1.normalizePath)(String(pattern ?? '').trim()).toLowerCase();
    if (!normalizedPattern) {
        return false;
    }
    if (isRegexLikePattern(normalizedPattern)) {
        try {
            return new RegExp(normalizedPattern, 'i').test(normalizedPath);
        }
        catch {
            return false;
        }
    }
    if (normalizedPath === normalizedPattern) {
        return true;
    }
    return (normalizedPath.startsWith(`${normalizedPattern}/`) ||
        normalizedPath.endsWith(`/${normalizedPattern}`) ||
        normalizedPath.includes(`/${normalizedPattern}/`));
}
function isRegexLikePattern(value) {
    return /[\\^$|()[\]{}+?]/.test(value);
}
function isHardExcludedSourceFile(sourcePath) {
    const normalizedPath = normalizeScopePath(sourcePath);
    const basename = normalizedPath.split('/').filter(Boolean).pop() ?? normalizedPath;
    return HARD_EXCLUDE_SOURCE_FILE_PATTERNS.some((pattern) => pattern.test(basename));
}
function mergeStringList(value, fallback) {
    const items = Array.isArray(value) ? value : [];
    return Array.from(new Set([...items, ...fallback].filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())));
}
function normalizePositiveInteger(value, fallback) {
    if (Number.isFinite(value) && value > 0) {
        return Math.floor(value);
    }
    return fallback;
}
function normalizeNonNegativeInteger(value, fallback) {
    if (Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    return fallback;
}
function normalizeImpactTiers(value) {
    const shortChainMax = normalizeNonNegativeInteger(value?.shortChainMax, DEFAULT_CONFIG.impactTiers.shortChainMax);
    const rawMediumChainMax = normalizeNonNegativeInteger(value?.mediumChainMax, DEFAULT_CONFIG.impactTiers.mediumChainMax);
    const mediumChainMax = Math.max(shortChainMax, rawMediumChainMax);
    return {
        shortChainMax,
        mediumChainMax,
        forceTier: normalizeForceTier(value?.forceTier)
    };
}
function normalizeInterrogationConfig(value) {
    return {
        autoApproveMaxImpactEdgeCount: normalizeNonNegativeInteger(value?.autoApproveMaxImpactEdgeCount, DEFAULT_CONFIG.interrogation.autoApproveMaxImpactEdgeCount)
    };
}
function normalizeForceTier(value) {
    if (!value || typeof value !== 'object') {
        return {};
    }
    const result = {};
    for (const [rawKey, rawTier] of Object.entries(value)) {
        const key = String(rawKey ?? '').trim();
        const tier = String(rawTier ?? '').trim();
        if (!key || (tier !== 'exempt' && tier !== 'advisory' && tier !== 'strict')) {
            continue;
        }
        result[key] = tier;
    }
    return result;
}
function normalizeConfidence(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1) {
        return value;
    }
    return fallback;
}
function normalizeTemperature(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 2) {
        return value;
    }
    return fallback;
}
function mergeCategoryPatterns(value, fallback) {
    const items = Array.isArray(value) ? value : [];
    return Array.from(new Set([...items, ...fallback].filter((item) => typeof item === 'string' && item.trim())));
}
function mergeCategoryRecord(value, fallback) {
    const keys = new Set([
        ...Object.keys(fallback ?? {}).filter(Boolean),
        ...Object.keys(value ?? {}).filter(Boolean)
    ]);
    const merged = {};
    for (const key of keys) {
        merged[key] = mergeCategoryPatterns(value?.[key], fallback?.[key] ?? []);
    }
    if (!merged.core) {
        merged.core = [];
    }
    return merged;
}
function buildDefaultProfile() {
    return {
        schemaVersion: DEFAULT_PROFILE.schemaVersion,
        categories: { ...(DEFAULT_PROFILE.categories ?? {}) },
        scanScopes: (DEFAULT_PROFILE.scanScopes ?? []).map((scope) => ({
            ...scope,
            match: {
                ...(scope.match ?? {})
            }
        })),
        languageAdapters: {
            ...(DEFAULT_PROFILE.languageAdapters ?? {})
        },
        extractors: {
            parser: [...(DEFAULT_PROFILE.extractors?.parser ?? [])],
            runtime: [...(DEFAULT_PROFILE.extractors?.runtime ?? [])]
        },
        governance: {
            coverageGates: [...(DEFAULT_PROFILE.governance?.coverageGates ?? [])]
        }
    };
}
function mergeProfileWithDefault(value) {
    const defaults = buildDefaultProfile();
    return {
        schemaVersion: defaults.schemaVersion,
        categories: mergeCategoryRecord(value?.categories, defaults.categories ?? {}),
        scanScopes: normalizeScanScopes(value?.scanScopes, defaults.scanScopes ?? []),
        languageAdapters: {
            ...(defaults.languageAdapters ?? {}),
            ...(value?.languageAdapters ?? {})
        },
        extractors: {
            parser: mergeStringList(value?.extractors?.parser, defaults.extractors?.parser ?? []),
            runtime: mergeStringList(value?.extractors?.runtime, defaults.extractors?.runtime ?? [])
        },
        governance: {
            coverageGates: normalizeCoverageGates(value?.governance?.coverageGates, defaults.governance?.coverageGates ?? [])
        }
    };
}
function applyProfileToConfig(config, profile) {
    const mergedCategories = mergeCategoryRecord(profile.categories, config.categories);
    return {
        ...config,
        categories: mergedCategories,
        parser: {
            ...config.parser,
            scanCategories: normalizeScanCategories(config.parser.scanCategories, mergedCategories)
        },
        architecture: {
            ...config.architecture,
            adapter: profile.languageAdapters?.[config.architecture.language] ?? config.architecture.adapter
        },
        profile
    };
}
function normalizeScanScopes(value, fallback) {
    const scopes = Array.isArray(value) && value.length > 0 ? value : fallback;
    return scopes
        .map((scope) => ({
        name: String(scope?.name ?? '').trim(),
        kind: normalizeSourcePolicy(scope?.kind),
        priority: Number.isFinite(scope?.priority) ? Number(scope?.priority) : 0,
        category: String(scope?.category ?? '').trim() || undefined,
        match: {
            pathPrefixes: normalizeStringArray(scope?.match?.pathPrefixes),
            pathSegments: normalizeStringArray(scope?.match?.pathSegments).map((entry) => normalizeScopePath(entry)),
            filePatterns: normalizeStringArray(scope?.match?.filePatterns),
            includePatterns: normalizeStringArray(scope?.match?.includePatterns),
            excludePatterns: normalizeStringArray(scope?.match?.excludePatterns)
        }
    }))
        .filter((scope) => scope.name && scope.kind);
}
function normalizeCoverageGates(value, fallback) {
    const gates = Array.isArray(value) ? value : fallback;
    const normalized = [];
    for (const gate of gates) {
        const target = String(gate?.target ?? '').trim();
        const scope = gate?.scope === 'root' ? 'root' : 'category';
        const metric = gate?.metric === 'triad' || gate?.metric === 'runtime' || gate?.metric === 'combined'
            ? gate.metric
            : 'combined';
        const op = gate?.op === 'gt' || gate?.op === 'gte' ? gate.op : 'gte';
        const valueNumber = Number(gate?.value);
        const mustPass = gate?.mustPass === true;
        const phase = String(gate?.phase ?? '').trim() || undefined;
        if (!target || !Number.isFinite(valueNumber) || valueNumber < 0 || valueNumber > 1) {
            continue;
        }
        normalized.push({
            target,
            scope,
            metric,
            op,
            value: valueNumber,
            mustPass,
            phase
        });
    }
    return normalized;
}
function normalizeSourcePolicy(value) {
    switch (value) {
        case 'api':
        case 'ui':
        case 'cli':
        case 'agent':
        case 'types':
        case 'tests':
        case 'migrations':
        case 'nodes':
        case 'tasks':
        case 'services':
        case 'utils':
        case 'other':
            return value;
        default:
            return 'other';
    }
}
function normalizeStringArray(value) {
    return Array.isArray(value)
        ? Array.from(new Set(value
            .map((entry) => String(entry ?? '').trim())
            .filter(Boolean)))
        : [];
}
function normalizeNonEmptyText(value, fallback) {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}
function normalizeStableSourcePath(value) {
    return (0, workspace_1.normalizePath)(String(value ?? ''))
        .replace(/^\.?\//, '')
        .replace(/\/{2,}/g, '/')
        .trim();
}
function mergeExactStableNodeIds(existing, candidate) {
    return candidate ? Array.from(new Set([...existing, candidate])) : [...existing];
}
function mergeExactStableSourcePaths(existing, candidate) {
    return candidate ? Array.from(new Set([...existing, candidate])) : [...existing];
}
function resolveActiveScanPatterns(projectRoot, config) {
    const scanCategories = normalizeScanCategories(config.parser.scanCategories, config.categories);
    const patterns = scanCategories.flatMap((category) => config.categories[category] ?? []);
    return Array.from(new Set(patterns
        .map((pattern) => normalizeScopePath(pattern))
        .filter(Boolean)
        .filter((pattern) => fs.existsSync(path.join(projectRoot, pattern)))));
}
function scoreScanScopeMatch(normalizedPath, segments, scope) {
    const match = scope.match ?? {};
    const normalizedSegments = new Set(segments.map((entry) => normalizeScopePath(entry)));
    let score = 0;
    for (const prefix of match.pathPrefixes ?? []) {
        const normalizedPrefix = normalizeScopePath(prefix);
        if (!normalizedPrefix) {
            continue;
        }
        if (normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`)) {
            score = Math.max(score, 1000 + normalizedPrefix.length);
        }
    }
    const segmentHits = (match.pathSegments ?? []).filter((segment) => normalizedSegments.has(segment)).length;
    if (segmentHits > 0) {
        score = Math.max(score, 500 + segmentHits * 10);
    }
    const filePatternHits = (match.filePatterns ?? []).filter((pattern) => matchesFileGlob(normalizedPath, pattern)).length;
    if (filePatternHits > 0) {
        score = Math.max(score, 300 + filePatternHits * 10);
    }
    const includeHits = (match.includePatterns ?? []).filter((pattern) => matchesSourcePathPattern(normalizedPath, pattern)).length;
    if (includeHits > 0) {
        score = Math.max(score, 200 + includeHits * 10);
    }
    if ((match.excludePatterns ?? []).some((pattern) => matchesSourcePathPattern(normalizedPath, pattern))) {
        return 0;
    }
    return score > 0 ? score + (scope.priority ?? 0) : 0;
}
function matchesFileGlob(normalizedPath, pattern) {
    const normalizedPattern = String(pattern ?? '').trim();
    if (!normalizedPattern) {
        return false;
    }
    const escaped = normalizedPattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
    try {
        return new RegExp(`^${escaped}$`, 'i').test(normalizedPath.split('/').pop() ?? normalizedPath);
    }
    catch {
        return false;
    }
}
function normalizeScopePath(value) {
    return (0, workspace_1.normalizePath)(value)
        .replace(/^\.?\//, '')
        .replace(/\/+$/, '')
        .toLowerCase();
}
function isHardExcludedSourcePath(sourcePath) {
    const normalizedPath = normalizeScopePath(sourcePath);
    const segments = normalizedPath.split('/').filter(Boolean);
    if (segments.some((segment) => HARD_EXCLUDE_SEGMENTS.has(segment))) {
        return true;
    }
    const basename = segments[segments.length - 1] ?? '';
    return HARD_EXCLUDE_BASENAME_PATTERNS.some((pattern) => pattern.test(basename));
}
function defaultScanCategories(categories) {
    const categoryKeys = Object.keys(categories ?? {}).filter(Boolean);
    if (categoryKeys.length === 0) {
        return [...DEFAULT_CONFIG.parser.scanCategories];
    }
    return categoryKeys.includes('core') ? ['core', ...categoryKeys.filter((key) => key !== 'core')] : categoryKeys;
}
function normalizeCategoryFromScope(scope) {
    const category = String(scope?.category ?? '').trim();
    return category || undefined;
}
function resolveSelectedScanScopes(config) {
    const allowedCategories = new Set(normalizeScanCategories(config.parser.scanCategories, config.categories));
    return (config.profile?.scanScopes ?? []).filter((scope) => {
        const category = normalizeCategoryFromScope(scope);
        return Boolean(category && allowedCategories.has(category));
    });
}
function matchesAnyScanScope(normalizedPath, scopes) {
    if (scopes.length === 0) {
        return false;
    }
    const segments = normalizedPath.split('/').filter(Boolean);
    return scopes.some((scope) => scoreScanScopeMatch(normalizedPath, segments, scope) > 0);
}
function normalizeLanguage(value, adapterValue, fallback = 'typescript') {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'typescript' || normalized === 'ts') {
        return 'typescript';
    }
    if (normalized === 'javascript' || normalized === 'js' || normalized === 'node' || normalized === 'nodejs') {
        return 'javascript';
    }
    if (normalized === 'python' || normalized === 'py') {
        return 'python';
    }
    if (normalized === 'go' || normalized === 'golang') {
        return 'go';
    }
    if (normalized === 'rust' || normalized === 'rs') {
        return 'rust';
    }
    if (normalized === 'cpp' || normalized === 'c++' || normalized === 'cxx' || normalized === 'cc') {
        return 'cpp';
    }
    if (normalized === 'java' || normalized === 'jdk') {
        return 'java';
    }
    const adapter = (adapterValue ?? '').trim().toLowerCase();
    if (adapter.includes('javascript') || adapter.includes('plugin-js')) {
        return 'javascript';
    }
    if (adapter.includes('python')) {
        return 'python';
    }
    if (adapter.includes('go')) {
        return 'go';
    }
    if (adapter.includes('rust')) {
        return 'rust';
    }
    if (adapter.includes('cpp') || adapter.includes('cxx') || adapter.includes('c++')) {
        return 'cpp';
    }
    if (adapter.includes('java')) {
        return 'java';
    }
    return fallback;
}
function normalizeParserEngine(value, language) {
    if (value === 'tree-sitter') {
        return 'tree-sitter';
    }
    if (value === 'native') {
        return 'native';
    }
    return LANGUAGE_PARSER_ENGINE[language];
}
function detectProjectLanguage(projectRoot) {
    if (fs.existsSync(path.join(projectRoot, 'tsconfig.json'))) {
        return 'typescript';
    }
    const extensionScore = new Map([
        ['javascript', 0],
        ['python', 0],
        ['go', 0],
        ['rust', 0],
        ['cpp', 0],
        ['java', 0],
        ['typescript', 0]
    ]);
    walkProject(projectRoot, (filePath) => {
        const normalized = (0, workspace_1.normalizePath)(path.relative(projectRoot, filePath)).toLowerCase();
        if (shouldSkipWalkPath(normalized) || isHardExcludedSourceFile(normalized)) {
            return;
        }
        if (/\.(ts|tsx|mts|cts)$/.test(filePath)) {
            extensionScore.set('typescript', (extensionScore.get('typescript') ?? 0) + 1);
        }
        else if (/\.(js|jsx|mjs|cjs)$/.test(filePath)) {
            extensionScore.set('javascript', (extensionScore.get('javascript') ?? 0) + 1);
        }
        else if (/\.py$/.test(filePath)) {
            extensionScore.set('python', (extensionScore.get('python') ?? 0) + 1);
        }
        else if (/\.go$/.test(filePath)) {
            extensionScore.set('go', (extensionScore.get('go') ?? 0) + 1);
        }
        else if (/\.rs$/.test(filePath)) {
            extensionScore.set('rust', (extensionScore.get('rust') ?? 0) + 1);
        }
        else if (/\.(cpp|cc|cxx|hpp|hh|h)$/.test(filePath)) {
            extensionScore.set('cpp', (extensionScore.get('cpp') ?? 0) + 1);
        }
        else if (/\.java$/.test(filePath)) {
            extensionScore.set('java', (extensionScore.get('java') ?? 0) + 1);
        }
    });
    let detected = 'typescript';
    let bestScore = 0;
    for (const [language, score] of extensionScore.entries()) {
        if (score > bestScore) {
            detected = language;
            bestScore = score;
        }
    }
    return detected;
}
function walkProject(currentPath, visit) {
    if (!fs.existsSync(currentPath)) {
        return;
    }
    let stat;
    try {
        stat = fs.statSync(currentPath);
    }
    catch (error) {
        if (isIgnorableFsError(error)) {
            return;
        }
        throw error;
    }
    if (stat.isFile()) {
        try {
            visit(currentPath);
        }
        catch (error) {
            if (isIgnorableFsError(error)) {
                return;
            }
            throw error;
        }
        return;
    }
    if (shouldSkipWalkPath(path.basename(currentPath))) {
        return;
    }
    let entries;
    try {
        entries = fs.readdirSync(currentPath);
    }
    catch (error) {
        if (isIgnorableFsError(error)) {
            return;
        }
        throw error;
    }
    for (const entry of entries) {
        walkProject(path.join(currentPath, entry), visit);
    }
}
function shouldSkipWalkPath(value) {
    const normalized = normalizeScopePath(value);
    const segments = normalized.split('/').filter(Boolean);
    const basename = segments[segments.length - 1] ?? normalized;
    return (segments.some((segment) => HARD_EXCLUDE_SEGMENTS.has(segment)) ||
        basename === '.git' ||
        basename === '.triadmind' ||
        isHardExcludedSourceFile(normalized) ||
        HARD_EXCLUDE_BASENAME_PATTERNS.some((pattern) => pattern.test(basename)));
}
function isIgnorableFsError(error) {
    const code = String(error?.code ?? '').toUpperCase();
    return code === 'EACCES' || code === 'EPERM' || code === 'ENOENT';
}
//# sourceMappingURL=config.js.map