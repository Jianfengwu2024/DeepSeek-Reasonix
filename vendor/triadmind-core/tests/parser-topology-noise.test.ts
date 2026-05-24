import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runTreeSitterParser } from '../treeSitterParser';
import { TriadConfig } from '../config';

type ParsedTriadNode = {
    nodeId: string;
    sourcePath: string;
};

function createTestConfig(): TriadConfig {
    return {
        schemaVersion: '1.1',
        architecture: {
            language: 'typescript',
            parserEngine: 'tree-sitter',
            adapter: '@triadmind/plugin-ts'
        },
        categories: {
            core: [],
            workflow: [],
            runtime: [],
            bootstrap: []
        },
        parser: {
            excludePatterns: ['node_modules', '.triadmind'],
            excludePathPatterns: ['tests', 'test', 'dist', 'build', '.next'],
            scanCategories: ['core', 'workflow', 'runtime', 'bootstrap'],
            scanMode: 'capability',
            leafOutputFile: '.triadmind/leaf-map.json',
            capabilityOutputFile: '.triadmind/triad-map.json',
            capabilityThreshold: 4,
            excludeTestFiles: true,
            excludeMagicMethods: true,
            excludePrivateMethods: true,
            helperVerbPolicy: 'suppress',
            foldHelpersIntoOwner: true,
            entryMethodNames: ['execute', 'run', 'handle', 'process', 'dispatch', 'apply', 'invoke', 'plan', 'schedule', 'orchestrate'],
            excludeNodeNamePatterns: ['^(__.*__|_(?!_).*)$', '^(test_.+)$', '^__.*__$', '^(upgrade|downgrade)$'],
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
                'none'
            ],
            includeUntaggedExports: true,
            ghostPolicyByLanguage: {
                default: { includeInDemand: true, topK: 5, minConfidence: 4 },
                typescript: { includeInDemand: true, topK: 4, minConfidence: 4 }
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
        runtime: {
            enabled: true,
            defaultView: 'full',
            includeFrontend: true,
            includeInfra: true,
            frameworkHints: [],
            excludePathPatterns: ['node_modules', '.triadmind', 'dist', 'build', 'tests', 'test'],
            maxSourceFileBytes: 500000,
            maxScannedFiles: 5000,
            failOnExtractorError: false,
            minConfidence: 0.4
        },
        runtimeHealing: {
            enabled: true,
            maxAutoRetries: 3,
            requireHumanApprovalForContractChanges: true,
            snapshotStrategy: 'manual'
        },
        dream: {
            enabled: true,
            idleOnly: false,
            minHoursBetweenRuns: 24,
            minConfidence: 0.55,
            maxProposals: 5,
            autoTriggerEnabled: true,
            autoTriggerCommands: ['trend'],
            minEventsBetweenRuns: 5,
            scanThrottleMinutes: 10,
            lockTimeoutMinutes: 30,
            daemonEnabled: true,
            daemonIntervalSeconds: 180,
            daemonMaxTicksPerRun: 0,
            failOnDreamError: false
        },
        topologyRisk: {
            matureStableNodeIds: [],
            matureStableNodePatterns: [],
            matureStableSourcePaths: [],
            matureStableSourcePathPatterns: []
        }
    };
}

function writeFixture(root: string, relativePath: string, content: string) {
    const targetPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, content, 'utf-8');
}

function parseFixture(files: Record<string, string>) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-noise-'));
    for (const [relativePath, content] of Object.entries(files)) {
        writeFixture(root, relativePath, content);
    }

    const triadPath = path.join(root, '.triadmind', 'triad-map.json');
    runTreeSitterParser('typescript', root, triadPath, createTestConfig());

    return JSON.parse(fs.readFileSync(triadPath, 'utf-8')) as ParsedTriadNode[];
}

test('typescript parser suppresses support, extractor, command, store, and workflow maintenance noise', () => {
    const triadMap = parseFixture({
        'workflowPromptRenderSupport.ts': `
type PromptSection = { title: string; lines: string[] };

export function createPromptSection(title: string, lines: string[]) {
    return { title, lines };
}

export function createCodeBlockSection(title: string, content: string | undefined): PromptSection {
    return createPromptSection(title, [content ?? '']);
}

export function renderPromptBlocks(blocks: string[]): string {
    return blocks.join('\\n\\n');
}
`,
        'runtime/extractors/frontendApiCallExtractor.ts': `
type RuntimeContext = { routes: KnownRoute[] };
type RuntimeTopologyResult = { routes: KnownRoute[] };
type KnownRoute = { path: string };

export const frontendApiCallExtractor = {
    extract(context: RuntimeContext): RuntimeTopologyResult {
        return context;
    },
    matchRoute(method: string, callPath: string, knownRoutes: KnownRoute[]): KnownRoute | undefined {
        return knownRoutes[0];
    },
    registerRoute(route: string): KnownRoute {
        return { path: route };
    }
};
`,
        'promptWorkflowCommands.ts': `
type Command = { name: string };

export function registerPromptWorkflowCommands(program: Command): Command {
    return program;
}
`,
        'triadizationSessionStore.ts': `
type SessionFlag = { stable: boolean };
type TriadizationTask = { id: string };

export function isTriadizationTask(task: TriadizationTask, flag: SessionFlag): boolean {
    return task.id.length > 0 && flag.stable;
}
`,
        'workspaceLifecycleCommands.ts': `
type WorkspaceOptions = { projectRoot: string };
type WorkspaceLifecycleResult = { projectRoot: string };

export function initializeWorkspace(options: WorkspaceOptions): WorkspaceLifecycleResult {
    return options;
}

export function initializeBootstrapScaffold(options: WorkspaceOptions): WorkspaceLifecycleResult {
    return options;
}
`,
        'workflow.ts': `
type WorkflowFocusSeed = { focusId: string };
type WorkflowFocusState = { focusId: string };

export function ensurePipelineArtifactSeedsWithFocus(seed: WorkflowFocusSeed): WorkflowFocusState {
    return seed;
}

export function resetPipelineArtifactsWithFocus(seed: WorkflowFocusSeed): WorkflowFocusState {
    return seed;
}
`
    });

    const idsBySource = new Map<string, string[]>();
    for (const node of triadMap) {
        const entries = idsBySource.get(node.sourcePath) ?? [];
        entries.push(node.nodeId);
        idsBySource.set(node.sourcePath, entries);
    }

    assert.deepEqual(idsBySource.get('workflowPromptRenderSupport.ts')?.sort(), ['WorkflowPromptRenderSupport.module_pipeline']);
    const extractorNodes = idsBySource.get('runtime/extractors/frontendApiCallExtractor.ts') ?? [];
    assert.equal(extractorNodes.some((nodeId) => nodeId === 'FrontendApiCallExtractor.matchRoute'), false);
    assert.equal(extractorNodes.some((nodeId) => nodeId === 'FrontendApiCallExtractor.registerRoute'), false);
    assert.equal(extractorNodes.length, 1);
    assert.ok(
        extractorNodes[0] === 'FrontendApiCallExtractor.extract' ||
            extractorNodes[0] === 'FrontendApiCallExtractor.module_pipeline'
    );
    assert.deepEqual(idsBySource.get('promptWorkflowCommands.ts') ?? [], []);
    assert.deepEqual(idsBySource.get('triadizationSessionStore.ts') ?? [], []);
    assert.deepEqual(idsBySource.get('workspaceLifecycleCommands.ts') ?? [], []);
    assert.deepEqual(idsBySource.get('workflow.ts') ?? [], []);
});
