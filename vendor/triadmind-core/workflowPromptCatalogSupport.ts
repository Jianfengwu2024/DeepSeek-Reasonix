export type WorkflowSplitStage = 'macro' | 'meso' | 'micro';

const WORKFLOW_PROMPT_POLICY_CATALOG = {
    protocolOutputContract: [
        '只返回严格 JSON；禁止输出 markdown、解释、前后缀说明。',
        '最终 JSON 必须同时包含 `macroSplit`、`mesoSplit`、`microSplit`、`actions`。',
        '`allowedOps` 只能是 `reuse` / `modify` / `create_child`。',
        '`macroSplit`、`mesoSplit`、`microSplit` 应显式保留当前 triadization focus 与 recommendedOperation，三者不得漂移。',
        '`macroSplit` 负责寻找挂载点，并拆出左分支=子功能、右分支=编排 / 配置。',
        '`mesoSplit` 负责把子功能继续拆成类与数据管道。',
        '`microSplit` 负责把类继续拆成属性 / 状态与方法 / 动作，并明确 demand / answer。',
        '`actions` 是最终可 apply 的落地协议；可复用则优先 `reuse`，可局部升级则 `modify`，只有无法稳定挂载时才 `create_child`。',
        '`create_child` 必须提供 `parentNodeId`，并保持符合顶点三元法的最小裂变。'
    ],
    implementationExecutionWorkflow: [
        '1. 先锁定当前 triadization focus；后续所有拆分都必须围绕同一个目标节点与同一个 recommendedOperation。',
        '2. 再执行 Macro-Split：寻找挂载点，并把功能拆成左分支=子功能、右分支=编排 / 配置。',
        '3. 再执行 Meso-Split：把子功能继续拆成类（Class）、数据管道（Pipeline）与职责边界。',
        '4. 最后执行 Micro-Split：把类拆成属性 / 状态（静态右分支）与方法 / 动作（动态左分支）。',
        '5. 把三轮结果折叠进最终 `draft-protocol.json`，再进入 visualizer 审核。',
        '6. 协议确认之后，才允许继续具体实现。'
    ],
    masterPromptStageRouter: [
        '1. 只有当 `actions` 非空时，Draft / Approved Protocol 才算完成。',
        '2. 只有当 `macroSplit` 出现 `anchorNodeId`，或 `leftBranch` / `rightBranch` 非空时，才算完成 Macro-Split。',
        '3. 只有当 `mesoSplit` 的 `classes` 或 `pipelines` 非空时，才算完成 Meso-Split。',
        '4. 只有当 `microSplit.classes` 非空，且类中存在属性 / 方法拆分时，才算完成 Micro-Split。',
        '5. Draft / Approved Protocol 是否生效，要以 `userDemand` 是否匹配当前最新需求为准。',
        '6. 若 Approved Protocol 已完成且需求匹配，则进入实现阶段。',
        '7. 若 Draft Protocol 已完成且需求匹配，但尚未批准，则先走 visualizer 审核。',
        '8. 若 Micro 已完成但 Draft 未完成，则汇总最终 `draft-protocol.json`。',
        '9. 若 Meso 已完成但 Micro 未完成，则继续 Micro-Split。',
        '10. 若 Macro 已完成但 Meso 未完成，则继续 Meso-Split。',
        '11. 若以上都未完成，则先做 Macro-Split。',
        '12. 若实现阶段发现协议无法承载需求，应停止编码并返回协议阶段。'
    ],
    masterPromptProtocolPhase: [
        '先锁定并引用当前 triadization focus；没有确认焦点时，不要擅自漂移到其他节点。',
        '先做 Macro-Split：挂载点 + 左分支子功能 + 右分支编排 / 配置。',
        '再做 Meso-Split：类与数据管道。',
        '最后做 Micro-Split：属性 / 状态 + 方法 / 动作。',
        '最终输出必须汇总成严格 JSON 的 `draft-protocol.json`。'
    ],
    masterPromptImplementationPhase: [
        '优先依据 Approved Protocol JSON 与 Changed Skeleton Files 完善代码。',
        '严格在已批准节点职责内实现，不要擅自新增拓扑分支。',
        '若存在 `implementation-handoff.md`，优先服从它。'
    ],
    masterPromptExpectedBehavior: [
        '先判断阶段，再执行对应子任务。',
        '协议阶段：先给协议，再等待 visualizer / 用户确认。',
        '实现阶段：先给简洁实现计划，再补全代码实现。'
    ],
    implementationHandoffRules: [
        '1. 不要重新发明拓扑；默认协议与 triad-map 已批准。',
        '2. 只在批准后的节点职责范围内补全实现，不要绕开节点边界随意扩散。',
        '3. 优先完善当前骨架文件，必要时再补其直接依赖。',
        '4. 如果发现实现困难，先检查是否能通过 reuse 已存在能力解决，而不是新增节点。',
        '5. 如果实现确实要求拓扑改变，应停止编码并返回协议阶段。'
    ],
    implementationOutputRules: [
        '先指出当前建议三元化的节点，以及推荐动作是 aggregate / split / renormalize 中的哪一种。',
        '先确认这个建议，再进入 Macro / Meso / Micro 三轮拆分。',
        'Macro / Meso / Micro 三轮结果必须显式保留同一个 `triadizationFocus` 与 `recommendedOperation`，不能静默切换。',
        '先给出 Macro / Meso / Micro 三轮拆分结果。',
        '再给出 `draft-protocol.json` 的严格 JSON 内容。',
        '再给出简洁实现计划。',
        '如果当前就在编码环境中工作，应先把协议写入 `.triadmind/draft-protocol.json`。',
        '如果协议尚未确认，就停在协议阶段，不要跳过 visualizer 审核。'
    ],
    pipelineDiagnosis: [
        '先指出当前建议三元化的节点，以及推荐动作是 aggregate / split / renormalize 中的哪一种。',
        '先确认该建议，再进入 Macro-Split。'
    ],
    pipelineRules: [
        '每一轮都必须继承上一轮，不能跳步。',
        '如果上层拆分不稳定，就不能进入下层。',
        '如果发现需要切换到其他节点或其他动作，必须先停止当前推演并返回 triadization 确认。',
        '最终协议必须包含 `macroSplit`、`mesoSplit`、`microSplit`、`actions`。'
    ],
    implementationExpectedOutput: [
        '先给出简洁实现计划。',
        '然后基于现有骨架代码完成实现。',
        '完成后总结修改了哪些文件，以及这些修改如何对应已批准协议。'
    ]
} as const;

