import {
    createTriadizationFocusGateSection,
    createTriadizationFocusJsonSection,
    createTriadizationFocusOutputSection,
    createTriadizationFocusRuleSection,
    createTriadizationFocusSummarySection,
    resolveTriadizationFocusContext
} from './workflowPromptSupport';
import { ImplementationHandoffInput, normalizePath, WorkspacePaths } from './workspace';
import {
    createJsonSection,
    createPromptSection,
    renderLabeledCodeBlockEntries,
    renderPromptBlocks
} from './workflowPromptRenderSupport';
import {
    createMasterPromptContext,
    createTriadPlanningPromptContext
} from './workflowWorkspaceSnapshot';
import {
    getWorkflowPromptPolicyLines,
    getWorkflowSplitStageRequiredOutputRule,
    type WorkflowSplitStage
} from './workflowPromptCatalogSupport';
import {
    buildMacroPromptShape,
    buildMesoPromptShape,
    buildMicroPromptShape,
    getImplementationExecutionWorkflowLines,
    getImplementationHandoffRuleLines,
    getMasterPromptExpectedBehaviorLines,
    getMasterPromptImplementationPhaseLines,
    getMasterPromptProtocolPhaseLines,
    getMasterPromptStageRouterLines,
    getProtocolOutputContractLines
} from './workflowRightBranch';
import {
    buildAbstractionMemoryPromptContext,
    formatAbstractionProtocolActionCandidatesJson,
    buildAbstractionMemoryPromptContextWithFocus,
    formatAbstractionMemoryRecommendationsJson,
    formatAbstractionMemoryPromptJson
} from './abstractionMemory';
import {
    buildProjectAbsToolkitPromptContext,
    formatProjectAbsToolkitPromptJson
} from './projectAbsToolkit';

export function buildProtocolPrompt(paths: WorkspacePaths, userDemand: string) {
    const context = createTriadPlanningPromptContext(paths, userDemand);
    const projectToolkit = buildProjectAbsToolkitPromptContext(paths, userDemand);

    return renderPromptBlocks([
        createPromptSection('System', context.triadSpec),
        createPromptSection('Context: Project Root', normalizePath(paths.projectRoot)),
        createPromptSection('Context: Triad Map Path', normalizePath(paths.mapFile)),
        createJsonSection('Context: Triad Config JSON', context.configJson, '{}'),
        createJsonSection('Context: Triad Map JSON', context.mapJson, '[]'),
        createJsonSection('Context: Triadization Report JSON', context.triadizationReportJson, '{}'),
        createJsonSection('Context: Triadization Session JSON', context.triadizationSessionJson, '{}'),
        createTriadizationFocusSummarySection(context.triadizationFocus, 'Context: Triadization Focus'),
        createTriadizationFocusJsonSection(context.triadizationFocus, 'Context: Triadization Focus JSON'),
        createJsonSection('Context: Macro Split JSON', context.macroJson, '{}'),
        createJsonSection('Context: Meso Split JSON', context.mesoJson, '{}'),
        createJsonSection('Context: Micro Split JSON', context.microJson, '{}'),
        createPromptSection('Context: Project Abstraction Toolkit Workflow', projectToolkit.summaryLines),
        createJsonSection(
            'Context: Project Abstraction Toolkit Matches JSON',
            formatProjectAbsToolkitPromptJson(projectToolkit.matches),
            '[]'
        ),
        createPromptSection('User Demand', JSON.stringify(context.userDemand)),
        createTriadizationFocusRuleSection(context.triadizationFocus),
        createTriadizationFocusGateSection(context.stage),
        createPromptSection('Output Contract', getProtocolOutputContractLines())
    ]);
}

