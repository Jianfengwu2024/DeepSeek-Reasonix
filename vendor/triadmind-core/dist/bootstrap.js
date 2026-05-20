"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSelfBootstrapArchitecture = buildSelfBootstrapArchitecture;
exports.writeSelfBootstrapReport = writeSelfBootstrapReport;
exports.buildSelfBootstrapProtocol = buildSelfBootstrapProtocol;
exports.writeSelfBootstrapProtocol = writeSelfBootstrapProtocol;
const fs = __importStar(require("fs"));
const bootstrapRightBranch_1 = require("./bootstrapRightBranch");
const protocol_1 = require("./protocol");
const workspace_1 = require("./workspace");
/**
 * @LeftBranch
 */
function buildSelfBootstrapArchitecture(paths) {
    const triadMap = (0, protocol_1.readTriadMap)(paths.mapFile);
    const modules = buildBootstrapModules(triadMap);
    return {
        vertex: {
            name: 'TriadMind.SelfBootstrap',
            responsibility: 'TriadMind 先用顶点三元法描述、约束和审核自己，再作为工具约束其他项目。',
            invariant: '任何新增能力都必须先复用现有拓扑；不能复用时只修改契约；职责不匹配时才 create_child。'
        },
        macroSplit: {
            anchorNodeId: 'Workflow.buildMasterPrompt',
            leftBranch: [
                'Parser / TreeSitterParser 抽取源码拓扑',
                'Workflow 组织 Macro/Meso/Micro 多轮推演',
                'Protocol 校验升级协议',
                'Generator 将协议落地为骨架',
                'Visualizer 渲染知识图谱审核',
                'Sync / Rules / Healing 提供持续同步、默认规则与自愈闭环'
            ],
            rightBranch: [
                'WorkspacePaths 定义 .triadmind 静态边界',
                'TriadConfig 定义语言、解析器、协议和自愈策略',
                'Triad-IR 定义跨语言中间表示',
                'ProtocolRightBranch 定义协议类型与 Schema',
                'HealingRightBranch 定义错误分类与自愈输出规则',
                'Snapshots 定义安全回滚边界',
                'WorkflowRightBranch / BootstrapRightBranch 提供右分支静态目录'
            ]
        },
        mesoSplit: modules,
        microSplit: modules
    };
}
/**
 * @LeftBranch
 */
function writeSelfBootstrapReport(paths) {
    fs.mkdirSync(paths.triadDir, { recursive: true });
    const architecture = buildSelfBootstrapArchitecture(paths);
    fs.writeFileSync(paths.selfBootstrapFile, renderSelfBootstrapMarkdown(architecture), 'utf-8');
    return paths.selfBootstrapFile;
}
/**
 * @LeftBranch
 */
