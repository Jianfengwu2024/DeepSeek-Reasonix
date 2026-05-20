/**
 * @RightBranch
 */
export declare function getBootstrapModuleRoles(): {
    readonly Adapter: {
        readonly role: "语言适配器选择层，把协议执行委托给当前项目语言插件。";
        readonly staticRightBranch: readonly ["adapter registry", "language", "parserEngine", "adapterPackage"];
    };
    readonly Bootstrap: {
        readonly role: "自举证明层，把 TriadMind 自己描述为顶点三元架构。";
        readonly staticRightBranch: readonly ["self-bootstrap.md", "self-bootstrap-protocol.json"];
    };
    readonly BootstrapRightBranch: {
        readonly role: "自举右分支目录，集中保存模块职责目录、节点复用清单和自举文案模板。";
        readonly staticRightBranch: readonly ["module roles", "self bootstrap node ids", "rendering text"];
    };
    readonly Config: {
        readonly role: "静态配置层，约束解析器、协议置信度、运行时自愈和目录分类。";
        readonly staticRightBranch: readonly ["TriadConfig", "DEFAULT_CONFIG", ".triadmind/config.json"];
    };
    readonly Generator: {
        readonly role: "骨架落地左分支，把已批准协议委托给当前语言适配器并落地为源码结构。";
        readonly staticRightBranch: readonly ["apply pipeline", "node upsert execution"];
    };
    readonly GeneratorRightBranch: {
        readonly role: "骨架生成右分支目录，集中保存类型白名单、源码路径策略和结构模板。";
        readonly staticRightBranch: readonly ["builtin type names", "source path strategy", "method/function templates"];
    };
    readonly Healing: {
        readonly role: "运行时自愈左分支，把错误栈映射回拓扑节点并生成修复提示词。";
        readonly staticRightBranch: readonly ["diagnosis pipeline", "artifact writing"];
    };
    readonly HealingRightBranch: {
        readonly role: "运行时自愈右分支目录，集中保存错误分类规则、blast radius 策略和 healing prompt 固定规则。";
        readonly staticRightBranch: readonly ["classification regexes", "blast radius strategy", "prompt output rules"];
    };
    readonly Ir: {
        readonly role: "跨语言中间表示层，把语言 AST 映射为 Triad-IR。";
        readonly staticRightBranch: readonly ["TriadTopologyIR", "TriadIRNode", "TriadIREdge"];
    };
    readonly Parser: {
        readonly role: "源码拓扑抽取层，把当前语言源码抽取为 triad-map 叶节点。";
        readonly staticRightBranch: readonly ["language adapter", "JSDoc tags", "sourcePath"];
    };
    readonly Protocol: {
        readonly role: "协议编译器左分支，用 Schema 与拓扑规则拦截非法演化。";
        readonly staticRightBranch: readonly ["validation pipeline", "node parsing", "topology checks"];
    };
    readonly ProtocolRightBranch: {
        readonly role: "协议右分支目录，集中保存类型、Schema、操作枚举和类别映射。";
        readonly staticRightBranch: readonly ["Triad types", "Zod schemas", "prefix category map"];
    };
    readonly Rules: {
        readonly role: "Always-on 规则层，把顶点三元约束写入 AI 助手默认上下文。";
        readonly staticRightBranch: readonly ["AGENTS.md", ".cursor/rules/triadmind.mdc", "agent-rules.md"];
    };
    readonly Snapshot: {
        readonly role: "安全快照层，为 apply 和自愈循环提供可回滚边界。";
        readonly staticRightBranch: readonly ["snapshot index", "snapshot files", "restore manifest"];
    };
    readonly Stage: {
        readonly role: "阶段识别层，判断当前处于规划、审核、实现还是修复阶段。";
        readonly staticRightBranch: readonly ["StageAnalysisInput", "StageAnalysisResult"];
    };
    readonly Sync: {
        readonly role: "增量同步层，基于文件哈希保持 triad-map 与源码同步。";
        readonly staticRightBranch: readonly ["sync-manifest.json", "sha256 file digests"];
    };
    readonly TreeSitterParser: {
        readonly role: "Tree-sitter 解析层，为跨语言泛化提供统一 AST 路径。";
        readonly staticRightBranch: readonly ["tree-sitter grammar", "query patterns"];
    };
    readonly Visualizer: {
        readonly role: "拓扑审核层，把协议和现有地图渲染为知识图谱。";
        readonly staticRightBranch: readonly ["visualizer.html", "node status", "edge status"];
    };
    readonly Workflow: {
        readonly role: "多轮推演编排左分支，生成 Macro/Meso/Micro/Protocol/Handoff 提示词。";
        readonly staticRightBranch: readonly ["workflow execution pipeline"];
    };
    readonly WorkflowRightBranch: {
        readonly role: "工作流右分支目录，集中保存协议模板、阶段规则和提示词固定结构。";
        readonly staticRightBranch: readonly ["draft templates", "stage router rules", "prompt shapes"];
    };
    readonly Workspace: {
        readonly role: "工作区路径层，统一描述 .triadmind 文件系统边界。";
        readonly staticRightBranch: readonly ["WorkspacePaths", "projectRoot", ".triadmind paths"];
    };
};
/**
 * @RightBranch
 */
export declare function getSelfBootstrapNodeIds(): string[];
/**
 * @RightBranch
 */
export declare function getSelfBootstrapLoopLines(): string[];
/**
 * @RightBranch
 */
export declare function getSelfBootstrapMicroRules(): string[];
/**
 * @RightBranch
 */
export declare function getSelfBootstrapPreamble(): string;
