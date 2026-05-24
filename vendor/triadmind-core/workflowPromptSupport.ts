import { parseJsonText, readChangedFilesArtifact, readTextIfExists } from './artifactReaders';
import { StageAnalysisResult } from './stage';
import {
    formatTriadizationFocusState,
    readTriadizationConfirmation,
    readTriadizationSession,
    resolveTriadizationFocusState,
    TriadizationFocusState,
    TriadizationReport
} from './triadization';
import { WorkspacePaths } from './workspace';
import { TriadizationFocusSeed } from './workflowRightBranch';
import { createJsonSection, createPromptSection } from './workflowPromptRenderSupport';

export type PromptTriadizationFocusContext = TriadizationFocusState;

export function safeRead(filePath: string) {
    return readTextIfExists(filePath, { trim: true });
}

export function safeParseJson<T>(content: string): T | undefined {
    return parseJsonText<T>(content);
}

export function readChangedFiles(paths: WorkspacePaths) {
    return readChangedFilesArtifact(paths.lastApplyFilesFile);
}

export function getTriadizationFocusSeed(report?: TriadizationReport): TriadizationFocusSeed | undefined {
    const state = resolveTriadizationFocusState({ report });
    if (!state) {
        return undefined;
    }

    return {
        triadizationFocus: state.triadizationFocus,
        recommendedOperation: state.recommendedOperation
    };
}

export function getTriadizationFocusSeedFromContext(
    context?: PromptTriadizationFocusContext
): TriadizationFocusSeed | undefined {
    if (!context) {
        return undefined;
    }

    return {
        triadizationFocus: context.triadizationFocus,
        recommendedOperation: context.recommendedOperation
    };
}

export function resolveTriadizationFocusContext(
    paths: WorkspacePaths,
    triadizationReportJson = safeRead(paths.triadizationReportFile)
) {
    const session = readTriadizationSession(paths);
    const report = safeParseJson<TriadizationReport>(triadizationReportJson);
    const confirmation = readTriadizationConfirmation(paths);
    return resolveTriadizationFocusState({
        session,
        report,
        confirmation
    });
}

export function buildTriadizationFocusSummaryLines(context?: PromptTriadizationFocusContext) {
    if (!context) {
        return ['状态：未检测到 triadization focus。', '请先运行 triadmind triadize，并确认当前顶点三元化焦点。'];
    }

    const exactFocus = formatTriadizationFocusState(context) ?? '';
    return [
        context.confirmed
            ? `状态：已确认（来源：${context.confirmationSource ?? 'unknown'}）`
            : '状态：主提案已生成，但尚未确认。',
        `焦点：${exactFocus}`,
        `诊断：${context.diagnosis.join(', ') || 'none'}`
    ];
}

export function createTriadizationFocusSummarySection(
    context?: PromptTriadizationFocusContext,
    title = 'Triadization Focus'
) {
    return createPromptSection(title, buildTriadizationFocusSummaryLines(context));
}

export function buildTriadizationFocusJson(context?: PromptTriadizationFocusContext) {
    if (!context) {
        return JSON.stringify(
            {
                sessionId: '',
                triadizationFocus: '',
                recommendedOperation: '',
                confirmed: false,
                diagnosis: []
            },
            null,
            2
        );
    }

    return JSON.stringify(
        {
            sessionId: context.sessionId ?? '',
            triadizationFocus: context.triadizationFocus,
            recommendedOperation: context.recommendedOperation,
            confirmed: context.confirmed,
            diagnosis: context.diagnosis
        },
        null,
        2
    );
}

export function createTriadizationFocusJsonSection(
    context?: PromptTriadizationFocusContext,
    title = 'Triadization Focus JSON'
) {
    return createJsonSection(title, buildTriadizationFocusJson(context));
}

export function buildTriadizationFocusRuleLines(context?: PromptTriadizationFocusContext) {
    if (!context) {
        return [
            '没有明确 triadization focus 时，不要擅自生成新的 Macro / Meso / Micro / Protocol 结果。',
            '先回到 triadization 对话，确认当前节点与 recommendedOperation。'
        ];
    }

    const exactFocus = `\`${context.triadizationFocus}\` -> \`${context.recommendedOperation}\``;
    const lines = [
        `后续 Macro / Meso / Micro / Protocol 必须显式引用当前 focus ${exactFocus}。`,
        `不得把焦点切换到其他节点，不得把动作从 \`${context.recommendedOperation}\` 静默改成别的操作。`,
        '如果发现必须切换节点或动作，先停止当前推演，返回 triadization 对话重新确认。'
    ];

    if (context.confirmed) {
        lines.push('由于该 focus 已确认，后续三轮拆分应把它当作本轮唯一有效演进主线。');
    } else {
        lines.push('由于该 focus 尚未确认，后续拆分只能作为围绕该主提案的候选方案，不能当作已批准事实。');
    }

    return lines;
}

export function createTriadizationFocusRuleSection(
    context?: PromptTriadizationFocusContext,
    title = 'Triadization Focus Rules'
) {
    return createPromptSection(title, buildTriadizationFocusRuleLines(context));
}

export function buildTriadizationFocusGateLines(stage: StageAnalysisResult) {
    const lines = [`status: ${stage.triadizationFocusGateStatus}`];

    if (stage.triadizationFocusGateKind) {
        lines.push(`failureKind: ${stage.triadizationFocusGateKind}`);
    }
    if (stage.triadizationFocusGateSummary) {
        lines.push(`summary: ${stage.triadizationFocusGateSummary}`);
    }
    if (stage.triadizationFocusGateRepairTarget) {
        lines.push(`repairTarget: ${stage.triadizationFocusGateRepairTarget}`);
    }

    stage.triadizationFocusGateDetails.slice(0, 4).forEach((detail, index) => {
        lines.push(`detail${index + 1}: ${detail}`);
    });

    return lines;
}

export function createTriadizationFocusGateSection(stage: StageAnalysisResult, title = 'Triadization Focus Gate') {
    return createPromptSection(title, buildTriadizationFocusGateLines(stage));
}

export function buildTriadizationFocusOutputLines(
    context: PromptTriadizationFocusContext | undefined,
    stageSpecificRule: string
) {
    const lines = ['输出 JSON 必须显式包含 `triadizationFocus` 与 `recommendedOperation`。', stageSpecificRule];
    if (!context) {
        lines.push('如果当前没有 focus，就保持这两个字段为空字符串，并先回到 triadization 诊断阶段。');
        return lines;
    }

    lines.push(`其中 \`triadizationFocus\` 必须等于 \`${context.triadizationFocus}\`。`);
    lines.push(`其中 \`recommendedOperation\` 必须等于 \`${context.recommendedOperation}\`。`);
    return lines;
}

export function createTriadizationFocusOutputSection(
    context: PromptTriadizationFocusContext | undefined,
    stageSpecificRule: string,
    title = 'Required Output Notes'
) {
    return createPromptSection(title, buildTriadizationFocusOutputLines(context, stageSpecificRule));
}
