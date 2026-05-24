# TriadMind Dream Feedback & Evolution - TODOs

## 下周开发计划 (Next Week's Development Plan)

- [ ] **自动规则提炼 (Auto Rule Extraction)**: 实现一个 LLM 调用或 Agent 步骤，在用户驳回 dream proposal 时，自动将用户的自然语言 `reason` 提炼为简明扼要的 `extractedRule`。
- [ ] **CLI/UI 交互集成 (CLI/UI Integration)**: 更新驳回工作流（CLI 命令或 VSCode 插件），确保在记录驳回时能够捕获并保存 `extractedRule` 到 `dream-feedback.json` 账本中。
- [ ] **规则生命周期管理 (Rule Lifecycle Management)**: 设计一种机制来处理过时或冲突的规则（例如：规则过期机制、允许手动编辑/归档 ledger 中的规则，或新规则覆盖旧规则）。
- [ ] **Prompt 注入测试 (Prompt Injection Testing)**: 验证 Master Prompt 中的 `CRITICAL_CONSTRAINTS_FROM_PAST_MISTAKES` 部分是否能有效阻止 AI 在后续的 proposal 中犯同样的架构错误。