function buildSelfBootstrapProtocol(paths) {
    const existingNodes = new Set((0, protocol_1.readTriadMap)(paths.mapFile).map((node) => node.nodeId));
    const reusableNodes = (0, bootstrapRightBranch_1.getSelfBootstrapNodeIds)().filter((nodeId) => existingNodes.has(nodeId));
    return {
        protocolVersion: '1.0',
        project: (0, workspace_1.normalizePath)(paths.projectRoot),
        mapSource: (0, workspace_1.normalizePath)(paths.mapFile),
        userDemand: '完成 TriadMind 自举：用 TriadMind 自身的拓扑图证明其核心模块已经遵从顶点三元法，并把混合模块拆分为显式左右分支。',
        upgradePolicy: {
            allowedOps: ['reuse', 'modify', 'create_child'],
            principle: 'reuse_first_minimal_change'
        },
        macroSplit: {
            triadizationFocus: 'Workflow.buildMasterPrompt',
            recommendedOperation: 'split',
            anchorNodeId: 'Workflow.buildMasterPrompt',
            vertexGoal: 'TriadMind 作为架构演进顶点，连接动态执行链路与静态约束链路。',
            leftBranch: [
                'Parser.runParser',
                'Protocol.assertProtocolShape',
                'Generator.applyProtocol',
                'Visualizer.generateDashboard',
                'Healing.prepareHealingArtifacts'
            ],
            rightBranch: [
                'Workspace.getWorkspacePaths',
                'Config.loadTriadConfig',
                'Ir.buildTopologyIR',
                'Snapshot.createSnapshot',
                'ProtocolRightBranch.getUpgradeProtocolSchema',
                'GeneratorRightBranch.resolveSourceFilePath',
                'HealingRightBranch.classifyDiagnosis',
                'WorkflowRightBranch.createDraftProtocolTemplate',
                'BootstrapRightBranch.getBootstrapModuleRoles'
            ]
        },
        mesoSplit: {
            triadizationFocus: 'Workflow.buildMasterPrompt',
            recommendedOperation: 'split',
            classes: [
                {
                    className: 'Workflow',
                    category: 'core',
                    responsibility: '编排多轮推演、协议生成和实现交接。',
                    upstreams: ['triad.md', 'triad-map.json', 'latest-demand.txt', 'WorkflowRightBranch'],
                    downstreams: ['master-prompt.md', 'draft-protocol.json', 'implementation-handoff.md']
                },
                {
                    className: 'Protocol',
                    category: 'core',
                    responsibility: '用 Schema 与拓扑规则把提示词输出转为硬约束协议。',
                    upstreams: ['draft-protocol.json', 'triad-map.json', 'config.json', 'ProtocolRightBranch'],
                    downstreams: ['validated UpgradeProtocol']
                },
                {
                    className: 'Generator',
                    category: 'core',
                    responsibility: '把已批准协议转译为源码骨架。',
                    upstreams: ['validated UpgradeProtocol', 'triad-map.json', 'GeneratorRightBranch'],
                    downstreams: ['changed source files']
                },
                {
                    className: 'Healing',
                    category: 'core',
                    responsibility: '把运行时错误回溯为拓扑诊断和修复协议提示词。',
                    upstreams: ['runtime-error.log', 'triad-map.json', 'HealingRightBranch'],
                    downstreams: ['healing-report.json', 'healing-prompt.md']
                },
                {
                    className: 'Bootstrap',
                    category: 'core',
                    responsibility: '把自举声明、复用清单和知识图谱审核页收敛为可重复执行的自证流程。',
                    upstreams: ['triad-map.json', 'BootstrapRightBranch'],
                    downstreams: ['self-bootstrap.md', 'self-bootstrap-protocol.json', 'visualizer.html']
                }
            ],
            pipelines: [
                {
                    pipelineId: 'SelfBootstrap.PlanningPipeline',
                    purpose: 'TriadMind 用自己的 Workflow/Protocol 约束自己的演化。',
                    steps: ['Sync.syncTriadMap', 'Workflow.buildMasterPrompt', 'Protocol.assertProtocolShape']
                },
                {
                    pipelineId: 'SelfBootstrap.ExecutionPipeline',
                    purpose: 'TriadMind 用自己的 Generator/Visualizer/Snapshot 审核并落地自己的变化。',
                    steps: ['Visualizer.generateDashboard', 'Snapshot.createSnapshot', 'Generator.applyProtocol']
                }
            ]
        },
        microSplit: {
            triadizationFocus: 'Workflow.buildMasterPrompt',
            recommendedOperation: 'split',
            classes: [
                {
                    className: 'Workflow',
                    staticRightBranch: [
                        { name: 'triad spec seed', type: 'document template', role: '顶点三元法规范种子' },
                        { name: 'pipeline artifact seeds', type: 'artifact seed set', role: '多阶段演进种子' }
                    ],
                    dynamicLeftBranch: [
                        {
                            name: 'buildMasterPrompt',
                            demand: ['triad.md', 'draft-protocol.json', 'multi-pass artifacts'],
                            answer: ['master-prompt.md'],
                            responsibility: '把当前 triadization focus 下的阶段性演进结果汇总为唯一主提示。'
                        }
                    ]
                },
                {
                    className: 'HealingRightBranch',
                    staticRightBranch: [
                        { name: 'classification rules', type: 'RegExp strategy', role: '错误归因规则' },
                        { name: 'blast radius strategy', type: 'node impact estimator', role: '影响半径策略' }
                    ],
                    dynamicLeftBranch: [
                        {
                            name: 'classifyDiagnosis',
                            demand: ['errorText'],
                            answer: ['HealingBranchKind'],
                            responsibility: '向 Healing 左分支提供稳定的错误分类策略。'
                        }
                    ]
                },
                {
                    className: 'GeneratorRightBranch',
                    staticRightBranch: [
                        { name: 'BUILTIN_TYPE_NAMES', type: 'Set<string>', role: '内置类型白名单' },
                        { name: 'source path strategy', type: 'path resolver', role: '源码落点策略' }
                    ],
                    dynamicLeftBranch: [
                        {
                            name: 'resolveSourceFilePath',
                            demand: ['projectRoot', 'ParsedNodeRef', 'TriadNodeDefinition', 'NodeLocationMap'],
                            answer: ['string'],
                            responsibility: '向 Generator 左分支提供稳定的源码落点策略。'
                        }
                    ]
                },
                {
                    className: 'ProtocolRightBranch',
                    staticRightBranch: [
                        { name: 'upgradeProtocolSchema', type: 'ZodSchema', role: '协议结构约束' },
                        { name: 'PREFIX_CATEGORY_MAP', type: 'Record<string, TriadCategory>', role: '节点类别映射' }
                    ],
                    dynamicLeftBranch: [
                        {
                            name: 'getUpgradeProtocolSchema',
                            demand: [],
                            answer: ['ZodSchema'],
                            responsibility: '向 Protocol 左分支提供稳定的协议 Schema。'
                        }
                    ]
                },
                {
                    className: 'WorkflowRightBranch',
                    staticRightBranch: [
                        { name: 'draft protocol template', type: 'object factory', role: '协议种子' },
                        { name: 'stage router rules', type: 'string[]', role: '阶段判定规则' }
                    ],
                    dynamicLeftBranch: [
                        {
                            name: 'createDraftProtocolTemplate',
                            demand: ['projectRoot', 'mapFile', 'userDemand'],
                            answer: ['object'],
                            responsibility: '向 Workflow 左分支提供稳定的协议模板。'
                        }
                    ]
                },
                {
                    className: 'BootstrapRightBranch',
                    staticRightBranch: [
                        { name: 'module roles', type: 'record', role: '模块职责目录' },
                        { name: 'self bootstrap node ids', type: 'string[]', role: '复用节点清单' }
                    ],
                    dynamicLeftBranch: [
                        {
                            name: 'getBootstrapModuleRoles',
                            demand: [],
                            answer: ['record'],
                            responsibility: '向 Bootstrap 左分支提供稳定的自举目录。'
                        }
                    ]
                }
            ]
        },
        actions: reusableNodes.map((nodeId) => ({
            op: 'reuse',
            nodeId,
            reason: '自举协议复用该节点作为 TriadMind 自身架构的既有顶点。',
            confidence: 0.95
        }))
    };
}
/**
 * @LeftBranch
 */
