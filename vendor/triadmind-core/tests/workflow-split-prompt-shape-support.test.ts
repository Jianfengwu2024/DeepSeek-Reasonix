import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkflowSplitPromptShape } from '../workflowSplitPromptShapeSupport';
import { getWorkspacePaths } from '../workflow';

test('generic split prompt shape builder aligns input output paths by stage', () => {
    const paths = getWorkspacePaths('D:\\TraidMind\\triadmind-core');

    const macroPrompt = buildWorkflowSplitPromptShape('macro', paths, 'Refine workflow triadization');
    const mesoPrompt = buildWorkflowSplitPromptShape('meso', paths, 'Refine workflow triadization');
    const microPrompt = buildWorkflowSplitPromptShape('micro', paths, 'Refine workflow triadization');

    assert.match(macroPrompt, /\[Pass 1: Macro-Split\]/);
    assert.doesNotMatch(macroPrompt, /输入文件：/);
    assert.match(macroPrompt, /输出文件：D:\/TraidMind\/triadmind-core\/\.triadmind\/macro-split\.json/);

    assert.match(mesoPrompt, /输入文件：D:\/TraidMind\/triadmind-core\/\.triadmind\/macro-split\.json/);
    assert.match(mesoPrompt, /输出文件：D:\/TraidMind\/triadmind-core\/\.triadmind\/meso-split\.json/);

    assert.match(microPrompt, /输入文件：D:\/TraidMind\/triadmind-core\/\.triadmind\/meso-split\.json/);
    assert.match(microPrompt, /输出文件：D:\/TraidMind\/triadmind-core\/\.triadmind\/micro-split\.json/);
    assert.match(microPrompt, /"triadizationFocus":""/);
});
