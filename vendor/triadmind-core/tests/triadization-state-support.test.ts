import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildTriadizationConfirmationMessage,
    formatTriadizationFocusState,
    readPrimaryTriadizationProposalSummary,
    resolveTriadizationFocusState
} from '../triadizationStateSupport';

test('resolveTriadizationFocusState prefers session over report and preserves confirmation source', () => {
    const state = resolveTriadizationFocusState({
        session: {
            sessionId: 'triadization-split-workflow',
            proposalId: 'split:Workflow.execute',
            triadizationFocus: 'Workflow.execute',
            recommendedOperation: 'split',
            diagnosis: ['overloaded_vertex', 'left_right_mixing'],
            status: 'confirmed',
            confirmation: {
                confirmedAt: '2026-05-08T00:00:00.000Z',
                source: 'plan'
            }
        },
        report: {
            primaryProposal: {
                proposalId: 'aggregate:Planner.build|Planner.resolve|Planner.collect',
                targetNodeId: 'Planner@src/planner.ts',
                recommendedOperation: 'aggregate',
                diagnosis: ['capability_fragmented']
            }
        }
    });

    assert.deepEqual(state, {
        sessionId: 'triadization-split-workflow',
        proposalId: 'split:Workflow.execute',
        triadizationFocus: 'Workflow.execute',
        recommendedOperation: 'split',
        diagnosis: ['overloaded_vertex', 'left_right_mixing'],
        confirmed: true,
        confirmationSource: 'plan'
    });
});

test('triadization state support resolves report plus legacy confirmation and formats focus consistently', () => {
    const report = {
        primaryProposal: {
            proposalId: 'split:Workflow.execute',
            targetNodeId: 'Workflow.execute',
            recommendedOperation: 'split',
            diagnosis: ['overloaded_vertex', 'left_right_mixing']
        }
    };

    const proposal = readPrimaryTriadizationProposalSummary(report);
    const state = resolveTriadizationFocusState({
        report,
        confirmation: {
            proposalId: 'split:Workflow.execute',
            source: 'triadize'
        }
    });

    assert.deepEqual(proposal, {
        proposalId: 'split:Workflow.execute',
        targetNodeId: 'Workflow.execute',
        recommendedOperation: 'split',
        diagnosis: ['overloaded_vertex', 'left_right_mixing']
    });
    assert.equal(formatTriadizationFocusState(state), 'Workflow.execute -> split');
    assert.equal(
        buildTriadizationConfirmationMessage(report),
        'Confirm this evolution first: Workflow.execute -> split (overloaded_vertex, left_right_mixing). Continue after confirmation?'
    );
    assert.equal(state?.confirmed, true);
    assert.equal(state?.confirmationSource, 'triadize');
});
