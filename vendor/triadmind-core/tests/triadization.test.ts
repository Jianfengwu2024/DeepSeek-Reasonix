import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolveAnalyzerOptionsFromConfig } from '../analyzerOptionsSupport';
import { analyzeWorkspaceStage } from '../stage';
import {
    analyzeTriadizationOpportunities,
    buildTriadizationTaskMarkdown,
    readTriadizationSession,
    writeTriadizationArtifacts,
    writeTriadizationConfirmation
} from '../triadization';
import { getWorkspacePaths } from '../workspace';

function runCli(cwd: string, args: string[]) {
    const repoRoot = path.resolve(__dirname, '..');
    const cliPath = path.join(repoRoot, 'cli.ts');
    const tsxLoader = pathToFileURL(require.resolve('tsx')).href;
    return spawnSync(process.execPath, ['--import', tsxLoader, cliPath, ...args], {
        cwd,
        encoding: 'utf-8'
    });
}

function createTriadizeFixture(map: unknown[]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-triadize-'));
    const triadDir = path.join(root, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });
    fs.writeFileSync(path.join(triadDir, 'triad-map.json'), JSON.stringify(map, null, 2), 'utf-8');
    return root;
}

function createWorkflowMap() {
    return [
        {
            nodeId: 'Workflow.execute',
            category: 'core',
            sourcePath: 'src/workflow.ts',
            fission: {
                problem: 'Workflow orchestration',
                demand: ['RunCommand'],
                answer: ['WorkflowResult']
            }
        },
        ...Array.from({ length: 6 }, (_, index) => ({
            nodeId: `Downstream${index + 1}.handle`,
            category: 'core',
            sourcePath: `src/downstream_${index + 1}.ts`,
            fission: {
                problem: `Downstream ${index + 1}`,
                demand: ['WorkflowResult'],
                answer: [`Out${index + 1}`]
            }
        }))
    ];
}

function createArtifactPathFanoutMap() {
    return [
        {
            nodeId: 'Workspace.module_pipeline',
            category: 'core',
            sourcePath: 'src/workspace.ts',
            fission: {
                problem: 'Build workspace artifact paths',
                demand: ['string (projectRoot)'],
                answer: ['WorkspacePaths']
            }
        },
        ...Array.from({ length: 7 }, (_, index) => ({
            nodeId: `ArtifactConsumer${index + 1}.handle`,
            category: 'core',
            sourcePath: `src/artifact_consumer_${index + 1}.ts`,
            fission: {
                problem: `Consume workspace artifact ${index + 1}`,
                demand: ['WorkspacePaths'],
                answer: [`ArtifactReceipt${index + 1}`]
            }
        }))
    ];
}

function createFocusedDraftProtocol(
    overrides: Partial<{
        macroFocus: string;
        macroOperation: 'aggregate' | 'split' | 'renormalize';
        mesoFocus: string;
        mesoOperation: 'aggregate' | 'split' | 'renormalize';
        microFocus: string;
        microOperation: 'aggregate' | 'split' | 'renormalize';
    }> = {}
) {
    const macroFocus = overrides.macroFocus ?? 'Workflow.execute';
    const macroOperation = overrides.macroOperation ?? 'split';
    const mesoFocus = overrides.mesoFocus ?? macroFocus;
    const mesoOperation = overrides.mesoOperation ?? macroOperation;
    const microFocus = overrides.microFocus ?? macroFocus;
    const microOperation = overrides.microOperation ?? macroOperation;

    return {
        userDemand: 'Refine workflow triadization',
        macroSplit: {
            triadizationFocus: macroFocus,
            recommendedOperation: macroOperation,
            anchorNodeId: 'Workflow.execute',
            vertexGoal: 'Split workflow orchestration into explicit branches.',
            leftBranch: ['Workflow.execute'],
            rightBranch: ['WorkflowConfig']
        },
        mesoSplit: {
            triadizationFocus: mesoFocus,
            recommendedOperation: mesoOperation,
            classes: [
                {
                    className: 'Workflow',
                    category: 'core',
                    responsibility: 'Coordinate workflow execution',
                    upstreams: ['RunCommand'],
                    downstreams: ['WorkflowResult']
                }
            ],
            pipelines: [
                {
                    pipelineId: 'Workflow.Main',
                    purpose: 'Run workflow orchestration',
                    steps: ['Workflow.execute']
                }
            ]
        },
        microSplit: {
            triadizationFocus: microFocus,
            recommendedOperation: microOperation,
            classes: [
                {
                    className: 'Workflow',
                    staticRightBranch: [{ name: 'config', type: 'WorkflowConfig', role: 'workflow constraints' }],
                    dynamicLeftBranch: [
                        {
                            name: 'execute',
                            demand: ['RunCommand'],
                            answer: ['WorkflowResult'],
                            responsibility: 'Execute workflow'
                        }
                    ]
                }
            ]
        },
        actions: [{ op: 'reuse', nodeId: 'Workflow.execute' }]
    };
}

