import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    buildImplementationPrompt,
    buildMacroPrompt,
    buildMasterPrompt,
    buildMesoPrompt,
    buildMicroPrompt,
    buildPipelinePrompt,
    buildProtocolPrompt,
    ensureTriadSpec,
    getWorkspacePaths,
    writePromptPacket
} from '../workflow';
import { writeTriadizationArtifacts, writeTriadizationConfirmation } from '../triadization';

function createWorkflowPromptFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-workflow-prompt-'));
    const paths = getWorkspacePaths(root);
    ensureTriadSpec(paths, true);

    const map = [
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
    ];

    fs.mkdirSync(paths.triadDir, { recursive: true });
    fs.writeFileSync(paths.mapFile, JSON.stringify(map, null, 2), 'utf-8');
    const report = writeTriadizationArtifacts(paths);
    writeTriadizationConfirmation(paths, report, 'triadize');

    return { root, paths };
}

function createFocusedDraftProtocol() {
    return {
        protocolVersion: '1.0',
        project: 'prompt-test',
        mapSource: '.triadmind/triad-map.json',
        userDemand: 'Refine workflow triadization',
        macroSplit: {
            triadizationFocus: 'Workflow.execute',
            recommendedOperation: 'split',
            anchorNodeId: 'Workflow.execute',
            vertexGoal: 'Split workflow orchestration into explicit branches.',
            leftBranch: ['Workflow.execute'],
            rightBranch: ['WorkflowConfig']
        },
        mesoSplit: {
            triadizationFocus: 'Workflow.execute',
            recommendedOperation: 'split',
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
            triadizationFocus: 'Workflow.execute',
            recommendedOperation: 'split',
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

function createDriftingMicroSplit() {
    return {
        triadizationFocus: 'Planner.aggregate',
        recommendedOperation: 'aggregate',
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
    };
}

test('protocol, pipeline, and implementation prompts bind planning to the confirmed triadization session', () => {
    const { paths } = createWorkflowPromptFixture();
    const demand = 'Refine workflow triadization';

    const protocolPrompt = buildProtocolPrompt(paths, demand);
    const pipelinePrompt = buildPipelinePrompt(paths, demand);
    const implementationPrompt = buildImplementationPrompt(paths, demand);

    for (const prompt of [protocolPrompt, pipelinePrompt, implementationPrompt]) {
        assert.match(prompt, /Workflow\.execute -> split/);
        assert.match(prompt, /\[Triadization Focus Gate\]/);
        assert.match(prompt, /status: skip/);
        assert.match(prompt, /Triadization Session JSON/);
    }

    assert.match(protocolPrompt, /Project Abstraction Toolkit Workflow/);
    assert.match(protocolPrompt, /Project Abstraction Toolkit Matches JSON/);
    assert.match(protocolPrompt, /Triadization Focus JSON/);
    assert.match(pipelinePrompt, /triadizationFocus/);
    assert.match(implementationPrompt, /recommendedOperation/);
    assert.match(implementationPrompt, /Project Abstraction Toolkit Workflow/);
    assert.match(implementationPrompt, /Project Abstraction Toolkit Matches JSON/);
    assert.match(implementationPrompt, /Abstraction Memory Workflow/);
    assert.match(implementationPrompt, /Abstraction Memory Recommendations JSON/);
    assert.match(implementationPrompt, /Protocol Seed Action Candidates JSON/);
});

test('writePromptPacket seeds split artifacts and keeps triadization session metadata aligned', () => {
    const { paths } = createWorkflowPromptFixture();
    const demand = 'Refine workflow triadization';

    writePromptPacket(paths, demand);

    const macroSeed = JSON.parse(fs.readFileSync(paths.macroSplitFile, 'utf-8'));
    const mesoSeed = JSON.parse(fs.readFileSync(paths.mesoSplitFile, 'utf-8'));
    const microSeed = JSON.parse(fs.readFileSync(paths.microSplitFile, 'utf-8'));
    const triadizationSession = JSON.parse(fs.readFileSync(paths.triadizationSessionFile, 'utf-8'));

    for (const seed of [macroSeed, mesoSeed, microSeed]) {
        assert.equal(seed.triadizationFocus, 'Workflow.execute');
        assert.equal(seed.recommendedOperation, 'split');
    }

    assert.equal(triadizationSession.triadizationFocus, 'Workflow.execute');
    assert.equal(triadizationSession.recommendedOperation, 'split');
    assert.equal(triadizationSession.status, 'confirmed');

    const macroPrompt = buildMacroPrompt(paths, demand);
    const mesoPrompt = buildMesoPrompt(paths, demand);
    const microPrompt = buildMicroPrompt(paths, demand);

    for (const prompt of [macroPrompt, mesoPrompt, microPrompt]) {
        assert.match(prompt, /Workflow\.execute -> split/);
        assert.match(prompt, /triadizationFocus/);
        assert.match(prompt, /recommendedOperation/);
    }

    assert.match(macroPrompt, /"triadizationFocus":""/);
    assert.match(mesoPrompt, /"triadizationFocus":""/);
    assert.match(microPrompt, /"triadizationFocus":""/);
});

test('master prompt surfaces focus-gate diagnosis, repair target, and triadization session context', () => {
    const { paths } = createWorkflowPromptFixture();
    const demand = 'Refine workflow triadization';

    fs.writeFileSync(paths.demandFile, demand, 'utf-8');
    fs.writeFileSync(paths.draftFile, JSON.stringify(createFocusedDraftProtocol(), null, 2), 'utf-8');
    fs.writeFileSync(paths.microSplitFile, JSON.stringify(createDriftingMicroSplit(), null, 2), 'utf-8');

    const masterPrompt = buildMasterPrompt(paths);

    assert.match(masterPrompt, /\[Current Stage\]/);
    assert.match(masterPrompt, /protocol_focus_alignment/);
    assert.match(masterPrompt, /\[Triadization Focus Gate\]/);
    assert.match(masterPrompt, /\[Triadization Session JSON\]/);
    assert.match(masterPrompt, /status: fail/);
    assert.match(masterPrompt, /failureKind: protocol_focus_alignment/);
    assert.match(masterPrompt, /repairTarget: Workflow\.execute -> split/);
    assert.match(masterPrompt, /Project Abstraction Toolkit Workflow/);
    assert.match(masterPrompt, /Project Abstraction Toolkit Matches JSON/);
    assert.match(masterPrompt, /Abstraction Memory Matches JSON/);
    assert.match(masterPrompt, /Abstraction Memory Recommendations JSON/);
    assert.match(masterPrompt, /Protocol Seed Action Candidates JSON/);
});
