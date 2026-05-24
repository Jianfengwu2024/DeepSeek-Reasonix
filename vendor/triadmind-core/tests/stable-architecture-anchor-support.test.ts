import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEffectiveStableAnchorsFromSources } from '../stableArchitectureAnchorSupport';

test('stable anchor resolver merges config anchors with feedback-ledger declarations', () => {
    const resolved = resolveEffectiveStableAnchorsFromSources({
        configTopologyRisk: {
            matureStableNodeIds: ['ConfiguredCore.execute'],
            matureStableNodePatterns: ['^ConfiguredCore\\.'],
            matureStableSourcePaths: ['src/configured/core.ts'],
            matureStableSourcePathPatterns: ['src/configured/**']
        },
        feedbackLedger: {
            schemaVersion: '1.0',
            project: 'resolver-test',
            rejections: [
                {
                    decisionId: 'feedback-1',
                    decision: 'reject',
                    proposalId: 'DREAM_SPLIT_HIGH_FANOUT_1',
                    proposalFamily: 'DREAM_SPLIT_HIGH_FANOUT',
                    proposalSignature: 'signature-1',
                    proposalTitle: 'Keep legacy workflow stable',
                    sourcePath: 'src/legacy/workflow.ts',
                    targetNodeIds: ['LegacyWorkflow.execute'],
                    linkedFindings: [],
                    reason: 'Stable legacy gravity center',
                    reviewer: 'maintainer',
                    reviewerRole: 'maintainer',
                    recordedAt: '2026-05-08T10:00:00.000Z',
                    stableAnchorRecorded: true
                },
                {
                    decisionId: 'feedback-2',
                    decision: 'reject',
                    proposalId: 'DREAM_SPLIT_HIGH_FANOUT_2',
                    proposalFamily: 'DREAM_SPLIT_HIGH_FANOUT',
                    proposalSignature: 'signature-2',
                    proposalTitle: 'Keep runtime gateway stable',
                    sourcePath: 'src/runtime/gateway.ts',
                    targetNodeIds: ['RuntimeGateway.execute'],
                    linkedFindings: [],
                    reason: 'Stable runtime gateway',
                    reasonCode: 'stable_core_module',
                    reviewer: 'maintainer',
                    reviewerRole: 'maintainer',
                    recordedAt: '2026-05-08T11:00:00.000Z'
                }
            ]
        }
    });

    assert.deepEqual(resolved.matureStableNodeIds, [
        'ConfiguredCore.execute',
        'LegacyWorkflow.execute',
        'RuntimeGateway.execute'
    ]);
    assert.deepEqual(resolved.matureStableNodePatterns, ['^ConfiguredCore\\.']);
    assert.deepEqual(resolved.matureStableSourcePaths, [
        'src/configured/core.ts',
        'src/legacy/workflow.ts',
        'src/runtime/gateway.ts'
    ]);
    assert.deepEqual(resolved.matureStableSourcePathPatterns, ['src/configured/**']);
    assert.equal(resolved.entries.some((entry) => entry.source === 'feedback' && entry.value === 'LegacyWorkflow.execute'), true);
    assert.equal(resolved.entries.some((entry) => entry.source === 'feedback' && entry.value === 'src/runtime/gateway.ts'), true);
});