function createFocusedMicroSplit(
    overrides: Partial<{
        focus: string;
        operation: 'aggregate' | 'split' | 'renormalize';
        className: string;
        dynamicLeftBranch: unknown[];
    }> = {}
) {
    return {
        triadizationFocus: overrides.focus ?? 'Workflow.execute',
        recommendedOperation: overrides.operation ?? 'split',
        classes: [
            {
                className: overrides.className ?? 'Workflow',
                staticRightBranch: [{ name: 'config', type: 'WorkflowConfig', role: 'workflow constraints' }],
                dynamicLeftBranch:
                    overrides.dynamicLeftBranch ??
                    [
                        {
                            name: 'execute',
                            demand: ['RunCommand'],
                            answer: ['WorkflowResult'],
                            responsibility: 'Execute workflow'
                        }
                    ]
            }
        ]
    };
}

test('triadization analysis prioritizes renormalize for cyclic clusters', () => {
    const map = [
        {
            nodeId: 'Alpha.execute',
            category: 'core',
            sourcePath: 'src/alpha.ts',
            fission: {
                problem: 'Alpha stage',
                demand: ['GammaResult'],
                answer: ['AlphaResult']
            }
        },
        {
            nodeId: 'Beta.execute',
            category: 'core',
            sourcePath: 'src/beta.ts',
            fission: {
                problem: 'Beta stage',
                demand: ['AlphaResult'],
                answer: ['BetaResult']
            }
        },
        {
            nodeId: 'Gamma.execute',
            category: 'core',
            sourcePath: 'src/gamma.ts',
            fission: {
                problem: 'Gamma stage',
                demand: ['BetaResult'],
                answer: ['GammaResult']
            }
        }
    ];

    const report = analyzeTriadizationOpportunities('cycle-project', map);
    const markdown = buildTriadizationTaskMarkdown(report);

    assert.equal(report.primaryProposal?.recommendedOperation, 'renormalize');
    assert.deepEqual(report.primaryProposal?.targetNodeIds, ['Alpha.execute', 'Beta.execute', 'Gamma.execute']);
    assert.match(markdown, /Operation: renormalize/);
    assert.match(markdown, /Target Node: Alpha\.execute/);
});

test('triadization analysis prioritizes split for overloaded orchestrators', () => {
    const report = analyzeTriadizationOpportunities('split-project', [
        {
            nodeId: 'Workflow.execute',
            category: 'core',
            sourcePath: 'src/workflow.ts',
            fission: {
                problem: 'Workflow orchestration',
                demand: ['RunCommand'],
                answer: ['WorkflowResult']
            }
        },
        ...Array.from({ length: 6 }, (_, index) => ({
            nodeId: `Consumer${index + 1}.handle`,
            category: 'core',
            sourcePath: `src/consumer_${index + 1}.ts`,
            fission: {
                problem: `Consumer ${index + 1}`,
                demand: ['WorkflowResult'],
                answer: [`Consumer${index + 1}Result`]
            }
        }))
    ]);

    assert.equal(report.primaryProposal?.recommendedOperation, 'split');
    assert.equal(report.primaryProposal?.targetNodeId, 'Workflow.execute');
    assert.equal(report.primaryProposal?.diagnosis.includes('left_right_mixing'), true);
});

test('triadization analysis ignores internal artifact path contracts when detecting split candidates', () => {
    const report = analyzeTriadizationOpportunities('artifact-project', createArtifactPathFanoutMap());

    assert.equal(
        report.candidates.some(
            (proposal) => proposal.recommendedOperation === 'split' && proposal.targetNodeId === 'Workspace.module_pipeline'
        ),
        false
    );
    assert.notEqual(report.primaryProposal?.targetNodeId, 'Workspace.module_pipeline');
});

