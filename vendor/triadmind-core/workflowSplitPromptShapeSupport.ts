import { buildSplitArtifactShapeJson } from './triadizationSplitArtifactSupport';
import { createPromptSection, renderPromptBlocks } from './workflowPromptRenderSupport';
import type { WorkspacePaths } from './workspace';
import { normalizePath } from './workspace';
import type { WorkflowSplitStage } from './workflowPromptCatalogSupport';

type WorkflowSplitStageShapeConfig = {
    title: string;
    taskLines: string[];
    inputFileKey?: 'macroSplitFile' | 'mesoSplitFile';
    outputFileKey: 'macroSplitFile' | 'mesoSplitFile' | 'microSplitFile';
};

const WORKFLOW_SPLIT_STAGE_SHAPE_CONFIG: Record<WorkflowSplitStage, WorkflowSplitStageShapeConfig> = {
    macro: {
        title: 'Pass 1: Macro-Split',
        taskLines: ['任务：寻找挂载点 Anchor，并把需求切成左右分支。', '左分支 = 具体要干活的子功能。', '右分支 = 编排流程、参数配置、状态约束。'],
        outputFileKey: 'macroSplitFile'
    },
    meso: {
        title: 'Pass 2: Meso-Split',
        taskLines: ['任务：基于 Macro-Split 的子功能，把需求继续拆成类（Class）和数据管道（Pipeline）。'],
        inputFileKey: 'macroSplitFile',
        outputFileKey: 'mesoSplitFile'
    },
    micro: {
        title: 'Pass 3: Micro-Split',
        taskLines: ['任务：基于 Meso-Split 的类，把类拆成属性 / 状态（静态右分支）与方法 / 动作（动态左分支），并明确 demand / answer。'],
        inputFileKey: 'mesoSplitFile',
        outputFileKey: 'microSplitFile'
    }
};

export function buildWorkflowSplitPromptShape(stage: WorkflowSplitStage, paths: WorkspacePaths, userDemand: string) {
    const config = WORKFLOW_SPLIT_STAGE_SHAPE_CONFIG[stage];
    const stageLines = [...config.taskLines];

    if (config.inputFileKey) {
        stageLines.push(`输入文件：${normalizePath(paths[config.inputFileKey])}`);
    }
    stageLines.push(`输出文件：${normalizePath(paths[config.outputFileKey])}`);

    return renderPromptBlocks([
        createPromptSection(config.title, stageLines),
        createPromptSection('User Demand', JSON.stringify(userDemand.trim())),
        createPromptSection('Output JSON Shape', buildSplitArtifactShapeJson(stage))
    ]);
}
