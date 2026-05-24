import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { classifyImpactTier, filterNodesForImpactThreshold, filterNodesToImpactScope, loadImpactTierSummary } from '../impactTierSupport';

function createPaths(protocol: unknown) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-impact-tier-'));
    const triadDir = path.join(root, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });
    const impactProtocolFile = path.join(triadDir, 'impact-protocol.json');
    fs.writeFileSync(impactProtocolFile, JSON.stringify(protocol, null, 2), 'utf-8');
    return {
        impactProtocolFile,
        dreamFeedbackFile: path.join(triadDir, 'dream-feedback.json')
    };
}

const baseConfig = {
    impactTiers: {
        shortChainMax: 2,
        mediumChainMax: 5,
        forceTier: {}
    },
    topologyRisk: {
        matureStableNodeIds: [],
        matureStableNodePatterns: [],
        matureStableSourcePaths: [],
        matureStableSourcePathPatterns: []
    }
};

test('impact tier classification follows configured chain thresholds', () => {
    assert.equal(classifyImpactTier(2, baseConfig.impactTiers), 'exempt');
    assert.equal(classifyImpactTier(3, baseConfig.impactTiers), 'advisory');
    assert.equal(classifyImpactTier(6, baseConfig.impactTiers), 'strict');
});

test('impact summary parses impactedNodes variants and stable anchors override tier', () => {
    const paths = createPaths({
        impactedNodes: [
            { nodeId: 'Utility.format', edgeCount: 1 },
            { nodeId: 'Flow.orchestrate', path: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
            { nodeId: 'Stable.core', hops: 8 }
        ]
    });
    const config = {
        ...baseConfig,
        topologyRisk: {
            ...baseConfig.topologyRisk,
            matureStableNodeIds: ['Stable.core']
        }
    };
    const nodes = [
        { nodeId: 'Utility.format', sourcePath: 'src/utility.ts' },
        { nodeId: 'Flow.orchestrate', sourcePath: 'src/flow.ts' },
        { nodeId: 'Stable.core', sourcePath: 'src/stable.ts' }
    ];

    const summary = loadImpactTierSummary(paths, nodes, config);

    assert.equal(summary.available, true);
    assert.equal(summary.entries.find((entry) => entry.nodeId === 'Utility.format')?.tier, 'exempt');
    assert.equal(summary.entries.find((entry) => entry.nodeId === 'Flow.orchestrate')?.tier, 'strict');
    assert.equal(summary.entries.find((entry) => entry.nodeId === 'Stable.core')?.tier, 'exempt');
    assert.equal(summary.entries.find((entry) => entry.nodeId === 'Stable.core')?.stableAnchor, true);
});

test('impact filters keep strict chains for verify and thresholded dream scans', () => {
    const paths = createPaths({
        impactedNodes: [
            { nodeId: 'Utility.format', edgeCount: 1 },
            { nodeId: 'Service.plan', edgeCount: 4 },
            { nodeId: 'Core.orchestrate', edgeCount: 7 }
        ]
    });
    const nodes = [
        { nodeId: 'Utility.format', sourcePath: 'src/utility.ts' },
        { nodeId: 'Service.plan', sourcePath: 'src/service.ts' },
        { nodeId: 'Core.orchestrate', sourcePath: 'src/core.ts' },
        { nodeId: 'Outside.skip', sourcePath: 'src/outside.ts' }
    ];
    const summary = loadImpactTierSummary(paths, nodes, baseConfig);

    assert.deepEqual(filterNodesForImpactThreshold(nodes, summary, 3).map((node) => node.nodeId), [
        'Service.plan',
        'Core.orchestrate'
    ]);
    assert.deepEqual(
        filterNodesToImpactScope(nodes, summary, { includeAdvisory: false, includeStrict: true }).map((node) => node.nodeId),
        ['Core.orchestrate']
    );
});
