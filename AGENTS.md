# Agent Dev Workflow

本文是 Agent 的项目入口地图，只保留工作入口、硬性规则与递归文档导航；详细说明放在对应文档中。

## 工作入口

- Issue：当前使用 `.scratch/` 下的项目内 Markdown，规则见 `docs/agents/issue-tracker.md`。
- 分诊：使用 Matt 的标准角色标签，映射见 `docs/agents/triage-labels.md`。
- 阶段契约：`manifests/workflow.json`。
- 跨阶段不变量：`rules/workflow.md` 与 `rules/evidence.md`。
- 初始化：先运行 `node scripts/adw.mjs install <target> --dry-run`；只在逐个审查冲突后执行安装。ownership ledger 中标记为项目自管或内容已修改的文件不得覆盖或删除。

## 上下文与 ADR

领域上下文必须从根目录 `CONTEXT-MAP.md` 进入，架构决策必须从根目录 `ADR-MAP.md` 进入。沿当前任务相关的分支逐级读取，不得绕过 Map 无差别扫描所有 Context 或 ADR。具体规则见 `docs/agents/domain.md`。

## 研发流程

功能交付遵循 `manifests/workflow.json` 定义的 Matt-first 阶段。项目自有 skill 只能补缺口，不得覆盖 Matt skill。

进入需求盘问前，先列出核心术语，并逐一与人类确认定义、适用范围、排除范围和歧义/易混概念。全部术语确认后，才允许调用 `grill-me`、`grill-with-docs` 或 `/grilling` 澄清需求；需求澄清后再明确边界。不得把这三个步骤合并或调换。

声称完成前，必须遵循 `skills/delivery-verification/SKILL.md` 和 `rules/evidence.md`；进入人工接受阶段时使用 `skills/human-qa/SKILL.md`。