export function buildImplementationPrompt(paths: WorkspacePaths, userDemand: string) {
    const context = createTriadPlanningPromptContext(paths, userDemand);
    const projectToolkit = buildProjectAbsToolkitPromptContext(paths, userDemand);
    const abstractionMemory = buildAbstractionMemoryPromptContextWithFocus(paths, {
        demand: userDemand,
        focusNodeId: context.triadizationFocus?.triadizationFocus
    });

    return renderPromptBlocks([
        createPromptSection('System', [
            '你是一个严格遵守顶点三元法的软件实现助手。',
            '在真正写代码之前，你必须先完成一个内置子任务：生成拓扑升级协议。',
            '协议生成不是独立流程，而是实现流程的第一阶段。'
        ]),
        createPromptSection('Triad Spec', context.triadSpec),
        createPromptSection('Project Root', normalizePath(paths.projectRoot)),
        createPromptSection('Triad Map Path', normalizePath(paths.mapFile)),
        createJsonSection('Triad Config JSON', context.configJson, '{}'),
        createJsonSection('Triad Map JSON', context.mapJson, '[]'),
        createJsonSection('Triadization Report JSON', context.triadizationReportJson, '{}'),
        createJsonSection('Triadization Session JSON', context.triadizationSessionJson, '{}'),
        createPromptSection('Project Abstraction Toolkit Workflow', projectToolkit.summaryLines),
        createJsonSection(
            'Project Abstraction Toolkit Matches JSON',
            formatProjectAbsToolkitPromptJson(projectToolkit.matches),
            '[]'
        ),
        createPromptSection('Abstraction Memory Workflow', abstractionMemory.summaryLines),
        createJsonSection(
            'Abstraction Memory Matches JSON',
            formatAbstractionMemoryPromptJson(abstractionMemory.matches),
            '[]'
        ),
        createJsonSection(
            'Abstraction Memory Recommendations JSON',
            formatAbstractionMemoryRecommendationsJson(abstractionMemory.recommendations),
            '[]'
        ),
        createJsonSection(
            'Protocol Seed Action Candidates JSON',
            formatAbstractionProtocolActionCandidatesJson(abstractionMemory.protocolActionCandidates),
            '[]'
        ),
        createPromptSection('Triadization Task', context.triadizationTask || '当前尚未生成 triadization-task.md'),
        createTriadizationFocusSummarySection(context.triadizationFocus),
        createPromptSection('User Demand', JSON.stringify(context.userDemand)),
        createPromptSection('Execution Workflow', getImplementationExecutionWorkflowLines()),
        createTriadizationFocusRuleSection(context.triadizationFocus),
        createTriadizationFocusGateSection(context.stage),
        createPromptSection('Output Rules', getWorkflowPromptPolicyLines('implementationOutputRules'))
    ]);
}

export function buildPipelinePrompt(paths: WorkspacePaths, userDemand: string) {
    const context = createTriadPlanningPromptContext(paths, userDemand);

    return renderPromptBlocks([
        createPromptSection('System', [
            '你是 TriadMind 的多轮推演调度器。',
            '你不能一次性直接想出最终协议；你必须按 Macro-Split、Meso-Split、Micro-Split 三轮顺序推演。'
        ]),
        createPromptSection('Triad Spec', context.triadSpec),
        createPromptSection('Project Root', normalizePath(paths.projectRoot)),
        createJsonSection('Triad Map JSON', context.mapJson, '[]'),
        createJsonSection('Triadization Report JSON', context.triadizationReportJson, '{}'),
        createJsonSection('Triadization Session JSON', context.triadizationSessionJson, '{}'),
        createPromptSection('Triadization Task', context.triadizationTask || '当前尚未生成 triadization-task.md'),
        createTriadizationFocusSummarySection(context.triadizationFocus),
        createPromptSection('User Demand', JSON.stringify(context.userDemand)),
        createPromptSection('Pass 0: Triadization Diagnosis', getWorkflowPromptPolicyLines('pipelineDiagnosis')),
        createPromptSection('Pass 1: Macro-Split', [
            `把需求切成：挂载点、左分支（子功能）、右分支（编排 / 配置）。结果写入 ${normalizePath(paths.macroSplitFile)}。`,
            '输出必须显式填写 `triadizationFocus` 与 `recommendedOperation`，并与当前 focus 保持一致。'
        ]),
        createPromptSection('Pass 2: Meso-Split', [
            `基于 Macro 结果，把子功能切成类与数据管道。结果写入 ${normalizePath(paths.mesoSplitFile)}。`,
            '输出必须继续沿用同一个 `triadizationFocus` 与 `recommendedOperation`，不得漂移。'
        ]),
        createPromptSection('Pass 3: Micro-Split', [
            `基于 Meso 结果，把类切成属性 / 状态和方法 / 动作，并明确 demand / answer。结果写入 ${normalizePath(paths.microSplitFile)}。`,
            '输出必须继续沿用同一个 `triadizationFocus` 与 `recommendedOperation`，并把类级左右分支对齐到该 focus。'
        ]),
        createPromptSection('Final Protocol', [
            `把三轮结果折叠进 ${normalizePath(paths.draftFile)}，并提供可 apply 的 \`actions\`。`
        ]),
        createTriadizationFocusRuleSection(context.triadizationFocus),
        createTriadizationFocusGateSection(context.stage),
        createPromptSection('Rules', getWorkflowPromptPolicyLines('pipelineRules'))
    ]);
}

