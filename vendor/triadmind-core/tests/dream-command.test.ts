import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { loadTriadConfig, resolveCategoryFromConfig } from '../config';
import { getWorkspacePaths } from '../workspace';

function createDreamFixture(options?: {
    executeSourcePath?: string;
    paymentSourcePath?: string;
    executeCategory?: string;
    paymentCategory?: string;
}) {
    const executeSourcePath = options?.executeSourcePath ?? 'src/backend/order_service.py';
    const paymentSourcePath = options?.paymentSourcePath ?? 'src/backend/payment_service.py';
    const executeCategory = options?.executeCategory ?? 'backend';
    const paymentCategory = options?.paymentCategory ?? 'backend';
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-dream-'));
    const triadDir = path.join(root, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });

    fs.writeFileSync(
        path.join(triadDir, 'triad-map.json'),
        JSON.stringify(
            [
                {
                    nodeId: 'OrderService.execute',
                    category: executeCategory,
                    sourcePath: executeSourcePath,
                    fission: {
                        problem: 'Execute order orchestration',
                        demand: ['OrderCommand (command)', '[Ghost:Read] Cache (orderCache)'],
                        answer: ['OrderResult']
                    }
                },
                {
                    nodeId: 'PaymentService.process',
                    category: paymentCategory,
                    sourcePath: paymentSourcePath,
                    fission: {
                        problem: 'Process payment',
                        demand: ['OrderResult'],
                        answer: ['PaymentResult']
                    }
                },
                {
                    nodeId: 'NotificationService.handle',
                    category: 'backend',
                    sourcePath: 'src/backend/notification_service.py',
                    fission: {
                        problem: 'Handle notification',
                        demand: ['OrderResult'],
                        answer: ['void']
                    }
                }
            ],
            null,
            2
        ),
        'utf-8'
    );

    fs.writeFileSync(
        path.join(triadDir, 'runtime-map.json'),
        JSON.stringify(
            {
                schemaVersion: '1.0',
                project: 'dream-test',
                generatedAt: new Date().toISOString(),
                view: 'full',
                nodes: [
                    { id: 'ApiRoute.POST./orders/run', type: 'ApiRoute', label: 'POST /orders/run' },
                    { id: 'Service.OrderService.execute', type: 'Service', label: 'OrderService.execute' }
                ],
                edges: [
                    {
                        from: 'ApiRoute.POST./orders/run',
                        to: 'Service.OrderService.execute',
                        type: 'invokes',
                        confidence: 0.92
                    }
                ]
            },
            null,
            2
        ),
        'utf-8'
    );

    fs.writeFileSync(
        path.join(triadDir, 'runtime-diagnostics.json'),
        JSON.stringify(
            [
                {
                    level: 'warning',
                    code: 'RUNTIME_FRONTEND_API_ROUTE_UNMATCHED',
                    extractor: 'FrontendApiCallExtractor',
                    message: 'Could not match frontend API call /api/orders/123/run to a known ApiRoute',
                    sourcePath: 'frontend/src/api/orders.ts'
                }
            ],
            null,
            2
        ),
        'utf-8'
    );

    return root;
}

function createArtifactPathFanoutDreamFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-dream-artifact-fanout-'));
    const triadDir = path.join(root, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });

    const consumerNodes = Array.from({ length: 7 }, (_, index) => ({
        nodeId: `Workflow.consumeWorkspaceArtifact${index + 1}`,
        category: 'backend',
        sourcePath: `src/backend/workflow_consumer_${index + 1}.py`,
        fission: {
            problem: `Consume generated workspace artifact ${index + 1}`,
            demand: ['WorkspacePaths'],
            answer: [`ArtifactReceipt${index + 1}`]
        }
    }));

    fs.writeFileSync(
        path.join(triadDir, 'triad-map.json'),
        JSON.stringify(
            [
                {
                    nodeId: 'Workspace.module_pipeline',
                    category: 'backend',
                    sourcePath: 'src/backend/workspace.py',
                    fission: {
                        problem: 'Build workspace artifact paths',
                        demand: ['string (projectRoot)'],
                        answer: ['WorkspacePaths']
                    }
                },
                ...consumerNodes
            ],
            null,
            2
        ),
        'utf-8'
    );

    fs.writeFileSync(
        path.join(triadDir, 'runtime-map.json'),
        JSON.stringify(
            {
                schemaVersion: '1.0',
                project: 'dream-artifact-fanout-test',
                generatedAt: new Date().toISOString(),
                view: 'full',
                nodes: [],
                edges: []
            },
            null,
            2
        ),
        'utf-8'
    );

    fs.writeFileSync(path.join(triadDir, 'runtime-diagnostics.json'), JSON.stringify([], null, 2), 'utf-8');

    return root;
}

function createStableAnchorFanoutDreamFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-dream-stable-anchor-'));
    const triadDir = path.join(root, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });

    const consumerNodes = Array.from({ length: 7 }, (_, index) => ({
        nodeId: `Consumer${index + 1}.handle`,
        category: 'backend',
        sourcePath: `src/backend/consumer_${index + 1}.py`,
        fission: {
            problem: `Consume orchestration result ${index + 1}`,
            demand: ['WorkflowResult'],
            answer: [`ConsumerResult${index + 1}`]
        }
    }));

    fs.writeFileSync(
        path.join(triadDir, 'triad-map.json'),
        JSON.stringify(
            [
                {
                    nodeId: 'LegacyWorkflow.execute',
                    category: 'backend',
                    sourcePath: 'src/legacy/workflow.py',
                    fission: {
                        problem: 'Execute legacy workflow orchestration',
                        demand: ['WorkflowCommand'],
                        answer: ['WorkflowResult']
                    }
                },
                ...consumerNodes
            ],
            null,
            2
        ),
        'utf-8'
    );

    fs.writeFileSync(
        path.join(triadDir, 'runtime-map.json'),
        JSON.stringify(
            {
                schemaVersion: '1.0',
                project: 'dream-stable-anchor-test',
                generatedAt: new Date().toISOString(),
                view: 'full',
                nodes: [],
                edges: []
            },
            null,
            2
        ),
        'utf-8'
    );

    fs.writeFileSync(path.join(triadDir, 'runtime-diagnostics.json'), JSON.stringify([], null, 2), 'utf-8');
    return root;
}

function createAbstractionDebtDreamFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-dream-abstraction-'));
    const triadDir = path.join(root, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });

    const triadMap = ['StripePay', 'PaypalPay', 'WechatPay'].map((provider) => ({
        nodeId: `${provider}.submit`,
        category: 'backend',
        sourcePath: 'src/backend/payments/flat.ts',
        fission: {
            problem: `Submit payment via ${provider}`,
            demand: ['PayInput'],
            answer: ['PayResult'],
            evidence: {
                abstraction: {
                    role: 'concrete',
                    signals: ['variant_member'],
                    variantCluster: 'pay',
                    abstractionSignalCount: 0,
                    concreteSignalCount: 6,
                    concreteClassCount: 3,
                    publicMethodCount: 3,
                    topLevelExecutableCount: 0
                }
            }
        }
    }));

    fs.writeFileSync(path.join(triadDir, 'triad-map.json'), JSON.stringify(triadMap, null, 2), 'utf-8');
    fs.writeFileSync(
        path.join(triadDir, 'runtime-map.json'),
        JSON.stringify(
            {
                schemaVersion: '1.0',
                project: 'dream-abstraction-test',
                generatedAt: new Date().toISOString(),
                view: 'full',
                nodes: [],
                edges: []
            },
            null,
            2
        ),
        'utf-8'
    );
    fs.writeFileSync(path.join(triadDir, 'runtime-diagnostics.json'), JSON.stringify([], null, 2), 'utf-8');
    return root;
}

