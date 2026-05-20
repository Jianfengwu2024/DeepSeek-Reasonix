"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProtocolPrompt = buildProtocolPrompt;
exports.buildImplementationPrompt = buildImplementationPrompt;
exports.buildPipelinePrompt = buildPipelinePrompt;
exports.buildMasterPrompt = buildMasterPrompt;
exports.buildImplementationHandoffPrompt = buildImplementationHandoffPrompt;
exports.buildMacroPrompt = buildMacroPrompt;
exports.buildMesoPrompt = buildMesoPrompt;
exports.buildMicroPrompt = buildMicroPrompt;
const workflowPromptSupport_1 = require("./workflowPromptSupport");
const workspace_1 = require("./workspace");
const workflowPromptRenderSupport_1 = require("./workflowPromptRenderSupport");
const workflowWorkspaceSnapshot_1 = require("./workflowWorkspaceSnapshot");
const workflowPromptCatalogSupport_1 = require("./workflowPromptCatalogSupport");
const workflowRightBranch_1 = require("./workflowRightBranch");
const abstractionMemory_1 = require("./abstractionMemory");
const projectAbsToolkit_1 = require("./projectAbsToolkit");
function buildProtocolPrompt(paths, userDemand) {
    const context = (0, workflowWorkspaceSnapshot_1.createTriadPlanningPromptContext)(paths, userDemand);
    const projectToolkit = (0, projectAbsToolkit_1.buildProjectAbsToolkitPromptContext)(paths, userDemand);
    return (0, workflowPromptRenderSupport_1.renderPromptBlocks)([
        (0, workflowPromptRenderSupport_1.createPromptSection)('System', context.triadSpec),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Context: Project Root', (0, workspace_1.normalizePath)(paths.projectRoot)),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Context: Triad Map Path', (0, workspace_1.normalizePath)(paths.mapFile)),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Context: Triad Config JSON', context.configJson, '{}'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Context: Triad Map JSON', context.mapJson, '[]'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Context: Triadization Report JSON', context.triadizationReportJson, '{}'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Context: Triadization Session JSON', context.triadizationSessionJson, '{}'),
        (0, workflowPromptSupport_1.createTriadizationFocusSummarySection)(context.triadizationFocus, 'Context: Triadization Focus'),
        (0, workflowPromptSupport_1.createTriadizationFocusJsonSection)(context.triadizationFocus, 'Context: Triadization Focus JSON'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Context: Macro Split JSON', context.macroJson, '{}'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Context: Meso Split JSON', context.mesoJson, '{}'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Context: Micro Split JSON', context.microJson, '{}'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Context: Project Abstraction Toolkit Workflow', projectToolkit.summaryLines),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Context: Project Abstraction Toolkit Matches JSON', (0, projectAbsToolkit_1.formatProjectAbsToolkitPromptJson)(projectToolkit.matches), '[]'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('User Demand', JSON.stringify(context.userDemand)),
        (0, workflowPromptSupport_1.createTriadizationFocusRuleSection)(context.triadizationFocus),
        (0, workflowPromptSupport_1.createTriadizationFocusGateSection)(context.stage),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Output Contract', (0, workflowRightBranch_1.getProtocolOutputContractLines)())
    ]);
}
function buildImplementationPrompt(paths, userDemand) {
    const context = (0, workflowWorkspaceSnapshot_1.createTriadPlanningPromptContext)(paths, userDemand);
    const projectToolkit = (0, projectAbsToolkit_1.buildProjectAbsToolkitPromptContext)(paths, userDemand);
    const abstractionMemory = (0, abstractionMemory_1.buildAbstractionMemoryPromptContextWithFocus)(paths, {
        demand: userDemand,
        focusNodeId: context.triadizationFocus?.triadizationFocus
    });
    return (0, workflowPromptRenderSupport_1.renderPromptBlocks)([
        (0, workflowPromptRenderSupport_1.createPromptSection)('System', [
            '你是一个严格遵守顶点三元法的软件实现助手。',
            '在真正写代码之前，你必须先完成一个内置子任务：生成拓扑升级协议。',
            '协议生成不是独立流程，而是实现流程的第一阶段。'
        ]),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Triad Spec', context.triadSpec),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Project Root', (0, workspace_1.normalizePath)(paths.projectRoot)),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Triad Map Path', (0, workspace_1.normalizePath)(paths.mapFile)),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Triad Config JSON', context.configJson, '{}'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Triad Map JSON', context.mapJson, '[]'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Triadization Report JSON', context.triadizationReportJson, '{}'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Triadization Session JSON', context.triadizationSessionJson, '{}'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Project Abstraction Toolkit Workflow', projectToolkit.summaryLines),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Project Abstraction Toolkit Matches JSON', (0, projectAbsToolkit_1.formatProjectAbsToolkitPromptJson)(projectToolkit.matches), '[]'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Abstraction Memory Workflow', abstractionMemory.summaryLines),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Abstraction Memory Matches JSON', (0, abstractionMemory_1.formatAbstractionMemoryPromptJson)(abstractionMemory.matches), '[]'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Abstraction Memory Recommendations JSON', (0, abstractionMemory_1.formatAbstractionMemoryRecommendationsJson)(abstractionMemory.recommendations), '[]'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Protocol Seed Action Candidates JSON', (0, abstractionMemory_1.formatAbstractionProtocolActionCandidatesJson)(abstractionMemory.protocolActionCandidates), '[]'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Triadization Task', context.triadizationTask || '当前尚未生成 triadization-task.md'),
        (0, workflowPromptSupport_1.createTriadizationFocusSummarySection)(context.triadizationFocus),
        (0, workflowPromptRenderSupport_1.createPromptSection)('User Demand', JSON.stringify(context.userDemand)),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Execution Workflow', (0, workflowRightBranch_1.getImplementationExecutionWorkflowLines)()),
        (0, workflowPromptSupport_1.createTriadizationFocusRuleSection)(context.triadizationFocus),
        (0, workflowPromptSupport_1.createTriadizationFocusGateSection)(context.stage),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Output Rules', (0, workflowPromptCatalogSupport_1.getWorkflowPromptPolicyLines)('implementationOutputRules'))
    ]);
}
function buildPipelinePrompt(paths, userDemand) {
    const context = (0, workflowWorkspaceSnapshot_1.createTriadPlanningPromptContext)(paths, userDemand);
    return (0, workflowPromptRenderSupport_1.renderPromptBlocks)([
        (0, workflowPromptRenderSupport_1.createPromptSection)('System', [
            '你是 TriadMind 的多轮推演调度器。',
            '你不能一次性直接想出最终协议；你必须按 Macro-Split、Meso-Split、Micro-Split 三轮顺序推演。'
        ]),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Triad Spec', context.triadSpec),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Project Root', (0, workspace_1.normalizePath)(paths.projectRoot)),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Triad Map JSON', context.mapJson, '[]'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Triadization Report JSON', context.triadizationReportJson, '{}'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Triadization Session JSON', context.triadizationSessionJson, '{}'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Triadization Task', context.triadizationTask || '当前尚未生成 triadization-task.md'),
        (0, workflowPromptSupport_1.createTriadizationFocusSummarySection)(context.triadizationFocus),
        (0, workflowPromptRenderSupport_1.createPromptSection)('User Demand', JSON.stringify(context.userDemand)),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Pass 0: Triadization Diagnosis', (0, workflowPromptCatalogSupport_1.getWorkflowPromptPolicyLines)('pipelineDiagnosis')),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Pass 1: Macro-Split', [
            `把需求切成：挂载点、左分支（子功能）、右分支（编排 / 配置）。结果写入 ${(0, workspace_1.normalizePath)(paths.macroSplitFile)}。`,
            '输出必须显式填写 `triadizationFocus` 与 `recommendedOperation`，并与当前 focus 保持一致。'
        ]),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Pass 2: Meso-Split', [
            `基于 Macro 结果，把子功能切成类与数据管道。结果写入 ${(0, workspace_1.normalizePath)(paths.mesoSplitFile)}。`,
            '输出必须继续沿用同一个 `triadizationFocus` 与 `recommendedOperation`，不得漂移。'
        ]),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Pass 3: Micro-Split', [
            `基于 Meso 结果，把类切成属性 / 状态和方法 / 动作，并明确 demand / answer。结果写入 ${(0, workspace_1.normalizePath)(paths.microSplitFile)}。`,
            '输出必须继续沿用同一个 `triadizationFocus` 与 `recommendedOperation`，并把类级左右分支对齐到该 focus。'
        ]),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Final Protocol', [
            `把三轮结果折叠进 ${(0, workspace_1.normalizePath)(paths.draftFile)}，并提供可 apply 的 \`actions\`。`
        ]),
        (0, workflowPromptSupport_1.createTriadizationFocusRuleSection)(context.triadizationFocus),
        (0, workflowPromptSupport_1.createTriadizationFocusGateSection)(context.stage),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Rules', (0, workflowPromptCatalogSupport_1.getWorkflowPromptPolicyLines)('pipelineRules'))
    ]);
}
function buildMasterPrompt(paths) {
    const context = (0, workflowWorkspaceSnapshot_1.createMasterPromptContext)(paths);
    const projectToolkit = (0, projectAbsToolkit_1.buildProjectAbsToolkitPromptContext)(paths, context.latestDemand);
    const abstractionMemory = (0, abstractionMemory_1.buildAbstractionMemoryPromptContextWithFocus)(paths, {
        demand: context.latestDemand,
        focusNodeId: context.triadizationFocus?.triadizationFocus
    });
    return (0, workflowPromptRenderSupport_1.renderPromptBlocks)([
        (0, workflowPromptRenderSupport_1.createPromptSection)('System', [
            '你是 TriadMind 工作流的统一入口助手。',
            '你必须先判断当前所处阶段，再决定是继续协议规划，还是进入批准后的实现阶段。',
            '协议没有被确认前，不允许直接跳过 visualizer 去写最终实现。'
        ]),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Current Stage', context.stage.currentStage),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Triad Spec', context.triadSpec || '未找到 triad.md'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Project Root', (0, workspace_1.normalizePath)(paths.projectRoot)),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Triad Config JSON', context.triadConfig, '{}'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Latest User Demand', context.latestDemand ? JSON.stringify(context.latestDemand.trim()) : '""'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Triadization Report JSON', context.triadizationReport, '{}'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Triadization Session JSON', context.triadizationSession, '{}'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Project Abstraction Toolkit Workflow', projectToolkit.summaryLines),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Project Abstraction Toolkit Matches JSON', (0, projectAbsToolkit_1.formatProjectAbsToolkitPromptJson)(projectToolkit.matches), '[]'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Abstraction Memory Workflow', abstractionMemory.summaryLines),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Abstraction Memory Matches JSON', (0, abstractionMemory_1.formatAbstractionMemoryPromptJson)(abstractionMemory.matches), '[]'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Abstraction Memory Recommendations JSON', (0, abstractionMemory_1.formatAbstractionMemoryRecommendationsJson)(abstractionMemory.recommendations), '[]'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Protocol Seed Action Candidates JSON', (0, abstractionMemory_1.formatAbstractionProtocolActionCandidatesJson)(abstractionMemory.protocolActionCandidates), '[]'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Triadization Task', context.triadizationTask || '当前尚未生成 triadization-task.md'),
        (0, workflowPromptSupport_1.createTriadizationFocusSummarySection)(context.triadizationFocus),
        (0, workflowPromptSupport_1.createTriadizationFocusRuleSection)(context.triadizationFocus),
        (0, workflowPromptSupport_1.createTriadizationFocusGateSection)(context.stage),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Triad Map JSON', context.triadMap, '[]'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Draft Protocol JSON', context.draftProtocol, '{}'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Macro Split JSON', context.macroSplit, '{}'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Meso Split JSON', context.mesoSplit, '{}'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Micro Split JSON', context.microSplit, '{}'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Approved Protocol JSON', context.approvedProtocol, '{}'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Last Apply Files', context.applyFilesManifest, '{"files":[]}'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Changed Skeleton Files', context.changedFilesSection),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Dream Feedback Rules', context.dreamFeedbackRules),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Stage Router', (0, workflowRightBranch_1.getMasterPromptStageRouterLines)()),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Protocol Phase Rules', (0, workflowRightBranch_1.getMasterPromptProtocolPhaseLines)()),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Implementation Phase Rules', (0, workflowRightBranch_1.getMasterPromptImplementationPhaseLines)()),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Multi-pass Pipeline Prompt', context.pipelinePrompt || '当前尚未生成 multi-pass-pipeline.md'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Handoff Prompt', context.handoffPrompt || '当前尚未生成 implementation-handoff.md'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Expected Behavior', (0, workflowRightBranch_1.getMasterPromptExpectedBehaviorLines)())
    ]);
}
function buildImplementationHandoffPrompt(paths, triadSpec, input) {
    const changedFilesSection = (0, workflowPromptRenderSupport_1.renderLabeledCodeBlockEntries)(input.changedFiles.map((file) => ({
        label: 'Skeleton File',
        path: file.path,
        content: file.content
    })), {
        emptyMessage: '当前没有检测到本轮 apply 直接涉及的骨架文件，请优先从 `last-approved-protocol.json` 对应的节点文件开始实现。',
        language: 'ts'
    });
    return (0, workflowPromptRenderSupport_1.renderPromptBlocks)([
        (0, workflowPromptRenderSupport_1.createPromptSection)('System', [
            '你现在处于顶点三元法工作流的第二阶段：协议已通过审核，骨架代码已落地。',
            '你的任务不再是重新设计拓扑，而是在已批准拓扑内，基于骨架代码完成具体实现。'
        ]),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Triad Spec', triadSpec),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Project Root', (0, workspace_1.normalizePath)(paths.projectRoot)),
        (0, workflowPromptRenderSupport_1.createPromptSection)('User Demand', JSON.stringify(input.userDemand.trim())),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Approved Protocol JSON', input.approvedProtocolJson, '{}'),
        (0, workflowPromptRenderSupport_1.createJsonSection)('Updated Triad Map JSON', input.triadMapJson, '[]'),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Skeleton Files', changedFilesSection),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Implementation Rules', (0, workflowRightBranch_1.getImplementationHandoffRuleLines)()),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Expected Output', (0, workflowPromptCatalogSupport_1.getWorkflowPromptPolicyLines)('implementationExpectedOutput'))
    ]);
}
function buildMacroPrompt(paths, userDemand) {
    return buildNamedSplitStagePrompt('macro', paths, userDemand);
}
function buildMesoPrompt(paths, userDemand) {
    return buildNamedSplitStagePrompt('meso', paths, userDemand);
}
function buildMicroPrompt(paths, userDemand) {
    return buildNamedSplitStagePrompt('micro', paths, userDemand);
}
function buildNamedSplitStagePrompt(stage, paths, userDemand) {
    const triadizationFocus = (0, workflowPromptSupport_1.resolveTriadizationFocusContext)(paths);
    return buildSplitStagePrompt(buildSplitPromptShapeByStage(stage, paths, userDemand), triadizationFocus, (0, workflowPromptCatalogSupport_1.getWorkflowSplitStageRequiredOutputRule)(stage));
}
function buildSplitStagePrompt(promptShape, triadizationFocus, stageSpecificRule) {
    return (0, workflowPromptRenderSupport_1.renderPromptBlocks)([
        promptShape,
        (0, workflowPromptSupport_1.createTriadizationFocusSummarySection)(triadizationFocus),
        (0, workflowPromptSupport_1.createTriadizationFocusRuleSection)(triadizationFocus, 'Focus Rules'),
        (0, workflowPromptSupport_1.createTriadizationFocusOutputSection)(triadizationFocus, stageSpecificRule)
    ]);
}
function buildSplitPromptShapeByStage(stage, paths, userDemand) {
    switch (stage) {
        case 'macro':
            return (0, workflowRightBranch_1.buildMacroPromptShape)(paths, userDemand);
        case 'meso':
            return (0, workflowRightBranch_1.buildMesoPromptShape)(paths, userDemand);
        case 'micro':
            return (0, workflowRightBranch_1.buildMicroPromptShape)(paths, userDemand);
    }
}
//# sourceMappingURL=workflowPromptBuilders.js.map