test('triadization analysis skips split suggestions for mature stable anchors', () => {
    const report = analyzeTriadizationOpportunities(
        'stable-anchor-project',
        [
            {
                nodeId: 'LegacyWorkflow.execute',
                category: 'core',
                sourcePath: 'src/legacy/workflow.ts',
                fission: {
                    problem: 'Run legacy workflow',
                    demand: ['LegacyCommand'],
                    answer: ['LegacyResult']
                }
            },
            ...Array.from({ length: 6 }, (_, index) => ({
                nodeId: `LegacyConsumer${index + 1}.handle`,
                category: 'core',
                sourcePath: `src/core/legacy_consumer_${index + 1}.ts`,
                fission: {
                    problem: `Consume legacy result ${index + 1}`,
                    demand: ['LegacyResult'],
                    answer: [`LegacyConsumer${index + 1}Result`]
                }
            }))
        ],
        {
            matureStableNodeIds: ['LegacyWorkflow.execute'],
            matureStableNodePatterns: [],
            matureStableSourcePaths: ['src/legacy/workflow.ts'],
            matureStableSourcePathPatterns: ['src/legacy/**']
        }
    );

    assert.equal(
        report.candidates.some(
            (proposal) => proposal.recommendedOperation === 'split' && proposal.targetNodeId === 'LegacyWorkflow.execute'
        ),
        false
    );
});

test('triadization session store reuses ledger-backed stable anchors without config declarations', () => {
    const root = createTriadizeFixture([
        {
            nodeId: 'LegacyWorkflow.execute',
            category: 'core',
            sourcePath: 'src/legacy/workflow.ts',
            fission: {
                problem: 'Run legacy workflow',
                demand: ['LegacyCommand'],
                answer: ['LegacyResult']
            }
        },
        ...Array.from({ length: 6 }, (_, index) => ({
            nodeId: `LegacyConsumer${index + 1}.handle`,
            category: 'core',
            sourcePath: `src/core/legacy_consumer_${index + 1}.ts`,
            fission: {
                problem: `Consume legacy result ${index + 1}`,
                demand: ['LegacyResult'],
                answer: [`LegacyConsumer${index + 1}Result`]
            }
        }))
    ]);

    fs.writeFileSync(
        path.join(root, '.triadmind', 'dream-feedback.json'),
        JSON.stringify(
            {
                schemaVersion: '1.0',
                project: 'triadize-ledger-stable-anchor',
                rejections: [
                    {
                        decisionId: 'feedback-1',
                        decision: 'reject',
                        proposalId: 'DREAM_SPLIT_HIGH_FANOUT_LegacyWorkflow_execute',
                        proposalFamily: 'DREAM_SPLIT_HIGH_FANOUT',
                        proposalSignature: 'legacy-workflow-signature',
                        proposalTitle: 'Keep legacy workflow as stable gravity center',
                        sourcePath: 'src/legacy/workflow.ts',
                        targetNodeIds: ['LegacyWorkflow.execute'],
                        linkedFindings: ['FINDING_HIGH_FANOUT_1'],
                        reason: 'Mature legacy module should stay intact',
                        reasonCode: 'stable_core_module',
                        reviewer: 'maintainer',
                        reviewerRole: 'maintainer',
                        recordedAt: '2026-05-08T09:00:00.000Z'
                    }
                ]
            },
            null,
            2
        ),
        'utf-8'
    );

    const paths = getWorkspacePaths(root);
    const report = writeTriadizationArtifacts(paths);

    assert.equal(
        report.candidates.some(
            (proposal) => proposal.recommendedOperation === 'split' && proposal.targetNodeId === 'LegacyWorkflow.execute'
        ),
        false
    );
});

test('triadization analysis prioritizes aggregate for fragmented capability leaves', () => {
    const map = [
        {
            nodeId: 'Planner.build',
            category: 'core',
            sourcePath: 'src/planner.ts',
            fission: {
                problem: 'Build plan draft',
                demand: ['PlanInput'],
                answer: ['BuildResult']
            }
        },
        {
            nodeId: 'Planner.resolve',
            category: 'core',
            sourcePath: 'src/planner.ts',
            fission: {
                problem: 'Resolve plan route',
                demand: ['BuildResult'],
                answer: ['ResolveResult']
            }
        },
        {
            nodeId: 'Planner.collect',
            category: 'core',
            sourcePath: 'src/planner.ts',
            fission: {
                problem: 'Collect plan diagnostics',
                demand: ['ResolveResult'],
                answer: ['CollectResult']
            }
        }
    ];

    const report = analyzeTriadizationOpportunities('aggregate-project', map);
    assert.equal(report.primaryProposal?.recommendedOperation, 'aggregate');
    assert.equal(report.primaryProposal?.targetNodeId, 'Planner@src/planner.ts');
    assert.equal(report.primaryProposal?.diagnosis.includes('capability_fragmented'), true);
});

