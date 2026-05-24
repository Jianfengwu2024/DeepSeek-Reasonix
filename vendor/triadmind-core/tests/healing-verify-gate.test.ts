import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { prepareHealingArtifacts } from '../healing';
import { getWorkspacePaths } from '../workspace';

function createHealingFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'triadmind-heal-verify-'));
    const triadDir = path.join(root, '.triadmind');
    fs.mkdirSync(triadDir, { recursive: true });
    fs.writeFileSync(
        path.join(triadDir, 'config.json'),
        JSON.stringify(
            {
                architecture: { language: 'typescript' },
                runtimeHealing: {
                    maxAutoRetries: 2,
                    requireHumanApprovalForContractChanges: true
                }
            },
            null,
            2
        ),
        'utf-8'
    );
    fs.writeFileSync(path.join(triadDir, 'triad-spec.json'), JSON.stringify({ version: 1 }, null, 2), 'utf-8');
    fs.writeFileSync(
        path.join(triadDir, 'triad-map.json'),
        JSON.stringify(
            [
                {
                    nodeId: 'CameraCalibrationPage.render',
                    category: 'frontend',
                    sourcePath: 'frontend/src/app/dashboard/workflows/designer/camera-calibration/page.tsx',
                    fission: {
                        problem: 'Render camera calibration page',
                        demand: ['CalibrationState'],
                        answer: ['CalibrationView']
                    }
                }
            ],
            null,
            2
        ),
        'utf-8'
    );
    return getWorkspacePaths(root);
}

test('heal parses verify gate failures into actionable topology remediation', () => {
    const paths = createHealingFixture();
    const verifyReport = {
        passed: false,
        checks: [
            {
                key: 'zero_abstraction_hotspot_count',
                status: 'fail',
                expected: 0,
                actual: 1,
                detail: 'Abstraction hotspots: frontend/src/app/dashboard/workflows/designer/camera-calibration/page.tsx (no abstraction signals detected in a concrete-heavy module)',
                remediation: ['Move calibration page orchestration into state, command, and view slices.']
            }
        ]
    };

    const { diagnosis } = prepareHealingArtifacts(paths, JSON.stringify(verifyReport, null, 2));

    assert.equal(diagnosis.diagnosis, 'topology');
    assert.equal(diagnosis.matchedNodeId, 'CameraCalibrationPage.render');
    assert.equal(diagnosis.gateFailures?.[0]?.key, 'zero_abstraction_hotspot_count');
    assert.match(diagnosis.remediation?.join('\n') ?? '', /state, commands?, and view|state, command, and view/i);
    assert.equal(fs.existsSync(paths.healingReportFile), true);
    assert.equal(fs.existsSync(paths.healingPromptFile), true);
});
