"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeRead = safeRead;
exports.safeParseJson = safeParseJson;
exports.readChangedFiles = readChangedFiles;
exports.getTriadizationFocusSeed = getTriadizationFocusSeed;
exports.getTriadizationFocusSeedFromContext = getTriadizationFocusSeedFromContext;
exports.resolveTriadizationFocusContext = resolveTriadizationFocusContext;
exports.buildTriadizationFocusSummaryLines = buildTriadizationFocusSummaryLines;
exports.createTriadizationFocusSummarySection = createTriadizationFocusSummarySection;
exports.buildTriadizationFocusJson = buildTriadizationFocusJson;
exports.createTriadizationFocusJsonSection = createTriadizationFocusJsonSection;
exports.buildTriadizationFocusRuleLines = buildTriadizationFocusRuleLines;
exports.createTriadizationFocusRuleSection = createTriadizationFocusRuleSection;
exports.buildTriadizationFocusGateLines = buildTriadizationFocusGateLines;
exports.createTriadizationFocusGateSection = createTriadizationFocusGateSection;
exports.buildTriadizationFocusOutputLines = buildTriadizationFocusOutputLines;
exports.createTriadizationFocusOutputSection = createTriadizationFocusOutputSection;
const artifactReaders_1 = require("./artifactReaders");
const triadization_1 = require("./triadization");
const workflowPromptRenderSupport_1 = require("./workflowPromptRenderSupport");
function safeRead(filePath) {
    return (0, artifactReaders_1.readTextIfExists)(filePath, { trim: true });
}
function safeParseJson(content) {
    return (0, artifactReaders_1.parseJsonText)(content);
}
function readChangedFiles(paths) {
    return (0, artifactReaders_1.readChangedFilesArtifact)(paths.lastApplyFilesFile);
}
function getTriadizationFocusSeed(report) {
    const state = (0, triadization_1.resolveTriadizationFocusState)({ report });
    if (!state) {
        return undefined;
    }
    return {
        triadizationFocus: state.triadizationFocus,
        recommendedOperation: state.recommendedOperation
    };
}
function getTriadizationFocusSeedFromContext(context) {
    if (!context) {
        return undefined;
    }
    return {
        triadizationFocus: context.triadizationFocus,
        recommendedOperation: context.recommendedOperation
    };
}
function resolveTriadizationFocusContext(paths, triadizationReportJson = safeRead(paths.triadizationReportFile)) {
    const session = (0, triadization_1.readTriadizationSession)(paths);
    const report = safeParseJson(triadizationReportJson);
    const confirmation = (0, triadization_1.readTriadizationConfirmation)(paths);
    return (0, triadization_1.resolveTriadizationFocusState)({
        session,
        report,
        confirmation
    });
}
function buildTriadizationFocusSummaryLines(context) {
    if (!context) {
        return ['状态：未检测到 triadization focus。', '请先运行 triadmind triadize，并确认当前顶点三元化焦点。'];
    }
    const exactFocus = (0, triadization_1.formatTriadizationFocusState)(context) ?? '';
    return [
        context.confirmed
            ? `状态：已确认（来源：${context.confirmationSource ?? 'unknown'}）`
            : '状态：主提案已生成，但尚未确认。',
        `焦点：${exactFocus}`,
        `诊断：${context.diagnosis.join(', ') || 'none'}`
    ];
}
function createTriadizationFocusSummarySection(context, title = 'Triadization Focus') {
    return (0, workflowPromptRenderSupport_1.createPromptSection)(title, buildTriadizationFocusSummaryLines(context));
}
function buildTriadizationFocusJson(context) {
    if (!context) {
        return JSON.stringify({
            sessionId: '',
            triadizationFocus: '',
            recommendedOperation: '',
            confirmed: false,
            diagnosis: []
        }, null, 2);
    }
    return JSON.stringify({
        sessionId: context.sessionId ?? '',
        triadizationFocus: context.triadizationFocus,
        recommendedOperation: context.recommendedOperation,
        confirmed: context.confirmed,
        diagnosis: context.diagnosis
    }, null, 2);
}
function createTriadizationFocusJsonSection(context, title = 'Triadization Focus JSON') {
    return (0, workflowPromptRenderSupport_1.createJsonSection)(title, buildTriadizationFocusJson(context));
}
function buildTriadizationFocusRuleLines(context) {
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
    }
    else {
        lines.push('由于该 focus 尚未确认，后续拆分只能作为围绕该主提案的候选方案，不能当作已批准事实。');
    }
    return lines;
}
function createTriadizationFocusRuleSection(context, title = 'Triadization Focus Rules') {
    return (0, workflowPromptRenderSupport_1.createPromptSection)(title, buildTriadizationFocusRuleLines(context));
}
function buildTriadizationFocusGateLines(stage) {
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
function createTriadizationFocusGateSection(stage, title = 'Triadization Focus Gate') {
    return (0, workflowPromptRenderSupport_1.createPromptSection)(title, buildTriadizationFocusGateLines(stage));
}
function buildTriadizationFocusOutputLines(context, stageSpecificRule) {
    const lines = ['输出 JSON 必须显式包含 `triadizationFocus` 与 `recommendedOperation`。', stageSpecificRule];
    if (!context) {
        lines.push('如果当前没有 focus，就保持这两个字段为空字符串，并先回到 triadization 诊断阶段。');
        return lines;
    }
    lines.push(`其中 \`triadizationFocus\` 必须等于 \`${context.triadizationFocus}\`。`);
    lines.push(`其中 \`recommendedOperation\` 必须等于 \`${context.recommendedOperation}\`。`);
    return lines;
}
function createTriadizationFocusOutputSection(context, stageSpecificRule, title = 'Required Output Notes') {
    return (0, workflowPromptRenderSupport_1.createPromptSection)(title, buildTriadizationFocusOutputLines(context, stageSpecificRule));
}
//# sourceMappingURL=workflowPromptSupport.js.map