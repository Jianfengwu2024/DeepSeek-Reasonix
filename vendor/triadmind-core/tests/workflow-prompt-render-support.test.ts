import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createJsonSection,
    createPromptSection,
    renderLabeledCodeBlockEntries,
    renderPromptBlocks
} from '../workflowPromptRenderSupport';

test('renderPromptBlocks keeps section structure and raw blocks in one document pipeline', () => {
    const prompt = renderPromptBlocks([
        createPromptSection('System', ['line 1', 'line 2']),
        'RAW BLOCK',
        createJsonSection('Payload', '{"ok":true}')
    ]);

    assert.match(prompt, /\[System\]\nline 1\nline 2/);
    assert.match(prompt, /RAW BLOCK/);
    assert.match(prompt, /\[Payload\]\n```json\n{"ok":true}\n```/);
});

test('renderLabeledCodeBlockEntries falls back cleanly when there are no snippets', () => {
    const empty = renderLabeledCodeBlockEntries([], {
        emptyMessage: 'no snippets',
        language: 'ts'
    });
    assert.equal(empty, 'no snippets');

    const populated = renderLabeledCodeBlockEntries(
        [{ label: 'Skeleton File', path: 'src/workflow.ts', content: 'export {};\n' }],
        {
            emptyMessage: 'no snippets',
            language: 'ts'
        }
    );
    assert.match(populated, /\[Skeleton File\] src\/workflow\.ts/);
    assert.match(populated, /```ts\nexport \{\};\n```/);
});
