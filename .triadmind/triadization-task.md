# Triadization Task

- Project: DeepSeek-Reasonix
- Generated At: 2026-05-20T01:54:09.669Z
- Target Node: McpSpec.module_pipeline
- Operation: split
- Scale: capability
- Diagnosis: overloaded_vertex, left_right_mixing
- Blast Radius: 113

## Confirmation
确认先对节点 McpSpec.module_pipeline 执行 split，并据此继续 Macro / Meso / Micro 吗？

## Rationale
节点 McpSpec.module_pipeline 同时呈现编排语义和高扇出下游（84 个），很可能把顶点、左分支执行和右分支约束混在了一起，应该先做 split。

## Evidence
- Downstream fanout: 84
- Top downstreams: Abort.module_pipeline, Acp.loadMcpServers, CheckpointCreate.module_pipeline, CheckpointDelete.module_pipeline, CheckpointDiffs.module_pipeline, CheckpointRestore.module_pipeline

## Controlled Evolution
1. [macro] 确认当前挂载点: 确认 McpSpec.module_pipeline 是否仍是本轮挂载点，并切出左分支子功能与右分支约束。
2. [meso] 拆出子能力与编排件: 把执行动作、策略编排和配置状态拆成更清晰的能力节点与数据管道。
3. [micro] 标注静态右支与动态左支: 为核心类补齐属性 / 状态与方法 / 动作的显式分支边界。
4. [protocol] 写入最小演进协议: 优先生成可审阅的最小 split 协议，而不是一次性扩题。
5. [verify] 检查扇出是否下降: 刷新 triad-map 并确认切分后没有新增 drift。