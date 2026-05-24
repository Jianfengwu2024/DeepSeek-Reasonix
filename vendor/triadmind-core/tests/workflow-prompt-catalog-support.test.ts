import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildTriadSpecDocumentTemplate,
    getWorkflowPromptPolicyLines,
    getWorkflowSplitStageRequiredOutputRule
} from '../workflowPromptCatalogSupport';

test('workflow prompt policy catalog exposes canonical line groups', () => {
    const protocolRules = getWorkflowPromptPolicyLines('protocolOutputContract');
    const implementationRules = getWorkflowPromptPolicyLines('implementationOutputRules');

    assert.match(protocolRules.join('\n'), /macroSplit/);
    assert.match(protocolRules.join('\n'), /create_child/);
    assert.match(implementationRules.join('\n'), /draft-protocol\.json/);
    assert.match(getWorkflowSplitStageRequiredOutputRule('micro'), /同一 triadization focus/);
});

test('triad spec template keeps triad method sections and topology constraints together', () => {
    const document = buildTriadSpecDocumentTemplate('triadmind-core');

    assert.match(document, /项目 triadmind-core 生成“拓扑升级协议”/);
    assert.match(document, /Macro-Split（宏观寻址）/);
    assert.match(document, /Meso-Split（中观裂变）/);
    assert.match(document, /Micro-Split（微观具象化）/);
    assert.match(document, /create_child 必须说明 parentNodeId/);
    assert.match(document, /ClassName\.methodName/);
});