function resolveCategoryFromConfigRoot(root: string, sourcePath: string | undefined) {
    const normalizedSourcePath = String(sourcePath ?? '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
    if (!normalizedSourcePath) {
        return 'unknown';
    }

    return resolveCategoryFromConfig(normalizedSourcePath, loadTriadConfig(getWorkspacePaths(root)));
}

function collectProtocolDraftNodeCategoryMismatches(
    root: string,
    report: { proposals?: Array<{ id?: string; protocolDraft?: { actions?: Array<{ node?: { nodeId?: string; sourcePath?: string; category?: string } }> } }> }
) {
    const mismatch: Array<{
        proposalId: string;
        nodeId: string;
        category: string;
        resolved: string;
        sourcePath: string;
    }> = [];
    for (const proposal of Array.isArray(report.proposals) ? report.proposals : []) {
        for (const action of Array.isArray(proposal.protocolDraft?.actions) ? proposal.protocolDraft?.actions : []) {
            const node = action?.node;
            if (!node?.sourcePath) {
                continue;
            }
            const resolved = resolveCategoryFromConfigRoot(root, node.sourcePath);
            const category = String(node.category ?? 'unknown');
            if (category !== resolved) {
                mismatch.push({
                    proposalId: String(proposal.id ?? 'unknown'),
                    nodeId: String(node.nodeId ?? 'unknown'),
                    category,
                    resolved,
                    sourcePath: String(node.sourcePath)
                });
            }
        }
    }
    return mismatch;
}

function runCli(cwd: string, args: string[]) {
    const repoRoot = path.resolve(__dirname, '..');
    const cliPath = path.join(repoRoot, 'cli.ts');
    const tsxLoader = pathToFileURL(require.resolve('tsx')).href;
    return spawnSync(process.execPath, ['--import', tsxLoader, cliPath, ...args], {
        cwd,
        encoding: 'utf-8'
    });
}

test('dream run --json writes dream artifacts and proposals', () => {
    const root = createDreamFixture();
    const result = runCli(root, ['dream', 'run', '--json']);
    assert.equal(result.status, 0, `dream run failed: ${result.stderr || result.stdout}`);

    const jsonStart = result.stdout.indexOf('{');
    assert.ok(jsonStart >= 0, 'dream run --json did not emit JSON payload');
    const report = JSON.parse(result.stdout.slice(jsonStart));

    assert.equal(report.schemaVersion, '1.0');
    assert.equal(report.skipped, false);
    assert.equal(Array.isArray(report.findings), true);
    assert.equal(Array.isArray(report.proposals), true);
    assert.equal(report.proposals.length > 0, true);

    const triadDir = path.join(root, '.triadmind');
    assert.equal(fs.existsSync(path.join(triadDir, 'dream-report.json')), true);
    assert.equal(fs.existsSync(path.join(triadDir, 'dream-diagnostics.json')), true);
    assert.equal(fs.existsSync(path.join(triadDir, 'dream-proposals.json')), true);
    assert.equal(fs.existsSync(path.join(triadDir, 'dream-state.json')), true);
});

test('dream accepts evidence-rich triad artifacts without stripping proposal generation', () => {
    const root = createDreamFixture();
    const triadMapPath = path.join(root, '.triadmind', 'triad-map.json');
    const triadMap = JSON.parse(fs.readFileSync(triadMapPath, 'utf-8'));
    triadMap[0].fission.evidence = {
        ghostReads: [
            {
                raw: '[Ghost:Read] Cache (orderCache)',
                mode: 'read',
                target: 'orderCache',
                retainedInDemand: true,
                score: 5
            }
        ],
        promotionReasons: ['runtime_signal', 'business_semantic'],
        abstraction: {
            role: 'mixed',
            signals: ['strategy_family'],
            variantCluster: 'orders',
            maturity: 'seed'
        },
        customTag: 'dream-evidence-path'
    };
    fs.writeFileSync(triadMapPath, JSON.stringify(triadMap, null, 2), 'utf-8');

    const result = runCli(root, ['dream', '--json']);
    assert.equal(result.status, 0, `dream --json failed on evidence-rich triad artifact: ${result.stderr || result.stdout}`);

    const jsonStart = result.stdout.indexOf('{');
    assert.ok(jsonStart >= 0, 'dream --json did not emit JSON payload');
    const report = JSON.parse(result.stdout.slice(jsonStart));
    assert.equal(report.skipped, false);
    assert.equal(Array.isArray(report.proposals), true);
    assert.equal(report.proposals.length > 0, true);
    assert.equal(fs.existsSync(path.join(root, '.triadmind', 'dream-report.json')), true);
});

test('dream emits abstraction governance findings and extraction proposal for flat concrete variant clusters', () => {
    const root = createAbstractionDebtDreamFixture();
    const result = runCli(root, ['dream', '--json']);
    assert.equal(result.status, 0, `dream --json failed: ${result.stderr || result.stdout}`);

    const report = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
    const findings = Array.isArray(report.findings) ? report.findings : [];
    assert.equal(findings.some((item: { id?: string }) => item.id === 'FINDING_ABSTRACTION_DEFICIT_HIGH'), true);
    assert.equal(
        findings.some((item: { id?: string }) => item.id === 'FINDING_VARIANT_CLUSTER_WITHOUT_CONTRACT'),
        true
    );

    const proposals = Array.isArray(report.proposals) ? report.proposals : [];
    const abstractionProposal = proposals.find((item: { id?: string }) =>
        String(item.id ?? '').startsWith('DREAM_EXTRACT_CORE_ABSTRACTION_')
    );
    assert.ok(abstractionProposal, `expected abstraction proposal, got ${JSON.stringify(proposals, null, 2)}`);

    const createChildAction = Array.isArray(abstractionProposal.protocolDraft?.actions)
        ? abstractionProposal.protocolDraft.actions.find((action: { op?: string }) => action.op === 'create_child')
        : undefined;
    assert.ok(createChildAction, 'expected create_child action in abstraction extraction protocol');
    assert.equal(createChildAction.node.fission.evidence.abstraction.role, 'abstraction');
    assert.equal(createChildAction.node.fission.evidence.abstraction.variantCluster, 'pay');
});

test('dream keeps abstraction governance silent when triad-map lacks abstraction evidence coverage', () => {
    const root = createDreamFixture();
    const result = runCli(root, ['dream', '--json']);
    assert.equal(result.status, 0, `dream --json failed: ${result.stderr || result.stdout}`);

    const report = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
    const findings = Array.isArray(report.findings) ? report.findings : [];
    const proposals = Array.isArray(report.proposals) ? report.proposals : [];
    assert.equal(findings.some((item: { id?: string }) => item.id === 'FINDING_ABSTRACTION_DEFICIT_HIGH'), false);
    assert.equal(
        findings.some((item: { id?: string }) => item.id === 'FINDING_VARIANT_CLUSTER_WITHOUT_CONTRACT'),
        false
    );
    assert.equal(
        proposals.some((item: { id?: string }) => String(item.id ?? '').startsWith('DREAM_EXTRACT_CORE_ABSTRACTION_')),
        false
    );
});

test('dream (no subcommand) defaults to dream run and accepts --json', () => {
    const root = createDreamFixture();
    const result = runCli(root, ['dream', '--json']);
    assert.equal(result.status, 0, `dream --json failed: ${result.stderr || result.stdout}`);

    const jsonStart = result.stdout.indexOf('{');
    assert.ok(jsonStart >= 0, 'dream --json did not emit JSON payload');
    const report = JSON.parse(result.stdout.slice(jsonStart));
    assert.equal(report.schemaVersion, '1.0');
    assert.equal(report.skipped, false);
    assert.equal(Array.isArray(report.proposals), true);
});

test('dream --json and dream run --json are both supported', () => {
    const root1 = createDreamFixture();
    const direct = runCli(root1, ['dream', '--json']);
    assert.equal(direct.status, 0, `dream --json failed: ${direct.stderr || direct.stdout}`);
    const directPayload = JSON.parse(direct.stdout.slice(direct.stdout.indexOf('{')));

    const root2 = createDreamFixture();
    const explicit = runCli(root2, ['dream', 'run', '--json']);
    assert.equal(explicit.status, 0, `dream run --json failed: ${explicit.stderr || explicit.stdout}`);
    const explicitPayload = JSON.parse(explicit.stdout.slice(explicit.stdout.indexOf('{')));

    assert.equal(Array.isArray(directPayload.proposals), true);
    assert.equal(Array.isArray(explicitPayload.proposals), true);
    assert.equal(directPayload.proposals.length > 0, true);
    assert.equal(explicitPayload.proposals.length > 0, true);
});

test('dream idle mode respects minHoursBetweenRuns gate', () => {
    const root = createDreamFixture();

    const firstRun = runCli(root, ['dream', 'run', '--mode', 'idle', '--json']);
    assert.equal(firstRun.status, 0, `first idle dream run failed: ${firstRun.stderr || firstRun.stdout}`);
    const firstPayload = JSON.parse(firstRun.stdout.slice(firstRun.stdout.indexOf('{')));
    assert.equal(firstPayload.skipped, false);

    const secondRun = runCli(root, ['dream', 'run', '--mode', 'idle', '--json']);
    assert.equal(secondRun.status, 0, `second idle dream run failed: ${secondRun.stderr || secondRun.stdout}`);
    const secondPayload = JSON.parse(secondRun.stdout.slice(secondRun.stdout.indexOf('{')));
    assert.equal(secondPayload.skipped, true);
    assert.match(String(secondPayload.skipReason ?? ''), /Idle gate active/i);
});

test('dream review --json returns latest report', () => {
    const root = createDreamFixture();
    const runResult = runCli(root, ['dream', 'run', '--json']);
    assert.equal(runResult.status, 0, `dream run failed: ${runResult.stderr || runResult.stdout}`);

    const reviewResult = runCli(root, ['dream', 'review', '--json']);
    assert.equal(reviewResult.status, 0, `dream review failed: ${reviewResult.stderr || reviewResult.stdout}`);
    const report = JSON.parse(reviewResult.stdout.slice(reviewResult.stdout.indexOf('{')));
    assert.equal(report.schemaVersion, '1.0');
    assert.equal(Array.isArray(report.summary), true);
});

test('dream proposal category and protocolDraft node.category are canonicalized by sourcePath', () => {
    const root = createDreamFixture({
        executeSourcePath: 'src/backend/orders/execution.py',
        paymentSourcePath: 'src/backend/payments/processor.py',
        executeCategory: 'frontend'
    });
    const runResult = runCli(root, ['dream', '--json']);
    assert.equal(runResult.status, 0, `dream run failed: ${runResult.stderr || runResult.stdout}`);

    const report = JSON.parse(runResult.stdout.slice(runResult.stdout.indexOf('{')));
    const proposals = Array.isArray(report.proposals) ? report.proposals : [];
    const backendProposal = proposals.find(
        (proposal: { sourcePath?: string; category?: string }) =>
            typeof proposal?.sourcePath === 'string' && proposal.sourcePath.includes('src/backend/')
    );
    assert.ok(backendProposal, 'expected at least one proposal with backend sourcePath');
    assert.equal(
        backendProposal.category,
        resolveCategoryFromConfigRoot(root, backendProposal.sourcePath),
        'outer proposal category should align with sourcePath'
    );

    const actions = Array.isArray(backendProposal.protocolDraft?.actions) ? backendProposal.protocolDraft.actions : [];
    const createChildAction = actions.find(
        (action: { op?: string; node?: { sourcePath?: string; category?: string } }) => action?.op === 'create_child'
    );
    assert.ok(createChildAction, 'expected create_child action in protocol draft');
    assert.equal(
        createChildAction.node.category,
        resolveCategoryFromConfigRoot(root, createChildAction.node.sourcePath),
        'protocolDraft node.category should align with node.sourcePath'
    );

    const diagnostics = Array.isArray(report.diagnostics) ? report.diagnostics : [];
    assert.equal(
        diagnostics.some((item: { code?: string }) => item.code === 'DREAM_PROPOSAL_CATEGORY_MISMATCH_AUTO_FIXED'),
        true
    );
});

test('dream canonicalize removes all protocolDraft node category/sourcePath mismatches', () => {
    const root = createDreamFixture({
        executeSourcePath: 'src/backend/orders/execution.py',
        paymentSourcePath: 'src/backend/payments/processor.py',
        executeCategory: 'frontend',
        paymentCategory: 'frontend'
    });
    const runResult = runCli(root, ['dream', '--json']);
    assert.equal(runResult.status, 0, `dream run failed: ${runResult.stderr || runResult.stdout}`);

    const report = JSON.parse(runResult.stdout.slice(runResult.stdout.indexOf('{')));
    const mismatch = collectProtocolDraftNodeCategoryMismatches(root, report);
    assert.equal(mismatch.length, 0, `expected protocolDraft mismatch=0, got ${JSON.stringify(mismatch, null, 2)}`);
});

test('dream proposal category uses profile scanScope fallback when raw categories miss', () => {
    const root = createDreamFixture({
        executeSourcePath: 'services/order_service.py',
        paymentSourcePath: 'domain/payment_service.py'
    });
    const paths = getWorkspacePaths(root);
    const config = loadTriadConfig(paths);
    fs.writeFileSync(
        paths.configFile,
        JSON.stringify(
            {
                ...config,
                categories: {
                    frontend: ['src/frontend'],
                    backend: ['src/backend'],
                    core: []
                },
                profile: undefined
            },
            null,
            2
        ),
        'utf-8'
    );

    const profile = JSON.parse(fs.readFileSync(paths.profileFile, 'utf-8'));
    profile.categories = {};
    profile.scanScopes = [
        {
            name: 'legacy-services',
            kind: 'services',
            category: 'backend',
            priority: 200,
            match: {
                pathPrefixes: ['services']
            }
        },
        ...(Array.isArray(profile.scanScopes) ? profile.scanScopes : [])
    ];
    fs.writeFileSync(paths.profileFile, JSON.stringify(profile, null, 2), 'utf-8');

    const runResult = runCli(root, ['dream', '--json']);
    assert.equal(runResult.status, 0, `dream run failed: ${runResult.stderr || runResult.stdout}`);

    const report = JSON.parse(runResult.stdout.slice(runResult.stdout.indexOf('{')));
    const proposals = Array.isArray(report.proposals) ? report.proposals : [];
    const scopedCategoryProposal = proposals.find(
        (proposal: { sourcePath?: string; category?: string }) =>
            typeof proposal?.sourcePath === 'string' &&
            proposal.sourcePath.includes('services/order_service.py') &&
            proposal.category === 'backend'
    );
    assert.ok(scopedCategoryProposal, 'expected services scope proposal category to resolve as backend');

    const actions = Array.isArray(scopedCategoryProposal.protocolDraft?.actions)
        ? scopedCategoryProposal.protocolDraft.actions
        : [];
    const createChildAction = actions.find(
        (action: { op?: string; node?: { sourcePath?: string; category?: string } }) =>
            action?.op === 'create_child' && action?.node?.sourcePath?.includes('services/order_service.py')
    );
    assert.ok(createChildAction, 'expected create_child action using unmapped sourcePath');
    assert.equal(createChildAction.node.category, 'backend');

    const diagnostics = Array.isArray(report.diagnostics) ? report.diagnostics : [];
    assert.equal(
        diagnostics.some(
            (item: { code?: string; sourcePath?: string }) =>
                item.code === 'DREAM_PROPOSAL_CATEGORY_UNRESOLVED' &&
                String(item.sourcePath ?? '').includes('services/order_service.py')
        ),
        false
    );
});

test('dream auto --json emits auto tick result payload', () => {
    const root = createDreamFixture();
    const result = runCli(root, ['dream', 'auto', '--trigger', 'sync', '--force', '--json']);
    assert.equal(result.status, 0, `dream auto failed: ${result.stderr || result.stdout}`);

    const jsonStart = result.stdout.indexOf('{');
    assert.ok(jsonStart >= 0, 'dream auto --json did not emit JSON payload');
    const payload = JSON.parse(result.stdout.slice(jsonStart));
    assert.equal(typeof payload.status, 'string');
    assert.equal(typeof payload.pendingEvents, 'number');
});

test('dream fanout analysis ignores internal artifact path contracts', () => {
    const root = createArtifactPathFanoutDreamFixture();
    const result = runCli(root, ['dream', '--json']);
    assert.equal(result.status, 0, `dream --json failed: ${result.stderr || result.stdout}`);

    const report = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
    const findings = Array.isArray(report.findings) ? report.findings : [];
    const fanoutFinding = findings.find((item: { id?: string }) => item.id === 'FINDING_HIGH_FANOUT_CAPABILITY');
    assert.equal(fanoutFinding, undefined, `unexpected fanout finding: ${JSON.stringify(fanoutFinding, null, 2)}`);

    const proposals = Array.isArray(report.proposals) ? report.proposals : [];
    assert.equal(
        proposals.some(
            (item: { id?: string; title?: string }) =>
                String(item.id ?? '').includes('WORKSPACE_MODULE_PIPELINE') ||
                String(item.title ?? '').includes('Workspace.module_pipeline')
        ),
        false,
        `unexpected Workspace.module_pipeline dream proposal: ${JSON.stringify(proposals, null, 2)}`
    );
});

test('dream fanout analysis skips mature stable architecture anchors', () => {
    const root = createStableAnchorFanoutDreamFixture();
    const paths = getWorkspacePaths(root);
    const config = loadTriadConfig(paths);
    fs.writeFileSync(
        paths.configFile,
        JSON.stringify(
            {
                ...config,
                topologyRisk: {
                    matureStableNodeIds: ['LegacyWorkflow.execute'],
                    matureStableNodePatterns: [],
                    matureStableSourcePaths: ['src/legacy/workflow.py'],
                    matureStableSourcePathPatterns: ['src/legacy/**']
                }
            },
            null,
            2
        ),
        'utf-8'
    );

    const result = runCli(root, ['dream', '--json']);
    assert.equal(result.status, 0, `dream --json failed: ${result.stderr || result.stdout}`);

    const report = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
    const findings = Array.isArray(report.findings) ? report.findings : [];
    assert.equal(findings.some((item: { id?: string }) => item.id === 'FINDING_HIGH_FANOUT_CAPABILITY'), false);

    const proposals = Array.isArray(report.proposals) ? report.proposals : [];
    assert.equal(
        proposals.some((item: { id?: string }) => String(item.id ?? '').includes('DREAM_SPLIT_HIGH_FANOUT')),
        false
    );

    const diagnostics = Array.isArray(report.diagnostics) ? report.diagnostics : [];
    assert.equal(
        diagnostics.some((item: { code?: string }) => item.code === 'DREAM_HIGH_FANOUT_STABLE_ANCHOR_SKIPPED'),
        true
    );
});

test('dream feedback reject persists project memory and suppresses repeated proposal signatures', () => {
    const root = createDreamFixture();
    const firstRun = runCli(root, ['dream', '--json']);
    assert.equal(firstRun.status, 0, `dream run failed: ${firstRun.stderr || firstRun.stdout}`);

    const firstReport = JSON.parse(firstRun.stdout.slice(firstRun.stdout.indexOf('{')));
    const targetProposal = Array.isArray(firstReport.proposals)
        ? firstReport.proposals.find((item: { id?: string }) => item.id === 'DREAM_CAPABILITY_EXECUTE_DENOISE')
        : undefined;
    assert.ok(targetProposal, `expected DREAM_CAPABILITY_EXECUTE_DENOISE proposal, got ${JSON.stringify(firstReport.proposals, null, 2)}`);

    const rejectResult = runCli(root, [
        'dream',
        'feedback',
        'reject',
        '--proposal',
        String(targetProposal.id),
        '--reason',
        'Too generic for this project topology',
        '--reviewer',
        'codex',
        '--reviewer-role',
        'ai',
        '--json'
    ]);
    assert.equal(rejectResult.status, 0, `dream feedback reject failed: ${rejectResult.stderr || rejectResult.stdout}`);
    const rejectPayload = JSON.parse(rejectResult.stdout.slice(rejectResult.stdout.indexOf('{')));
    assert.equal(rejectPayload.record.proposalId, 'DREAM_CAPABILITY_EXECUTE_DENOISE');
    assert.equal(rejectPayload.record.reviewerRole, 'ai');
    assert.equal(fs.existsSync(path.join(root, '.triadmind', 'dream-feedback.json')), true);

    const feedbackReview = runCli(root, ['dream', 'feedback', 'review', '--json']);
    assert.equal(feedbackReview.status, 0, `dream feedback review failed: ${feedbackReview.stderr || feedbackReview.stdout}`);
    const feedbackLedger = JSON.parse(feedbackReview.stdout.slice(feedbackReview.stdout.indexOf('{')));
    assert.equal(Array.isArray(feedbackLedger.rejections), true);
    assert.equal(
        feedbackLedger.rejections.some((item: { proposalId?: string; reviewerRole?: string }) => item.proposalId === 'DREAM_CAPABILITY_EXECUTE_DENOISE' && item.reviewerRole === 'ai'),
        true
    );

    const secondRun = runCli(root, ['dream', '--json']);
    assert.equal(secondRun.status, 0, `second dream run failed: ${secondRun.stderr || secondRun.stdout}`);
    const secondReport = JSON.parse(secondRun.stdout.slice(secondRun.stdout.indexOf('{')));
    const secondProposals = Array.isArray(secondReport.proposals) ? secondReport.proposals : [];
    assert.equal(
        secondProposals.some((item: { id?: string }) => item.id === 'DREAM_CAPABILITY_EXECUTE_DENOISE'),
        false,
        `expected rejected proposal to be suppressed, got ${JSON.stringify(secondProposals, null, 2)}`
    );

    const diagnostics = Array.isArray(secondReport.diagnostics) ? secondReport.diagnostics : [];
    assert.equal(
        diagnostics.some(
            (item: { code?: string; message?: string }) =>
                item.code === 'DREAM_PROPOSAL_SUPPRESSED_BY_FEEDBACK' &&
                String(item.message ?? '').includes('DREAM_CAPABILITY_EXECUTE_DENOISE')
        ),
        true
    );

    const summary = Array.isArray(secondReport.summary) ? secondReport.summary : [];
    assert.equal(summary.some((item: string) => /Suppressed 1 proposal\(s\)/.test(item)), true);
});

test('dream feedback reject can auto-register mature stable anchor for high-fanout proposal', () => {
    const root = createStableAnchorFanoutDreamFixture();
    const firstRun = runCli(root, ['dream', '--json']);
    assert.equal(firstRun.status, 0, `dream run failed: ${firstRun.stderr || firstRun.stdout}`);

    const firstReport = JSON.parse(firstRun.stdout.slice(firstRun.stdout.indexOf('{')));
    const targetProposal = Array.isArray(firstReport.proposals)
        ? firstReport.proposals.find((item: { id?: string }) => String(item.id ?? '').includes('DREAM_SPLIT_HIGH_FANOUT'))
        : undefined;
    assert.ok(targetProposal, `expected high-fanout proposal, got ${JSON.stringify(firstReport.proposals, null, 2)}`);

    const rejectResult = runCli(root, [
        'dream',
        'feedback',
        'reject',
        '--proposal',
        String(targetProposal.id),
        '--reason',
        'This is a stable legacy gravity center',
        '--reason-code',
        'stable_core_module',
        '--json'
    ]);
    assert.equal(rejectResult.status, 0, `dream feedback reject failed: ${rejectResult.stderr || rejectResult.stdout}`);
    const rejectPayload = JSON.parse(rejectResult.stdout.slice(rejectResult.stdout.indexOf('{')));
    assert.equal(rejectPayload.record.isStableAnchor, true);
    assert.equal(rejectPayload.stableAnchor.nodeId, 'LegacyWorkflow.execute');

    const paths = getWorkspacePaths(root);
    const updatedConfig = JSON.parse(fs.readFileSync(paths.configFile, 'utf-8'));
    assert.equal(updatedConfig.topologyRisk.matureStableNodeIds.includes('LegacyWorkflow.execute'), true);

    const secondRun = runCli(root, ['dream', '--json']);
    assert.equal(secondRun.status, 0, `second dream run failed: ${secondRun.stderr || secondRun.stdout}`);
    const secondReport = JSON.parse(secondRun.stdout.slice(secondRun.stdout.indexOf('{')));
    const secondProposals = Array.isArray(secondReport.proposals) ? secondReport.proposals : [];
    assert.equal(
        secondProposals.some((item: { id?: string }) => String(item.id ?? '').includes('DREAM_SPLIT_HIGH_FANOUT')),
        false,
        `expected stable anchor high-fanout proposal to disappear, got ${JSON.stringify(secondProposals, null, 2)}`
    );
});

test('dream stable-anchor add persists manual architecture anchor declarations', () => {
    const root = createStableAnchorFanoutDreamFixture();
    const addResult = runCli(root, [
        'dream',
        'stable-anchor',
        'add',
        '--node',
        'LegacyWorkflow.execute',
        '--source-path',
        'src/legacy/workflow.py',
        '--json'
    ]);
    assert.equal(addResult.status, 0, `dream stable-anchor add failed: ${addResult.stderr || addResult.stdout}`);
    const addPayload = JSON.parse(addResult.stdout.slice(addResult.stdout.indexOf('{')));
    assert.equal(addPayload.registeredAnchor.nodeId, 'LegacyWorkflow.execute');
    assert.equal(addPayload.registeredAnchor.sourcePath, 'src/legacy/workflow.py');
    assert.equal(addPayload.topologyRisk.matureStableNodeIds.includes('LegacyWorkflow.execute'), true);

    const secondRun = runCli(root, ['dream', '--json']);
    assert.equal(secondRun.status, 0, `dream run failed: ${secondRun.stderr || secondRun.stdout}`);
    const report = JSON.parse(secondRun.stdout.slice(secondRun.stdout.indexOf('{')));
    const proposals = Array.isArray(report.proposals) ? report.proposals : [];
    assert.equal(
        proposals.some((item: { id?: string }) => String(item.id ?? '').includes('DREAM_SPLIT_HIGH_FANOUT')),
        false
    );
});

test('dream stable-anchor review merges config anchors and feedback-derived anchors', () => {
    const root = createStableAnchorFanoutDreamFixture();
    const paths = getWorkspacePaths(root);

    const config = loadTriadConfig(paths);
    fs.writeFileSync(
        paths.configFile,
        JSON.stringify(
            {
                ...config,
                topologyRisk: {
                    matureStableNodeIds: ['ConfiguredLegacy.execute'],
                    matureStableNodePatterns: [],
                    matureStableSourcePaths: ['src/configured/legacy.py'],
                    matureStableSourcePathPatterns: ['src/configured/**']
                }
            },
            null,
            2
        ),
        'utf-8'
    );

    fs.writeFileSync(
        paths.dreamFeedbackFile,
        JSON.stringify(
            {
                schemaVersion: '1.0',
                project: 'dream-stable-anchor-review',
                rejections: [
                    {
                        decisionId: 'feedback-1',
                        decision: 'reject',
                        proposalId: 'DREAM_SPLIT_HIGH_FANOUT_1',
                        proposalFamily: 'DREAM_SPLIT_HIGH_FANOUT',
                        proposalSignature: 'signature-1',
                        proposalTitle: 'Keep legacy workflow stable',
                        sourcePath: 'src/legacy/workflow.py',
                        targetNodeIds: ['LegacyWorkflow.execute'],
                        linkedFindings: [],
                        reason: 'Stable core module',
                        reasonCode: 'stable_core_module',
                        reviewer: 'maintainer',
                        reviewerRole: 'maintainer',
                        recordedAt: '2026-05-08T10:00:00.000Z'
                    }
                ]
            },
            null,
            2
        ),
        'utf-8'
    );

    const reviewResult = runCli(root, ['dream', 'stable-anchor', 'review', '--json']);
    assert.equal(reviewResult.status, 0, `dream stable-anchor review failed: ${reviewResult.stderr || reviewResult.stdout}`);
    const reviewPayload = JSON.parse(reviewResult.stdout.slice(reviewResult.stdout.indexOf('{')));
    assert.equal(reviewPayload.loadStatus, 'ok');
    assert.equal(reviewPayload.stableAnchors.matureStableNodeIds.includes('ConfiguredLegacy.execute'), true);
    assert.equal(reviewPayload.stableAnchors.matureStableNodeIds.includes('LegacyWorkflow.execute'), true);
    assert.equal(reviewPayload.stableAnchors.matureStableSourcePaths.includes('src/configured/legacy.py'), true);
    assert.equal(reviewPayload.stableAnchors.matureStableSourcePaths.includes('src/legacy/workflow.py'), true);
});

test('dream run ignores invalid dream feedback memory but records a diagnostic', () => {
    const root = createDreamFixture();
    fs.writeFileSync(path.join(root, '.triadmind', 'dream-feedback.json'), '{"schemaVersion":"1.0","rejections":{}}', 'utf-8');

    const result = runCli(root, ['dream', '--json']);
    assert.equal(result.status, 0, `dream run failed: ${result.stderr || result.stdout}`);

    const report = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
    const diagnostics = Array.isArray(report.diagnostics) ? report.diagnostics : [];
    assert.equal(
        diagnostics.some((item: { code?: string }) => item.code === 'DREAM_FEEDBACK_MEMORY_INVALID'),
        true,
        `expected DREAM_FEEDBACK_MEMORY_INVALID diagnostic, got ${JSON.stringify(diagnostics, null, 2)}`
    );
    assert.equal(Array.isArray(report.proposals), true);
});
