# 02 - 发布 repo-first 工作流 Surface

**交付内容：** 精简 AGENTS 入口、领域词汇、缺口 skill、工作流/证据规则、架构决策和仓库 validator，且不复制 Matt skill。

**Blocked by:** 01 - 建立 Matt-first 工作流契约。

**Status:** done

- [x] Agent 入口只在对应分支适用时加载详细规则。
- [x] 项目自有 skill 名不得覆盖 Matt capability。
- [x] Human QA、delivery verification 与 reasoning evidence 是显式缺口 skill。
- [x] 缺少 canonical surface 时仓库验证大声失败。

## 证据

RED/GREEN 命令、capability provenance 与 review 修复见 [`docs/evidence/bootstrap.md`](../../../docs/evidence/bootstrap.md)。