const WORKFLOW_SPLIT_STAGE_REQUIRED_OUTPUT_RULES: Record<WorkflowSplitStage, string> = {
    macro: 'Macro-Split 必须围绕同一个挂载点候选来展开，不要把 focus 偷偷换成别的节点。',
    meso: 'Meso-Split 中的类与数据管道必须解释为同一 triadization focus 服务，而不是横向扩题。',
    micro: 'Micro-Split 中的静态右支与动态左支必须共同完成同一 triadization focus，不能拆成无关职责。'
};

type WorkflowPromptPolicyKey = keyof typeof WORKFLOW_PROMPT_POLICY_CATALOG;

export function getWorkflowPromptPolicyLines(key: WorkflowPromptPolicyKey) {
    return [...WORKFLOW_PROMPT_POLICY_CATALOG[key]];
}

export function getWorkflowSplitStageRequiredOutputRule(stage: WorkflowSplitStage) {
    return WORKFLOW_SPLIT_STAGE_REQUIRED_OUTPUT_RULES[stage];
}

export function buildTriadSpecDocumentTemplate(projectName: string) {
    return [
        `你是一个严谨的软件架构师大脑，负责为项目 ${projectName} 生成“拓扑升级协议”。`,
        '你必须严格遵守“顶点三元法”，并理解它是面向对象编程的规范化推广与分形泛化：',
        '1. 最小尺度：类就是一个顶点',
        '- 属性 / 状态 = 静态稳定分支（右分支）',
        '- 动作 / 方法 = 动态演化分支（左分支）',
        '- 类本身 = 包裹左右分支并形成可用功能的顶点',
        '',
        '2. 中等尺度：子功能也是一个顶点',
        '- 左分支 = 具体执行的子功能',
        '- 右分支 = 编排流程、参数配置、状态约束',
        '- 顶点 = 把子功能与编排整合成完整能力',
        '',
        '3. 更大尺度：前后端协同、数据管道、工作流同样是顶点三元法',
        '- 左分支 = 参与执行的功能节点',
        '- 右分支 = 数据管道、流程编排、交互配置',
        '- 顶点 = 前后端统一可运行流程',
        '',
        '因此你不能一次性直接给出最终协议；你必须按分形层级拆分：',
        '一、Macro-Split（宏观寻址）',
        '- 找 Anchor / 挂载点',
        '- 把需求切成左分支 = 子功能，右分支 = 编排 / 配置',
        '',
        '二、Meso-Split（中观裂变）',
        '- 把子功能继续拆成类（Class）和数据管道（Pipeline）',
        '',
        '三、Micro-Split（微观具象化）',
        '- 把类拆成属性 / 状态（静态右分支）和方法 / 动作（动态左分支）',
        '- 明确 demand / answer 类型签名',
        '',
        '你被限制只能使用以下三种操作：',
        '- reuse：复用现有节点，严禁重复造轮子',
        '- modify：升级现有节点的输入 / 输出 / 职责边界',
        '- create_child：在最合适的叶节点下裂变出一个新子节点',
        '',
        '拓扑升级决策规则：',
        '1. 优先判断需求是否可以落在某个现有叶节点中。',
        '2. 如果可以在不破坏稳定拓扑的前提下扩充该叶节点，使用 modify。',
        '3. 如果现有叶节点只需要被调用、不需要改变职责，使用 reuse。',
        '4. 只有在现有叶节点无法承载该职责时，才允许 create_child。',
        '5. create_child 必须说明 parentNodeId，并保持二叉式最小增量裂变，而不是横向扩散。',
        '',
        '输出要求：',
        '1. 只能输出严格 JSON。',
        '2. JSON 顶层至少包含：',
        '   - protocolVersion',
        '   - project',
        '   - mapSource',
        '   - userDemand',
        '   - upgradePolicy',
        '   - macroSplit',
        '   - mesoSplit',
        '   - microSplit',
        '   - actions',
        '3. actions 中每一个元素只能使用 reuse / modify / create_child。',
        '4. create_child 或 modify 涉及的新职责必须包含：',
        '   - nodeId',
        '   - category',
        '   - fission.problem',
        '   - fission.demand',
        '   - fission.answer',
        '5. nodeId 应尽量对齐现有地图的叶节点命名方式：ClassName.methodName。',
        '目标不是直接写实现代码，而是先输出可审阅、可视化、可落骨架的多轮裂变协议。'
    ].join('\n');
}