export function buildMasterPrompt(paths: WorkspacePaths) {
    const context = createMasterPromptContext(paths);
    const projectToolkit = buildProjectAbsToolkitPromptContext(paths, context.latestDemand);
    const abstractionMemory = buildAbstractionMemoryPromptContextWithFocus(paths, {
        demand: context.latestDemand,
        focusNodeId: context.triadizationFocus?.triadizationFocus
    });

    return renderPromptBlocks([
        createPromptSection('System', [
            '你是 TriadMind 工作流的统一入口助手。',
            '你必须先判断当前所处阶段，再决定是继续协议规划，还是进入批准后的实现阶段。',
            '协议没有被确认前，不允许直接跳过 visualizer 去写最终实现。'
        ]),
        createPromptSection('Current Stage', context.stage.currentStage),
        createPromptSection('Triad Spec', context.triadSpec || '未找到 triad.md'),
        createPromptSection('Project Root', normalizePath(paths.projectRoot)),
        createJsonSection('Triad Config JSON', context.triadConfig, '{}'),
        createPromptSection('Latest User Demand', context.latestDemand ? JSON.stringify(context.latestDemand.trim()) : '""'),
        createJsonSection('Triadization Report JSON', context.triadizationReport, '{}'),
        createJsonSection('Triadization Session JSON', context.triadizationSession, '{}'),
        createPromptSection('Project Abstraction Toolkit Workflow', projectToolkit.summaryLines),
        createJsonSection(
            'Project Abstraction Toolkit Matches JSON',
            formatProjectAbsToolkitPromptJson(projectToolkit.matches),
            '[]'
        ),
        createPromptSection('Abstraction Memory Workflow', abstractionMemory.summaryLines),
        createJsonSection(
            'Abstraction Memory Matches JSON',
            formatAbstractionMemoryPromptJson(abstractionMemory.matches),
            '[]'
        ),
        createJsonSection(
            'Abstraction Memory Recommendations JSON',
            formatAbstractionMemoryRecommendationsJson(abstractionMemory.recommendations),
            '[]'
        ),
        createJsonSection(
            'Protocol Seed Action Candidates JSON',
            formatAbstractionProtocolActionCandidatesJson(abstractionMemory.protocolActionCandidates),
            '[]'
        ),
        createPromptSection('Triadization Task', context.triadizationTask || '当前尚未生成 triadization-task.md'),
        createTriadizationFocusSummarySection(context.triadizationFocus),
        createTriadizationFocusRuleSection(context.triadizationFocus),
        createTriadizationFocusGateSection(context.stage),
        createJsonSection('Triad Map JSON', context.triadMap, '[]'),
        createJsonSection('Draft Protocol JSON', context.draftProtocol, '{}'),
        createJsonSection('Macro Split JSON', context.macroSplit, '{}'),
        createJsonSection('Meso Split JSON', context.mesoSplit, '{}'),
        createJsonSection('Micro Split JSON', context.microSplit, '{}'),
        createJsonSection('Approved Protocol JSON', context.approvedProtocol, '{}'),
        createJsonSection('Last Apply Files', context.applyFilesManifest, '{"files":[]}'),
        createPromptSection('Changed Skeleton Files', context.changedFilesSection),
        createPromptSection('Dream Feedback Rules', context.dreamFeedbackRules),
        createPromptSection('Stage Router', getMasterPromptStageRouterLines()),
        createPromptSection('Protocol Phase Rules', getMasterPromptProtocolPhaseLines()),
        createPromptSection('Implementation Phase Rules', getMasterPromptImplementationPhaseLines()),
        createPromptSection('Multi-pass Pipeline Prompt', context.pipelinePrompt || '当前尚未生成 multi-pass-pipeline.md'),
        createPromptSection('Handoff Prompt', context.handoffPrompt || '当前尚未生成 implementation-handoff.md'),
        createPromptSection('Expected Behavior', getMasterPromptExpectedBehaviorLines())
    ]);
}

