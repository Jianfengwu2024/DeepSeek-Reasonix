export interface PromptSection {
    title: string;
    lines: string[];
}

export type PromptBlock = PromptSection | string;

export function createPromptSection(title: string, lines: string | string[]): PromptSection {
    return {
        title,
        lines: normalizePromptLines(lines)
    };
}

export function createCodeBlockSection(
    title: string,
    content: string | undefined,
    language = '',
    fallback = ''
): PromptSection {
    const normalizedContent = normalizePromptContent(content, fallback);
    const fence = language ? `\`\`\`${language}` : '```';
    return createPromptSection(title, [fence, normalizedContent, '```']);
}

export function createJsonSection(title: string, content: string | undefined, fallback = '{}'): PromptSection {
    return createCodeBlockSection(title, content, 'json', fallback);
}

export function renderPromptBlocks(blocks: PromptBlock[]) {
    const renderedBlocks = blocks
        .map((block) => renderPromptBlock(block))
        .map((block) => block.trim())
        .filter(Boolean);

    return renderedBlocks.join('\n\n');
}

export function renderLabeledCodeBlockEntries(
    entries: Array<{ label: string; path: string; content: string }>,
    options: { emptyMessage: string; language?: string }
) {
    if (entries.length === 0) {
        return options.emptyMessage;
    }

    const language = options.language ?? 'ts';
    return entries
        .map((entry) =>
            [`[${entry.label}] ${entry.path}`, `\`\`\`${language}`, String(entry.content ?? '').trim(), '```'].join('\n')
        )
        .join('\n\n');
}

function renderPromptBlock(block: PromptBlock) {
    if (typeof block === 'string') {
        return String(block ?? '');
    }

    return [`[${block.title}]`, ...block.lines].join('\n');
}

function normalizePromptLines(lines: string | string[]) {
    const values = Array.isArray(lines) ? lines : [lines];
    return values.map((line) => String(line ?? ''));
}

function normalizePromptContent(content: string | undefined, fallback: string) {
    const normalized = String(content ?? '').trim();
    return normalized || fallback;
}
