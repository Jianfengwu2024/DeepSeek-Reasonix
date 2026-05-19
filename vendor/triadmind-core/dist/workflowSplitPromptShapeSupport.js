"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWorkflowSplitPromptShape = buildWorkflowSplitPromptShape;
const triadizationSplitArtifactSupport_1 = require("./triadizationSplitArtifactSupport");
const workflowPromptRenderSupport_1 = require("./workflowPromptRenderSupport");
const workspace_1 = require("./workspace");
const WORKFLOW_SPLIT_STAGE_SHAPE_CONFIG = {
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
function buildWorkflowSplitPromptShape(stage, paths, userDemand) {
    const config = WORKFLOW_SPLIT_STAGE_SHAPE_CONFIG[stage];
    const stageLines = [...config.taskLines];
    if (config.inputFileKey) {
        stageLines.push(`输入文件：${(0, workspace_1.normalizePath)(paths[config.inputFileKey])}`);
    }
    stageLines.push(`输出文件：${(0, workspace_1.normalizePath)(paths[config.outputFileKey])}`);
    return (0, workflowPromptRenderSupport_1.renderPromptBlocks)([
        (0, workflowPromptRenderSupport_1.createPromptSection)(config.title, stageLines),
        (0, workflowPromptRenderSupport_1.createPromptSection)('User Demand', JSON.stringify(userDemand.trim())),
        (0, workflowPromptRenderSupport_1.createPromptSection)('Output JSON Shape', (0, triadizationSplitArtifactSupport_1.buildSplitArtifactShapeJson)(stage))
    ]);
}
//# sourceMappingURL=workflowSplitPromptShapeSupport.js.map