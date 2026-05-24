import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    collectTriadizationFocusReference,
    createTriadizationFocusSeed,
    resolveExpectedTriadizationFocus,
    resolvePrimaryTriadizationFocusReference
} from '../triadizationFocusSupport';
import { ensureTriadSpec } from '../workflow';
import { getWorkspacePaths } from '../workspace';
import { writeTriadizationArtifacts, writeTriadizationConfirmation } from '../triadization';

function createFocusWorkspace() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-focus-support-'));
    const paths = getWorkspacePaths(root);
    ensureTriadSpec(paths, true);
    fs.mkdirSync(paths.triadDir, { recursive: true });
    fs.writeFileSync(
        paths.mapFile,
        JSON.stringify(
            [
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
            ],
            null,
            2
        ),
        'utf-8'
    );
    return paths;
}

test('createTriadizationFocusSeed normalizes placeholders without forcing protocol-only enum values', () => {
    assert.deepEqual(createTriadizationFocusSeed(), {
        triadizationFocus: '',
        recommendedOperation: ''
    });
    assert.deepEqual(
        createTriadizationFocusSeed({
            triadizationFocus: ' Workflow.execute ',
            recommendedOperation: ' Split '
        }),
        {
            triadizationFocus: 'Workflow.execute',
            recommendedOperation: 'split'
        }
    );
});

test('collectTriadizationFocusReference and canonical resolver prefer the most concrete micro focus', () => {
    const focusReferences: Array<{
        source: string;
        triadizationFocus: string;
        recommendedOperation: string;
    }> = [];
    const violations: string[] = [];

    collectTriadizationFocusReference(
        'draft-protocol.json macroSplit',
        {
            triadizationFocus: 'Workflow.execute',
            recommendedOperation: 'split',
            anchorNodeId: 'Workflow.execute'
        },
        focusReferences,
        violations
    );
    collectTriadizationFocusReference(
        'micro-split.json',
        {
            triadizationFocus: 'Workflow.execute',
            recommendedOperation: 'split',
            classes: [{ className: 'Workflow' }]
        },
        focusReferences,
        violations
    );
    collectTriadizationFocusReference(
        'draft-protocol.json microSplit',
        {
            triadizationFocus: 'Workflow.execute',
            recommendedOperation: 'split',
            classes: [{ className: 'Workflow' }]
        },
        focusReferences,
        violations
    );

    assert.deepEqual(violations, []);
    assert.deepEqual(resolvePrimaryTriadizationFocusReference(focusReferences), {
        source: 'draft-protocol.json microSplit',
        triadizationFocus: 'Workflow.execute',
        recommendedOperation: 'split'
    });
});

test('resolveExpectedTriadizationFocus only exposes confirmed triadization focus', () => {
    const paths = createFocusWorkspace();

    const report = writeTriadizationArtifacts(paths);
    assert.equal(resolveExpectedTriadizationFocus(paths), undefined);

    writeTriadizationConfirmation(paths, report, 'triadize');
    assert.deepEqual(resolveExpectedTriadizationFocus(paths), {
        triadizationFocus: 'Workflow.execute',
        recommendedOperation: 'split'
    });
});