test('converge placeholder ignores internal artifact path contracts', () => {
    const root = createTriadizeFixture(createArtifactPathFanoutMap());
    const result = runCli(root, ['converge']);
    assert.equal(result.status, 0, `converge failed: ${result.stderr || result.stdout}`);

    const paths = getWorkspacePaths(root);
    const content = fs.readFileSync(paths.convergeTaskFile, 'utf-8');
    assert.match(content, /None\. No current node exceeds the default threshold of 3 downstream nodes\./);
    assert.doesNotMatch(content, /Workspace\.module_pipeline\s*->/);
});

test('resolveAnalyzerOptionsFromConfig copies parser analyzer options from triad config', () => {
    const genericContractIgnoreList = ['WorkspacePaths', 'PromptPacket'];
    const analyzerOptions = resolveAnalyzerOptionsFromConfig({
        parser: {
            ignoreGenericContracts: false,
            genericContractIgnoreList
        },
        topologyRisk: {
            matureStableNodeIds: ['LegacyWorkflow.execute'],
            matureStableNodePatterns: ['^LegacyWorkflow\\.'],
            matureStableSourcePaths: ['src/legacy/workflow.ts'],
            matureStableSourcePathPatterns: ['src/legacy/**']
        }
    });

    assert.deepEqual(analyzerOptions, {
        ignoreGenericContracts: false,
        genericContractIgnoreList: ['WorkspacePaths', 'PromptPacket'],
        matureStableNodeIds: ['LegacyWorkflow.execute'],
        matureStableNodePatterns: ['^LegacyWorkflow\\.'],
        matureStableSourcePaths: ['src/legacy/workflow.ts'],
        matureStableSourcePathPatterns: ['src/legacy/**']
    });
    assert.notEqual(analyzerOptions.genericContractIgnoreList, genericContractIgnoreList);
});

test('stage analysis surfaces triadization focus before protocol approval', () => {
    const triadizationReport = analyzeTriadizationOpportunities('stage-project', createWorkflowMap());

    const stage = analyzeWorkspaceStage({
        latestDemand: 'Refine workflow triadization',
        draftProtocol: '',
        macroSplit: '',
        mesoSplit: '',
        microSplit: '',
        approvedProtocol: '',
        triadizationReport: JSON.stringify(triadizationReport)
    });

    assert.equal(stage.hasTriadizationReport, true);
    assert.equal(stage.triadizationFocus, 'Workflow.execute -> split');
    assert.match(stage.currentStage, /Stage 0 - triadization diagnosis/);
});

test('stage analysis reports protocol focus drift with repair target before visualizer approval', () => {
    const triadizationReport = analyzeTriadizationOpportunities('stage-focus-drift', createWorkflowMap());

    const stage = analyzeWorkspaceStage({
        latestDemand: 'Refine workflow triadization',
        draftProtocol: JSON.stringify(createFocusedDraftProtocol()),
        macroSplit: '',
        mesoSplit: '',
        microSplit: JSON.stringify(
            createFocusedMicroSplit({
                focus: 'Planner.aggregate',
                operation: 'aggregate'
            })
        ),
        approvedProtocol: '',
        triadizationReport: JSON.stringify(triadizationReport)
    });

    assert.equal(stage.hasBlockingTriadizationFocusGate, true);
    assert.equal(stage.triadizationFocusGateKind, 'protocol_focus_alignment');
    assert.match(stage.currentStage, /protocol_focus_alignment/);
    assert.match(stage.currentStage, /Workflow\.execute -> split/);
});

test('stage analysis reports class-level focus closure gap with repair target before apply', () => {
    const triadizationReport = analyzeTriadizationOpportunities('stage-focus-closure', createWorkflowMap());

    const stage = analyzeWorkspaceStage({
        latestDemand: 'Refine workflow triadization',
        draftProtocol: JSON.stringify(createFocusedDraftProtocol()),
        macroSplit: '',
        mesoSplit: '',
        microSplit: JSON.stringify(
            createFocusedMicroSplit({
                dynamicLeftBranch: [
                    {
                        name: 'run',
                        demand: ['RunCommand'],
                        answer: ['WorkflowResult'],
                        responsibility: 'Run workflow execution'
                    }
                ]
            })
        ),
        approvedProtocol: '',
        triadizationReport: JSON.stringify(triadizationReport)
    });

    assert.equal(stage.hasBlockingTriadizationFocusGate, true);
    assert.equal(stage.triadizationFocusGateKind, 'triad_focus_closure');
    assert.match(stage.currentStage, /triad_focus_closure/);
    assert.match(stage.currentStage, /Workflow\.execute/);
});