export function buildImplementationHandoffPrompt(
    paths: WorkspacePaths,
    triadSpec: string,
    input: ImplementationHandoffInput
) {
    const changedFilesSection = renderLabeledCodeBlockEntries(
        input.changedFiles.map((file) => ({
            label: 'Skeleton File',
            path: file.path,
            content: file.content
        })),
        {
            emptyMessage: '当前没有检测到本轮 apply 直接涉及的骨架文件，请优先从 `last-approved-protocol.json` 对应的节点文件开始实现。',
            language: 'ts'
        }
    );

    return renderPromptBlocks([
        createPromptSection('System', [
            '你现在处于顶点三元法工作流的第二阶段：协议已通过审核，骨架代码已落地。',
            '你的任务不再是重新设计拓扑，而是在已批准拓扑内，基于骨架代码完成具体实现。'
        ]),
        createPromptSection('Triad Spec', triadSpec),
        createPromptSection('Project Root', normalizePath(paths.projectRoot)),
        createPromptSection('User Demand', JSON.stringify(input.userDemand.trim())),
        createJsonSection('Approved Protocol JSON', input.approvedProtocolJson, '{}'),
        createJsonSection('Updated Triad Map JSON', input.triadMapJson, '[]'),
        createPromptSection('Skeleton Files', changedFilesSection),
        createPromptSection('Implementation Rules', getImplementationHandoffRuleLines()),
        createPromptSection('Expected Output', getWorkflowPromptPolicyLines('implementationExpectedOutput'))
    ]);
}

export function buildMacroPrompt(paths: WorkspacePaths, userDemand: string) {
    return buildNamedSplitStagePrompt('macro', paths, userDemand);
}

export function buildMesoPrompt(paths: WorkspacePaths, userDemand: string) {
    return buildNamedSplitStagePrompt('meso', paths, userDemand);
}

export function buildMicroPrompt(paths: WorkspacePaths, userDemand: string) {
    return buildNamedSplitStagePrompt('micro', paths, userDemand);
}

function buildNamedSplitStagePrompt(stage: WorkflowSplitStage, paths: WorkspacePaths, userDemand: string) {
    const triadizationFocus = resolveTriadizationFocusContext(paths);
    return buildSplitStagePrompt(
        buildSplitPromptShapeByStage(stage, paths, userDemand),
        triadizationFocus,
        getWorkflowSplitStageRequiredOutputRule(stage)
    );
}

function buildSplitStagePrompt(
    promptShape: string,
    triadizationFocus: ReturnType<typeof resolveTriadizationFocusContext>,
    stageSpecificRule: string
) {
    return renderPromptBlocks([
        promptShape,
        createTriadizationFocusSummarySection(triadizationFocus),
        createTriadizationFocusRuleSection(triadizationFocus, 'Focus Rules'),
        createTriadizationFocusOutputSection(triadizationFocus, stageSpecificRule)
    ]);
}

function buildSplitPromptShapeByStage(stage: WorkflowSplitStage, paths: WorkspacePaths, userDemand: string) {
    switch (stage) {
        case 'macro':
            return buildMacroPromptShape(paths, userDemand);
        case 'meso':
            return buildMesoPromptShape(paths, userDemand);
        case 'micro':
            return buildMicroPromptShape(paths, userDemand);
    }
}
