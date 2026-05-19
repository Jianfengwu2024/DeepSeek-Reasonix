export interface PromptSection {
    title: string;
    lines: string[];
}
export type PromptBlock = PromptSection | string;
export declare function createPromptSection(title: string, lines: string | string[]): PromptSection;
export declare function createCodeBlockSection(title: string, content: string | undefined, language?: string, fallback?: string): PromptSection;
export declare function createJsonSection(title: string, content: string | undefined, fallback?: string): PromptSection;
export declare function renderPromptBlocks(blocks: PromptBlock[]): string;
export declare function renderLabeledCodeBlockEntries(entries: Array<{
    label: string;
    path: string;
    content: string;
}>, options: {
    emptyMessage: string;
    language?: string;
}): string;