test('triadize command emits report, task, and session artifacts', () => {
    const root = createTriadizeFixture([
        {
            nodeId: 'Workflow.execute',
            category: 'core',
            sourcePath: 'src/workflow.ts',
            fission: {
                problem: 'Workflow orchestration',
                demand: ['RunCommand'],
                answer: ['WorkflowResult']
            }
        },
        ...Array.from({ length: 6 }, (_, index) => ({
            nodeId: `Consumer${index + 1}.handle`,
            category: 'core',
            sourcePath: `src/consumer_${index + 1}.ts`,
            fission: {
                problem: `Consumer ${index + 1}`,
                demand: ['WorkflowResult'],
                answer: [`Consumer${index + 1}Result`]
            }
        }))
    ]);

    const result = runCli(root, ['triadize', '--json']);
    assert.equal(result.status, 0, `triadize failed: ${result.stderr || result.stdout}`);
    const jsonStart = result.stdout.indexOf('{');
    assert.ok(jsonStart >= 0, 'triadize --json did not emit JSON payload');
    const report = JSON.parse(result.stdout.slice(jsonStart));
    assert.equal(report.primaryProposal.recommendedOperation, 'split');
    assert.equal(fs.existsSync(path.join(root, '.triadmind', 'triadization-report.json')), true);
    assert.equal(fs.existsSync(path.join(root, '.triadmind', 'triadization-task.md')), true);
    assert.equal(fs.existsSync(path.join(root, '.triadmind', 'triadization-session.json')), true);
});

test('triadization session is written and preserves confirmation while the focus stays stable', () => {
    const root = createTriadizeFixture(createWorkflowMap());
    const paths = getWorkspacePaths(root);

    const firstReport = writeTriadizationArtifacts(paths);
    const firstSession = readTriadizationSession(paths);
    assert.ok(firstSession);
    assert.equal(firstSession.triadizationFocus, 'Workflow.execute');
    assert.equal(firstSession.recommendedOperation, 'split');
    assert.equal(firstSession.status, 'proposed');

    writeTriadizationConfirmation(paths, firstReport, 'triadize');
    const confirmedSession = readTriadizationSession(paths);
    assert.ok(confirmedSession);
    assert.equal(confirmedSession.status, 'confirmed');
    assert.equal(confirmedSession.confirmation?.source, 'triadize');

    writeTriadizationArtifacts(paths);
    const stableSession = readTriadizationSession(paths);
    assert.ok(stableSession);
    assert.equal(stableSession.sessionId, confirmedSession.sessionId);
    assert.equal(stableSession.status, 'confirmed');
    assert.equal(stableSession.confirmation?.source, 'triadize');
});

test('renormalize command respects project generic contract ignore config', () => {
    const root = createTriadizeFixture([
        {
            nodeId: 'Alpha.execute',
            category: 'core',
            sourcePath: 'src/alpha.py',
            fission: {
                problem: 'Alpha stage',
                demand: ['Context (ctx)', 'dict[str, DataPacket] (inputs)'],
                answer: ['dict[str, DataPacket]']
            }
        },
        {
            nodeId: 'Beta.execute',
            category: 'core',
            sourcePath: 'src/beta.py',
            fission: {
                problem: 'Beta stage',
                demand: ['Context (ctx)', 'dict[str, DataPacket] (inputs)'],
                answer: ['dict[str, DataPacket]']
            }
        }
    ]);

    fs.writeFileSync(
        path.join(root, '.triadmind', 'config.json'),
        JSON.stringify(
            {
                parser: {
                    genericContractIgnoreList: ['context', 'dict[str,datapacket]']
                }
            },
            null,
            2
        ),
        'utf-8'
    );

    const result = runCli(root, ['renormalize']);
    assert.equal(result.status, 0, `renormalize failed: ${result.stderr || result.stdout}`);
    assert.match(result.stdout, /No cyclic dependencies found/i);
    assert.equal(fs.existsSync(path.join(root, '.triadmind', 'renormalize-protocol.json')), false);
});
