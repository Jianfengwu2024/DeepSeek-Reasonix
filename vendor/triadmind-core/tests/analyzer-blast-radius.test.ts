import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBlastRadius, calculateDownstreamFanoutNodes } from '../analyzer';

test('calculateBlastRadius follows downstream producer-consumer chain for contract changes', () => {
    const nodes = [
        {
            nodeId: 'Source.execute',
            fission: {
                demand: [],
                answer: ['Alpha']
            }
        },
        {
            nodeId: 'Bridge.execute',
            fission: {
                demand: ['Alpha'],
                answer: ['Beta']
            }
        },
        {
            nodeId: 'Sink.execute',
            fission: {
                demand: ['Beta'],
                answer: ['Gamma']
            }
        }
    ];

    assert.deepEqual(calculateBlastRadius(nodes, 'Source.execute', true).sort(), ['Bridge.execute', 'Sink.execute']);
});

test('calculateBlastRadius returns empty when the change is not contractual or target is missing', () => {
    const nodes = [
        {
            nodeId: 'Source.execute',
            fission: {
                demand: [],
                answer: ['Alpha']
            }
        },
        {
            nodeId: 'Sink.execute',
            fission: {
                demand: ['Alpha'],
                answer: ['Beta']
            }
        }
    ];

    assert.deepEqual(calculateBlastRadius(nodes, 'Source.execute', false), []);
    assert.deepEqual(calculateBlastRadius(nodes, 'Missing.execute', true), []);
});

test('calculateBlastRadius respects generic contract filtering and avoids re-adding the target in cycles', () => {
    const cyclicNodes = [
        {
            nodeId: 'Source.execute',
            fission: {
                demand: ['Gamma'],
                answer: ['Alpha']
            }
        },
        {
            nodeId: 'Bridge.execute',
            fission: {
                demand: ['Alpha'],
                answer: ['Gamma']
            }
        }
    ];
    const genericNodes = [
        {
            nodeId: 'Source.execute',
            fission: {
                demand: [],
                answer: ['string']
            }
        },
        {
            nodeId: 'Sink.execute',
            fission: {
                demand: ['string'],
                answer: ['Done']
            }
        }
    ];

    assert.deepEqual(calculateBlastRadius(cyclicNodes, 'Source.execute', true), ['Bridge.execute']);
    assert.deepEqual(
        calculateBlastRadius(genericNodes, 'Source.execute', true, {
            ignoreGenericContracts: true
        }),
        []
    );
});

test('calculateBlastRadius ignores internal .triadmind artifact path contracts by default', () => {
    const nodes = [
        {
            nodeId: 'Workspace.module_pipeline',
            fission: {
                demand: ['string (projectRoot)'],
                answer: ['WorkspacePaths']
            }
        },
        {
            nodeId: 'Workflow.writePromptPacket',
            fission: {
                demand: ['WorkspacePaths', 'string (userDemand)'],
                answer: ['void']
            }
        }
    ];

    assert.deepEqual(calculateBlastRadius(nodes, 'Workspace.module_pipeline', true), []);
});

test('calculateDownstreamFanoutNodes ignores internal .triadmind artifact path contracts by default', () => {
    const nodes = [
        {
            nodeId: 'Workspace.module_pipeline',
            fission: {
                demand: ['string (projectRoot)'],
                answer: ['WorkspacePaths']
            }
        },
        {
            nodeId: 'Workflow.writePromptPacket',
            fission: {
                demand: ['WorkspacePaths'],
                answer: ['PromptPacket']
            }
        },
        {
            nodeId: 'Workflow.writeRuntimeArtifacts',
            fission: {
                demand: ['WorkspacePaths'],
                answer: ['RuntimeArtifactPaths']
            }
        }
    ];

    assert.deepEqual(calculateDownstreamFanoutNodes(nodes, 1), []);
});
