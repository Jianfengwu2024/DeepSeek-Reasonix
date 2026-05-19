"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPromptSection = createPromptSection;
exports.createCodeBlockSection = createCodeBlockSection;
exports.createJsonSection = createJsonSection;
exports.renderPromptBlocks = renderPromptBlocks;
exports.renderLabeledCodeBlockEntries = renderLabeledCodeBlockEntries;
function createPromptSection(title, lines) {
    return {
        title,
        lines: normalizePromptLines(lines)
    };
}
function createCodeBlockSection(title, content, language = '', fallback = '') {
    const normalizedContent = normalizePromptContent(content, fallback);
    const fence = language ? `\`\`\`${language}` : '```';
    return createPromptSection(title, [fence, normalizedContent, '```']);
}
function createJsonSection(title, content, fallback = '{}') {
    return createCodeBlockSection(title, content, 'json', fallback);
}
function renderPromptBlocks(blocks) {
    const renderedBlocks = blocks
        .map((block) => renderPromptBlock(block))
        .map((block) => block.trim())
        .filter(Boolean);
    return renderedBlocks.join('\n\n');
}
function renderLabeledCodeBlockEntries(entries, options) {
    if (entries.length === 0) {
        return options.emptyMessage;
    }
    const language = options.language ?? 'ts';
    return entries
        .map((entry) => [`[${entry.label}] ${entry.path}`, `\`\`\`${language}`, String(entry.content ?? '').trim(), '```'].join('\n'))
        .join('\n\n');
}
function renderPromptBlock(block) {
    if (typeof block === 'string') {
        return String(block ?? '');
    }
    return [`[${block.title}]`, ...block.lines].join('\n');
}
function normalizePromptLines(lines) {
    const values = Array.isArray(lines) ? lines : [lines];
    return values.map((line) => String(line ?? ''));
}
function normalizePromptContent(content, fallback) {
    const normalized = String(content ?? '').trim();
    return normalized || fallback;
}
//# sourceMappingURL=workflowPromptRenderSupport.js.map