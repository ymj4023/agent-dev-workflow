# Agent 研发工作流

本上下文定义 AI 辅助软件研发从想法走向可接受变更时使用的稳定概念。

## 统一词汇

**Terminology alignment（术语对齐）**：
在需求盘问前，对每个核心术语逐一确认定义、适用范围、排除范围和歧义/易混概念，并获得人类显式确认。
_Avoid_：边问需求边猜术语、用同一个词表达多个概念

**Destination（目标态）**：
一项工作的约定结果、成功标准和明确排除项。
_Avoid_：大计划、总规格

**Journey（交付路径）**：
抵达 Destination 的小型、可独立验证 ticket 及其依赖图。
_Avoid_：阶段清单、任务堆积

**Vertical slice（纵向切片）**：
一个狭窄 ticket，通过可行的最高测试缝产生可观察行为。
_Avoid_：分层任务、集中测试批次

**Feedback loop（反馈环）**：
能够快速证伪当前实现的确定性命令或观察。
_Avoid_：信心检查

**Gate（闸门）**：
由可检查证据决定工作能否跨越阶段边界的显式条件。
_Avoid_：普通检查项

**Provider（能力提供方）**：
已安装的能力来源，例如 Matt Skills 或可选 ECC 集成。
_Avoid_：框架、运行时

**Adapter（适配器）**：
把 Provider 或托管平台薄映射到本工作流，但不拥有工作流本身。
_Avoid_：集成层

**Ownership ledger（所有权账本）**：
installer 在目标 Git 仓库中保存的相对路径、管理方式与 SHA-256 清单，用于区分可安全更新/删除的托管文件和必须保留的项目自管文件。
_Avoid_：安装日志、目标仓库全量文件清单

## 边界与不变量

- Align 内部顺序固定为术语对齐、需求盘问、边界澄清；术语未全部确认时不得进入 Matt grilling。
- Matt Skills 拥有默认的对齐、规格、切片、实现/TDD 与自动审查主干。
- 项目只补人类 QA、证据、交付验证和薄适配，不复制 Provider 内容。
- 持久状态必须进入 Git、项目 tracker、PR/MR 历史或 CI 产物。
- 本地 hook 只能提前反馈，CI 和人工授权才拥有最终交付决定权。
- Installer 默认不覆盖未托管文件；repair 与 uninstall 的权限以 ownership ledger 和当前内容哈希共同决定。