function writeSelfBootstrapProtocol(paths) {
    fs.mkdirSync(paths.triadDir, { recursive: true });
    const protocol = buildSelfBootstrapProtocol(paths);
    const payload = JSON.stringify(protocol, null, 2);
    fs.writeFileSync(paths.selfBootstrapProtocolFile, payload, 'utf-8');
    fs.writeFileSync(paths.draftFile, payload, 'utf-8');
    return protocol;
}
function buildBootstrapModules(triadMap) {
    const roles = (0, bootstrapRightBranch_1.getBootstrapModuleRoles)();
    const grouped = new Map();
    triadMap.forEach((node) => {
        const moduleName = node.nodeId.split('.')[0] || 'Unknown';
        grouped.set(moduleName, [...(grouped.get(moduleName) ?? []), node]);
    });
    return Array.from(grouped.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([moduleName, nodes]) => {
        const role = roles[moduleName] ?? {
            role: 'TriadMind 核心模块。',
            staticRightBranch: ['module exports', 'type signatures']
        };
        return {
            moduleName,
            sourcePath: nodes[0]?.sourcePath ?? '',
            role: role.role,
            staticRightBranch: [...role.staticRightBranch],
            dynamicLeftBranch: nodes.map((node) => node.nodeId).sort()
        };
    });
}
function renderSelfBootstrapMarkdown(architecture) {
    return [
        '# TriadMind Self-Bootstrap Architecture',
        '',
        (0, bootstrapRightBranch_1.getSelfBootstrapPreamble)(),
        '',
        '## 1. Vertex',
        '',
        `- Name: \`${architecture.vertex.name}\``,
        `- Responsibility: ${architecture.vertex.responsibility}`,
        `- Invariant: ${architecture.vertex.invariant}`,
        '',
        '## 2. Macro-Split',
        '',
        `- Anchor: \`${architecture.macroSplit.anchorNodeId}\``,
        '- Left Branch:',
        ...architecture.macroSplit.leftBranch.map((item) => `  - ${item}`),
        '- Right Branch:',
        ...architecture.macroSplit.rightBranch.map((item) => `  - ${item}`),
        '',
        '## 3. Meso-Split',
        '',
        ...architecture.mesoSplit.flatMap((module) => [
            `### ${module.moduleName}`,
            '',
            `- Source: \`${module.sourcePath}\``,
            `- Responsibility: ${module.role}`,
            `- Static Right Branch: ${module.staticRightBranch.join(' / ')}`,
            `- Dynamic Left Branch: ${module.dynamicLeftBranch.map((nodeId) => `\`${nodeId}\``).join(', ')}`,
            ''
        ]),
        '## 4. Micro-Split Rules',
        '',
        ...(0, bootstrapRightBranch_1.getSelfBootstrapMicroRules)().map((item) => `- ${item}`),
        '',
        '## 5. Self-Bootstrap Loop',
        '',
        '```text',
        ...(0, bootstrapRightBranch_1.getSelfBootstrapLoopLines)(),
        '```',
        ''
    ].join('\n');
}
//# sourceMappingURL=bootstrap.js.map