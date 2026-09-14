# agent-dev-workflow 中文使用说明

[项目首页](README.md) | 中文主说明

这是一套以 Matt Pocock Skills 为主干、以 Git 仓库为资产中心的 AI 开发工作流。它不引入新的 Agent runtime，也不把 ECC、OpenSpec、Multica 或远程调度强行塞进核心流程。

## 先理解它是什么

```text
Align → Destination → Journey → Implement → Auto Review → Human Acceptance → Verify & Merge
```

这条链解决的是“开发工作如何稳定落地”，不是“如何启动一个 Agent”。

- `Align` 到 `Auto Review` 的主干由 Matt Skills `v1.2.3+` 提供；
- 本项目补齐推理证据、人工 QA、交付验证、递归 Context/ADR Map 和确定性检查；
- ECC `v2.2.0+` 是可选 Provider，只映射能力，不复制文件、不成为前置条件；
- 任务资产留在 Git、项目 tracker、PR/MR 和 CI，而不是某个人的会话或个人 harness。
- Align 内部顺序固定为“术语对齐 → 需求盘问 → 边界澄清”；术语未全部确认前不得开始 grilling。

## 5 分钟开始

### 第一步：确认运行环境

本仓库是 Node.js 标准库脚本，没有依赖安装步骤。先确认 Node.js 22 或更高版本：

```bash
git clone https://github.com/ymj4023/agent-dev-workflow.git
cd agent-dev-workflow
node --version
```

然后在本仓库根目录运行最小自检：

```bash
npm test
npm run coverage
npm run validate
npm run doctor
npm run verify
```

不用先运行 `npm install`。如果 `node` 命令不存在，先安装 Node.js 22+；如果 `doctor` 报 Matt skill 缺失，先安装 Matt Skills，再重新运行 `doctor`。

### 第二步：准备 Matt Skills

本项目不 vendor Matt 的 skill 内容，只验证它们是否已经安装并且来源可信。必需清单是：

```text
grill-with-docs  domain-modeling  to-spec  to-tickets
implement        tdd              code-review
```

