# TriadMind Core

> 拓扑架构治理引擎 —— 类 AST 分析但检查的是**模块之间的关系**，不是单文件内部的语法。

[![npm](https://img.shields.io/npm/v/triadmind-core)](https://www.npmjs.com/package/triadmind-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 目录

- [一句话说清](#一句话说清)
- [快速开始](#快速开始)
- [核心概念](#核心概念)
- [CLI 命令](#cli-命令)
- [Triad-Bootstrap：融合进 AI 编码助手](#triad-bootstrap融合进-ai-编码助手)
- [扫描引擎](#扫描引擎)
- [工作区文件说明](#工作区文件说明)
- [MCP Server](#mcp-server)
- [在 CI 中使用](#在-ci-中使用)
- [项目结构](#项目结构)
- [许可](#许可)

---

## 一句话说清

```
ESLint 检查你写的代码是否正确。
TypeScript 检查你的类型是否匹配。
TriadMind 检查你的架构是否仍然成立。
```

TriadMind 把代码库建模为**拓扑图**——每个文件、类、函数是一个顶点，调用关系是边。每次代码变更后重新扫描，检测以下不可被 lint 工具捕获的问题：

| 检查项 | 检测什么 | 为什么 lint 发现不了 |
|--------|---------|---------------------|
| Ghost 节点 | 定义了但从未被调用的函数/类 | lint 只看单文件，不知道谁调用了谁 |
| 合约断裂 | 函数签名变了但调用方没更新 | TypeScript 能检测大部分，但运行时注入/动态 dispatch 的路径检测不到 |
| 循环依赖 | A → B → C → A | import 循环 lint 能测，但跨文件**运行时**依赖链不行 |
| 未匹配路由 | API 定义了但前端没调用 | 前后端在不同仓库/language，lint 工具无法跨栈检测 |
| 架构漂移 | 模块职责边界随时间推移的偏移 | 需要对比历史拓扑快照 |

---

## 快速开始

```bash
npm install -g triadmind-core

cd 你的项目
triadmind init                # 创建 .triadmind 配置
triadmind sync                # 扫描代码库，构建拓扑图
triadmind verify              # 检查架构健康度
triadmind plan --no-open      # 生成 .triadmind/visualizer.html
```

完成后，打开 `.triadmind/visualizer.html` 可以看到整个项目的拓扑结构。

---

## 核心概念

### 顶点三元法（Vertex Triad）

每个软件模块被建模为一个**顶点**，包含左右两个分支：

```
           Vertex
          /      \
    Left Branch  Right Branch
     (Action)     (State)
```

| 尺度 | 顶点 | 左分支 | 右分支 |
|------|------|--------|--------|
| 微观 | 一个类/函数 | 方法、执行逻辑 | 属性、配置、类型 |
| 中观 | 一个子功能模块 | 具体执行的函数 | 流程编排、参数约束 |
| 宏观 | 前后端协同流程 | 参与执行的功能节点 | 数据管道、交互协议 |

这个模型来自面向对象编程的自然推广：**类是顶点，方法是左分支，属性是右分支**。TriadMind 把这一原则推广到任意尺度。

### 三种拓扑操作

每次架构变更只能使用以下三种操作之一：

| 操作 | 含义 | 示例 |
|------|------|------|
| `REUSE` | 复用已有节点，不修改 | 用现有的 `match_order_core()` 而不是写新的 |
| `MODIFY` | 扩展已有节点的接口 | `match_order_core()` 增加一个可选参数 |
| `CREATE_CHILD` | 在现有节点下新建子节点 | 在 `backtest_engine` 下创建 `backtest_explainer` |

强制规则：**优先 REUSE，其次 MODIFY，仅当拓扑无法承载时才 CREATE_CHILD。**

---

## CLI 命令

### 工作区

```bash
triadmind init                    # 初始化
triadmind sync                    # 扫描拓扑
triadmind sync --force            # 强制重建
triadmind watch start             # 文件监听自动同步
triadmind watch stop
```

### 架构检查

```bash
triadmind verify                  # 全量校验
triadmind verify --focus impact   # 只校验变更影响
triadmind verify --full           # 全项目 + 运行时
triadmind govern check            # 合规检查
triadmind govern fix              # 生成修复 patch
triadmind trend                   # 架构漂移报告
triadmind coverage                # 拓扑覆盖率
```

### 拓扑规划

```bash
triadmind prompt                  # 生成 master-prompt.md（给 AI 用）
triadmind pipeline                # macro → meso → micro 多轮裂变
triadmind macro                   # 宏观寻址
triadmind meso                    # 中观裂变
triadmind micro                   # 微观具象
```

### 可视化

```bash
triadmind visualize --view architecture   # 架构拓扑图
triadmind visualize --view leaf           # 叶节点拓扑图
triadmind runtime                          # 运行时调用链拓扑
triadmind runtime --visualize              # 运行时拓扑可视化
triadmind runtime --include-frontend       # 包含前端代码
```

### 导航与影响分析

```bash
triadmind navigate "添加积分系统"          # 预实现影响分析
triadmind view-map                         # 跨视图映射
triadmind renormalize                      # 循环依赖检测 + 修复协议
```

### 抽象记忆（防止重复造轮子）

```bash
triadmind memory sync                      # 建立抽象记忆
triadmind memory search "撮合引擎"         # 搜索可复用节点
triadmind memory recommend                 # AI 推荐可复用抽象
triadmind memory toolkit sync              # 导出为项目抽象工具包
triadmind memory toolkit search "数据管道" # 搜索工具包
```

### Dream 自动治理

```bash
triadmind dream                           # 手动触发一次分析
triadmind dream fast                      # 快速模式
triadmind dream daemon start              # 后台定时巡检
triadmind dream daemon stop
triadmind dream daemon status
triadmind dream rules                     # 查看自动生成的架构规则
```

---

## Triad-Bootstrap：融合进 AI 编码助手

TriadMind 可以和任何 AI 编码助手集成。在 DeepSeek-Reasonix 中的集成称为 **Triad-Bootstrap**，它在三个层面注入拓扑约束：

### 第一层：Brainstorming 拓扑化

AI 的系统提示词中注入拓扑规则，强制 AI 在给出任何设计方案时使用顶点三元法思考：

```
# TriadMind Topology Rules — enforced in every code-change response

Before writing any code, classify every proposed change:
  [REUSE]    — call existing node without modifying it
  [MODIFY]   — extend existing node's interface
  [CREATE_CHILD] — new node under existing parent

Hard constraint: NO ORPHAN NODES.
Every CREATE_CHILD must identify its parent.
```

### 第二层：计划步骤强制打标签

`submit_plan` 的每个步骤新增 required `topology` 字段。AI 输出的计划步骤必须携带拓扑标签：

```json
{
  "steps": [
    { "id": "step-1", "title": "复用撮合核心", "action": "...", "topology": "REUSE" },
    { "id": "step-2", "title": "扩展成本模型", "action": "...", "topology": "MODIFY" },
    { "id": "step-3", "title": "新建解释器",   "action": "...", "topology": "CREATE_CHILD" }
  ]
}
```

### 第三层：子智能体提交前检查

子智能体完成代码后，TriadMind 运行快速结构校验：

- 是否有新函数未被调用（ghost node）
- 是否有循环依赖
- 是否有配置代码错误地引用了业务执行代码

不通过则拒绝合并。

### 集成代码

```typescript
// src/prompt-fragments.ts — 系统提示词片段
export const TRIADMIND_TOPOLOGY_RULES = `...`;

// src/code/prompt.ts — 注入系统提示词
${TRIADMIND_TOPOLOGY_RULES}

// src/tools/plan-core.ts — 计划步骤 schema
topology: { type: "string", enum: ["REUSE", "MODIFY", "CREATE_CHILD"] }
```

---

## 扫描引擎

### 多语言支持

TriadMind 通过 tree-sitter 解析源码，支持以下语言的**非 AST 级扫描**：

| 语言 | 适配器 | 覆盖 |
|------|--------|------|
| TypeScript / JavaScript | `typescriptParser.ts` | 函数、类、方法、接口、导入/导出 |
| Python | `treeSitterPythonSupport.ts` | 函数、类、方法、装饰器、导入 |
| Go, Rust, C++, Java | `polyglotAdapter.ts` | 统一 polyglot 提取 |

### 扫描流程

```
源码文件
  → tree-sitter AST 解析
    → 节点提取（函数/类/方法/导入/回调）
      → topology map 构建（顶点 + 边）
        → 可视化 / 校验 / Dream 分析
```

### 运行时拓扑

除了编译时拓扑（静态分析），TriadMind 还可以构建运行时拓扑：

- HTTP 路由提取（从 FastAPI/Express 等框架）
- 前端 API 调用提取（从 fetch/axios/useQuery 等）
- 数据库访问提取
- 任务队列提取

用 `triadmind runtime` 命令触发。

---

## 工作区文件说明

每个使用 TriadMind 的项目在 `.triadmind/` 目录下维护拓扑状态：

### 配置层

| 文件 | 作用 |
|------|------|
| `config.json` | 扫描规则、排除路径、可视化参数、language adapter 选择、Dream 调度策略 |
| `profile.json` | 目录分类（哪些是 API、services、UI、tests），决定节点类别归属 |
| `govern-policy.json` | 治理规则：允许/禁止的拓扑结构、合约断裂的容忍度 |

### 拓扑数据层

| 文件 | 内容 |
|------|------|
| `leaf-map.json` | 叶节点映射 —— 所有函数的调用关系（微观层） |
| `triad-map.json` | 能力节点映射 —— 功能模块的依赖关系（中观层） |
| `runtime-map.json` | 运行时调用关系 |
| `view-map.json` | 跨视图（前后端/语言）映射 |

### AI 协议层

| 文件 | 作用 |
|------|------|
| `triad.md` | 核心提示词 —— 约束 AI 如何进行拓扑裂变 |
| `master-prompt.md` | 为 AI 会话生成的完整拓扑上下文（`triadmind prompt` 命令产出） |
| `draft-protocol.json` | 裂变协议草案（AI 生成的拓扑变更计划） |

### 诊断层

| 文件 | 作用 |
|------|------|
| `visualizer.html` | 架构拓扑可视化（可拖拽、搜索、展开） |
| `runtime-visualizer.html` | 运行时拓扑可视化 |
| `dream-proposals.json` | Dream 引擎的架构优化建议 |
| `triad-diagnostics.json` | 完整诊断报告 |

---

## MCP Server

TriadMind 可以作为 MCP (Model Context Protocol) server 运行，让任何 MCP 兼容的 AI 工具直接使用：

```bash
triadmind-mcp
```

暴露的工具包括所有 CLI 命令对应的 MCP tools：`triadmind_sync`、`triadmind_verify`、`triadmind_navigate`、`triadmind_memory_search` 等 20+ 个工具。

---

## 在 CI 中使用

```yaml
# .github/workflows/triadmind-verify.yml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with: { node-version: 22 }
  - run: npm install -g triadmind-core
  - run: triadmind sync
  - run: triadmind verify --strict
```

`verify --strict` 在发现问题时返回非零退出码，阻止合并。

---

## 项目结构

```
triadmind-core/
├── cli.ts                             # CLI 入口
├── config.ts                          # 配置加载
├── analyzer.ts                        # 源码解析 + 拓扑构建 (56KB)
├── visualizer.ts                      # 可视化生成 (79KB)
│
├── triadization.ts                    # 三元化协议引擎
├── triadizationAnalysis.ts            # 拓扑分析
├── triadizationFocus.ts               # 焦点裂变
│
├── navigate.ts / navigatorLlm.ts      # 影响分析 + LLM 辅助
├── dream.ts                           # Dream 引擎 (70KB)
│   ├── dreamDaemon.ts                 # 后台守护
│   ├── dreamScheduler.ts              # 定时调度
│   ├── dreamRuleExtractor.ts          # 规则提取
│   └── dreamFeedbackValidator.ts      # 反馈校验
├── govern.ts                          # 治理引擎 (41KB)
├── verify.ts                          # 校验引擎 (36KB)
├── coverage.ts                        # 覆盖率
├── trend.ts                           # 漂移分析
│
├── treeSitterParser.ts                # tree-sitter 解析 (291KB)
├── treeSitterGhostScanner.ts          # Ghost 节点扫描
├── polyglotAdapter.ts                 # 多语言适配
├── typescriptParser.ts / typescriptGenerator.ts
├── treeSitterPythonSupport.ts
│
├── abstractionMemory.ts               # 抽象记忆
├── projectAbsToolkit.ts               # 项目工具包
│
├── runtime/                           # 运行时拓扑
│   ├── collectRuntimeSourceFiles.ts
│   ├── extractRuntimeTopology.ts
│   ├── runtimeVisualizer.ts
│   └── extractors/
│       ├── httpRouteExtractor.ts
│       ├── frontendApiCallExtractor.ts
│       ├── resourceAccessExtractor.ts
│       └── taskQueueExtractor.ts
│
├── src/mcp-server.ts                  # MCP 协议服务器
│
├── tests/ (43 files)                  # Vitest 测试套件
├── docs/                              # 设计文档
│   ├── capability-topology-spec.md
│   └── abstraction-governance-epic.md
└── templates/bootstrap/               # 初始化脚手架模板
```

---

## 许可

MIT
