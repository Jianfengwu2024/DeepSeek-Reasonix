import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildSplitArtifactShapeJson,
    createDraftProtocolTemplateSeed,
    createMacroSplitSeedRecord,
    createMesoSplitSeedRecord,
    createMicroSplitSeedRecord
} from '../triadizationSplitArtifactSupport';

test('draft protocol template seed reuses canonical split seed constructors', () => {
    const template = createDraftProtocolTemplateSeed('D:\\TraidMind\\triadmind-core', 'D:\\TraidMind\\triadmind-core\\.triadmind\\triad-map.json', 'Refine workflow triadization');

    assert.equal(template.project, 'D:/TraidMind/triadmind-core');
    assert.equal(template.mapSource, 'D:/TraidMind/triadmind-core/.triadmind/triad-map.json');
    assert.equal(template.userDemand, 'Refine workflow triadization');
    assert.deepEqual(template.macroSplit, createMacroSplitSeedRecord(''));
    assert.deepEqual(template.mesoSplit, createMesoSplitSeedRecord());
    assert.deepEqual(template.microSplit, createMicroSplitSeedRecord());
    assert.deepEqual(template.upgradePolicy.allowedOps, ['reuse', 'modify', 'create_child']);
});

test('split artifact shape json stays aligned with blank seed structures', () => {
    assert.equal(buildSplitArtifactShapeJson('macro'), JSON.stringify(createMacroSplitSeedRecord('')));
    assert.equal(buildSplitArtifactShapeJson('meso'), JSON.stringify(createMesoSplitSeedRecord()));
    assert.equal(buildSplitArtifactShapeJson('micro'), JSON.stringify(createMicroSplitSeedRecord()));
});