按照 [Matt Pocock Skills 官方仓库](https://github.com/mattpocock/skills) 的当前安装说明完成安装。安装后运行：

```bash
npm run doctor
```

安装在非默认目录时：

```bash
MATT_SKILLS_DIR=<Matt skills 目录> npm run doctor
```

`doctor` 的判断不是“目录里有同名文件就算成功”，而是同时检查：

1. 7 个 `SKILL.md` 是否存在；
2. lock 中的 `source` 是否为 `mattpocock/skills`；
3. lock 中的版本是否不低于 `v1.2.3`。

ECC 的 `verification-loop`、`eval-harness`、`security-review`、`contract-first` 缺失时只报告 optional gap。它们不能替代 Matt，也不会阻断核心工作流。

### 第三步：把工作流接到业务仓库

在工作流仓库根目录先预览初始化计划：

```bash
node scripts/adw.mjs install <你的项目目录> --dry-run
```

dry-run 不写任何文件，会为 manifest 中的每个资产输出 action：

- `create`：目标不存在，可以由 installer 创建；
- `preserve-unowned`：目标已有同名文件但不属于 installer，必须人工处理；
- `unchanged`：已安装且内容一致；
- `restore`：托管文件缺失，可以安全恢复；
- `review-update`：上游有新版本，但 installer 不自动覆盖，必须人工比对；
- `preserve-modified`：托管文件被项目修改，必须保留并人工判断。

如果计划全部可创建，执行：

```bash
node scripts/adw.mjs install <你的项目目录>
node scripts/adw.mjs status <你的项目目录>
```

如果出现 `preserve-unowned`，先逐个比较源文件和目标文件，把需要的工作流入口手工合并进去。确认这些冲突文件以后由项目自己维护，再执行：

```bash
node scripts/adw.mjs install <你的项目目录> --accept-existing
node scripts/adw.mjs status <你的项目目录>
```

`--accept-existing` 会一次性接受 dry-run 中所有未托管冲突。它只登记当前 SHA-256，不取得这些文件的删除或覆盖权：repair 永不覆盖，uninstall 永不删除。因此必须先逐个审查，不能用它掩盖未完成的合并。

material 这类已有 `AGENTS.md`、根 Map、`docs/agents/` 和领域 Map 的成熟仓库，首次 dry-run 出现多个 `preserve-unowned` 是预期行为。应把本工作流新增的术语前置顺序、工作流入口和直接子 Map 链接合并进现有文件，而不是覆盖 material 已沉淀的业务内容。未使用 `--accept-existing` 前，只要有一个未托管冲突，普通 install 就整体不写入，避免产生半安装状态。

ownership ledger 位于目标仓库 `.agent-dev-workflow/ownership.json`，只保存相对路径、源路径、管理方式和 SHA-256，不记录本机绝对路径。

更新与卸载：

```bash
node scripts/adw.mjs status <你的项目目录>
node scripts/adw.mjs repair <你的项目目录> --dry-run
node scripts/adw.mjs repair <你的项目目录>
node scripts/adw.mjs uninstall <你的项目目录> --dry-run
node scripts/adw.mjs uninstall <你的项目目录>
```

`repair` 只自动恢复缺失文件。`outdated` 必须人工比对：可以删除旧托管文件后执行 repair，或手工替换成新源内容后再次运行 install/repair 更新 ledger。用户修改过的文件会保留并返回 `NOT_READY`。`uninstall` 只有在 ledger 哈希、当前文件哈希和当前 manifest 源哈希三者一致时才删除；项目自管、已修改、过期或 retired 文件都会保留。

installer 安装以下工作流资产：

| 资产 | 用途 |
| --- | --- |
| `AGENTS.md` | Agent 工作入口与术语前置规则 |
| `CONTEXT-MAP.md`、`ADR-MAP.md` | 递归知识和决策入口 |
| `docs/agents/`、`docs/contexts/`、`docs/adr/` | tracker、领域上下文与架构决策基线 |
| `manifests/workflow.json` | 七阶段机器契约 |
| `rules/workflow.md`、`rules/evidence.md` | 跨阶段不变量与证据纪律 |
| 三个 `skills/*` | 推理证据、人工 QA 与交付验证 |

installer 不会自动接入业务项目的 CI、测试命令或 harness hook，这些必须根据项目技术栈配置。

如果只想人工接入，目标项目记作 `<你的项目目录>`，工作流仓库记作 `<工作流仓库目录>`。先查看目标项目是否已有同名入口：

```bash
diff -u <你的项目目录>/AGENTS.md <工作流仓库目录>/AGENTS.md
diff -u <你的项目目录>/CONTEXT-MAP.md <工作流仓库目录>/CONTEXT-MAP.md
diff -u <你的项目目录>/ADR-MAP.md <工作流仓库目录>/ADR-MAP.md
```

然后按职责接入：

| 资产 | 接入方式 | 目的 |
| --- | --- | --- |
| `AGENTS.md` | 手工合并工作流入口，不覆盖原有项目规则 | 告诉 Agent 先读什么、何时停下来等人批准 |
| `CONTEXT-MAP.md`、`ADR-MAP.md` | 放在目标项目根目录 | 建立递归知识和决策入口 |
| `docs/contexts/`、`docs/adr/` | 放入目标项目对应目录，再添加业务分支 | 保存团队可见的领域上下文和 ADR |
| `rules/workflow.md`、`rules/evidence.md` | 复制或按项目规则合并 | 固化跨阶段不变量与证据格式 |
| `skills/reasoning-evidence/`、`skills/human-qa/`、`skills/delivery-verification/` | 复制到项目 `skills/` | 补 Matt 主干没有覆盖的能力 |
| `hooks/` | 只有目标 harness 支持并能阻断退出码 `2` 时接入 | 提前反馈，不取代 CI |

不要把本仓库的 `npm run verify` 直接当作任意业务仓库的 verifier。它当前校验的是本仓库的 canonical surfaces；业务项目仍必须运行自己的 test、lint、build、security 和 E2E。

接入后的最小形态：

```text
<你的项目目录>/
├── AGENTS.md
├── CONTEXT-MAP.md
├── ADR-MAP.md
├── docs/contexts/
├── docs/adr/
├── rules/workflow.md
├── rules/evidence.md
└── skills/
```

### 第四步：创建第一个工作项

本仓库默认支持项目内 Markdown tracker：

```bash
mkdir -p .scratch/<feature>/issues
```

创建两个文件：

`.scratch/<feature>/spec.md`：

```markdown
# Destination

## 目标
- 交付什么可观察结果

## 成功标准
- 用户或系统如何确认成功

## 测试缝
- 最快能证伪实现的测试入口

## 非目标
- 本次明确不做什么
```

`.scratch/<feature>/issues/01-<slug>.md`：

```markdown
# 01 - 第一个纵向切片

**Status:** ready-for-agent
**Blocked by:** None

## 交付
- 一个可观察行为

## 接受标准
- 可执行的测试或人工判断
```

如果团队已经使用 GitHub Issues，应先把 `docs/agents/issue-tracker.md` 改成对应 tracker 契约，不要同时保留两个 canonical 来源。

## 一张 ticket 的完整操作顺序

### 1. Align：先统一术语，再盘问需求

准确地说，Align 不是一上来就 grill，而是严格分成三步：

```text
术语对齐 → 需求盘问 → 边界澄清
```

第一步先提取需求中的核心术语。对每个术语逐一确认：

1. **定义**：这个词在本需求中具体指什么；
2. **适用范围**：哪些对象、场景、阶段属于它；
3. **排除范围**：哪些相似对象或场景明确不属于它；
4. **歧义/易混概念**：它可能与哪些词混用，不同角色是否有不同理解；
5. **确认状态**：人类是否已经明确接受该定义。

建议输出：

| 术语 | 定义 | 适用范围 | 排除范围 | 歧义/易混概念 | 确认状态 |
| --- | --- | --- | --- | --- | --- |
| `<术语>` | `<这个词具体指什么>` | `<哪些场景属于>` | `<哪些场景不属于>` | `<容易与什么混淆>` | `待确认/已确认` |

只有所有核心术语都得到人类显式确认后，才进入第二步需求盘问；需求盘问完成后，第三步再明确边界。不得把三个步骤合并或调换。

在 AI harness 中输入：

```text
请先读取 AGENTS.md，然后只沿当前 ticket 相关的 CONTEXT-MAP.md 与 ADR-MAP.md 递归读取。
先只做术语对齐：列出核心术语，并逐一确认定义、适用范围、排除范围、歧义或易混概念。
把结果整理成术语表，逐项等我确认。全部术语确认前，不要调用 grill-me、grill-with-docs 或 /grilling，
也不要开始需求澄清。术语统一后，再依次进行需求盘问和边界澄清；不要写代码。
```

这里的 `grill-me` 泛指 Matt 的需求盘问入口；本工作流默认使用能同时运行 `domain-modeling`、沉淀 ADR 和 glossary 的 `grill-with-docs`。二者都必须排在术语对齐之后。

### 2. Destination：把共识写成结果

确认 Align 后再要求 Agent 使用 `to-spec` 更新 `spec.md`。必须写清：结果、成功标准、测试缝、非目标、未知项。没有这些内容，不进入实现。

### 3. Journey：拆成纵向 ticket

要求 Agent 使用 `to-tickets` 更新 `.scratch/<feature>/issues/`。每个 ticket 必须能通过最高可行测试缝产生可观察行为，并写明 `Blocked by`。人类批准 ticket 顺序和依赖边后，才进入 AFK 实现。

### 4. Implement：一次一个 ticket

用 `implement` + `tdd`，遵循：

1. 先写能说明意图的失败测试；
2. 确认测试因预期原因 RED；
3. 写最小实现让它 GREEN；
4. 运行同一反馈环，记录命令、结果和 diff；
5. 不把多个 ticket 混进一个 fresh context。

### 5. Auto Review：换 fresh context

实现完成后，在新的上下文运行 `code-review`。审查要看完整 diff、测试价值、接口、错误处理、安全和是否越过 ticket 范围。阻断 finding 必须修复或留下明确的 out-of-scope 决策。

### 6. Human Acceptance：四个问题都要有答案

使用 `human-qa`，逐项回答：

1. 行为是否解决 Destination？
2. 测试是否覆盖了有价值的行为？
3. 接口和失败模式是否容易理解？
4. 在真实环境中是否可用、可接受？

任何 rejected 或新发现行为都转成新的 Journey ticket；不要静默修改原 Destination。

### 7. Verify & Merge：证据齐全才合并

使用 `delivery-verification`，运行目标项目真实的 test、lint、build、security、集成测试和 E2E。每项记录 `PASS`、`FAIL` 或 `UNVERIFIED`。本地 hook 失败时退出码 `2`，CI 仍是最终合并 Gate。

## 本仓库命令对照

| 命令 | 你什么时候运行 | 它检查什么 |
| --- | --- | --- |
| `npm test` | 改代码、manifest、Map 或测试后 | 所有 Node 测试 |
| `npm run coverage` | 提交前 | 80% line/function 门槛 |
| `npm run validate` | 改 workflow manifest 后 | 阶段、依赖、Provider 和 Gate |
| `npm run doctor` | 安装/升级 Matt 或 ECC 后 | capability 文件、来源、版本和 optional gap |
| `npm run verify` | 提交前和 CI 中 | 本仓库文件、Map、skill 与集成契约 |
| `node hooks/shared/delivery-guard.mjs` | harness Stop hook 中 | `verify --json`，失败则 fail closed |
| `node scripts/adw.mjs install <repo> --dry-run` | 首次初始化前 | 列全路径与 action，不写文件 |
| `node scripts/adw.mjs install <repo>` | dry-run 审查后 | 无冲突才写入；有冲突整体停止 |
| `node scripts/adw.mjs status <repo>` | 安装后或升级前 | 检查 current/missing/outdated/modified/unowned |
| `node scripts/adw.mjs repair <repo>` | status 发现缺失资产时 | 恢复缺失；outdated/modified 必须人工处理 |
| `node scripts/adw.mjs uninstall <repo>` | 移除工作流资产前 | 只删除未修改的托管文件 |

## 递归 Context/ADR 怎么扩展

```text
CONTEXT-MAP.md → docs/contexts/CONTEXT-MAP.md → <领域>/CONTEXT-MAP.md → CONTEXT.md
ADR-MAP.md     → docs/adr/ADR-MAP.md         → <领域>/ADR-MAP.md         → 0001-*.md
```

每个 Map 只列直接子 Map 或直接叶子。新增领域时只更新直接父 Map，不把孙级文件抄到根 Map。`verify` 会拒绝缺失目标、重复链接、跨级链接、绝对/Windows/外部路径以及未被 Map 访问的 orphan 文档。

## Hook、CI 与边界

- hook 是本地半硬性拦截，可能被 harness 外关闭或绕过；CI 才是合并权威；
- GitHub Actions 执行 coverage 和 repository verification；
- ECC 只提供可选增强，缺失不会使 Matt-first 主流程失效；
- 当前不提供远程 Agent 调度、issue control plane、自动语义合并，也不替代业务仓库的构建和 E2E。

## 架构资产

![agent-dev-workflow 架构图](docs/assets/agent-dev-workflow-architecture.png)

[交互式架构图](docs/assets/agent-dev-workflow-architecture.html)
