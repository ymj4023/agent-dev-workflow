# 从重型 Multica 编排到 repo-first Agent 开发工作流

**分析对象：** `openspec-superpowers-4-multica`、`multica-e2e-fixture` 与 `agent-dev-workflow v1.0.0`

**分析方法：** 第一性原理 + MECE

**结论性质：** 架构判断与迁移基线，不替代各仓库的 README、ADR 或执行手册

## 1. 结论先行

原 Multica + OpenSpec + 汽车人方案解决了真实问题：需求需要澄清、任务需要分解、实现需要测试、阶段需要验收、失败需要回路。但它把这些问题绑定成了一套过重的平台编排：工作流、角色、状态机、规格格式、issue 树和运行平台互相耦合，导致迁移困难、维护面过大，并把本应属于团队的资产留在个人 Multica workspace 中。

最核心的问题不是“规则太多”，而是**所有权放错了地方**：

- 开发工作流不应由 Multica、Codex、Claude Code 或任意 harness 所有；
- 需求、上下文、ADR、ticket、验证证据应由 Git 仓库及团队 tracker 所有；
- Matt Pocock Skills 已经覆盖的主流程不应重新实现；
- ECC 中好用的目录组织、验证、安全和 hook 思路可以借鉴，但不应把整个 ECC 嵌入核心；
- Multica、GitHub `gh-aw`、GitHub Actions/webhook、Symphony 都应只是可替换的远程执行 Adapter；
- 约束只是开发工作流的一部分，不能反过来把产品定义成“约束系统”。

因此，目标形态不是另造一个 Agent 平台，而是建立一层轻量的 `agent-dev-workflow`：

```text
Matt 提供开发主干
        +
仓库保存团队资产与确定性契约
        +
Codex / Claude Code 提供本地执行和原生多 Agent
        +
CI、人工审批提供最终 Gate
        +
Multica / gh-aw / GitHub Actions / Symphony 按需接入远程执行
```

## 2. 术语统一

| 术语 | 本文定义 | 不包括 |
| --- | --- | --- |
| 开发工作流 | 从需求进入到变更可合并的一组阶段、状态、证据和责任边界 | Agent runtime、模型路由、远程任务平台 |
| Provider | 提供某类能力的上游来源，如 Matt Skills、ECC | 工作流所有者 |
| Harness | 承载 Agent 会话、工具、权限和事件的执行环境，如 Codex、Claude Code | 团队资产的唯一存储 |
| Adapter | 把 Provider、harness 或远程平台映射到统一工作流的薄层 | 复制一整套上游实现的新框架 |
| Gate | 根据显式证据决定能否进入下一阶段的条件 | 提示词中的普通建议 |
| repo-first | 团队知识和交付状态以 Git、项目 tracker、PR/MR、CI 产物为事实源 | 所有运行时临时数据都必须提交 Git |
| Fixture | 用于验证平台能力的隔离靶场 | 通用开发工作流或完整 E2E 框架 |
| Multica | 可选的远程 Agent 执行与协作平台 | 核心流程、规格和团队资产的所有者 |

这些边界非常重要。过去的复杂性很大一部分来自把 Provider、Harness、Adapter 和 Workflow 当成了同一个东西。

## 3. 第一性原理

一个开发工作流的最终目的只有一个：**以可接受的成本，持续产出满足真实需求、可以验证、能够维护的变更。**

从这个目标反推，只需要回答六类互不重叠的问题：

1. **方向是否正确**：术语、问题、成功标准和非目标是否达成共识；
2. **任务是否可执行**：工作是否拆成有依赖关系的纵向切片；
3. **实现是否可信**：是否存在能快速证伪实现的测试缝和反馈环；
4. **结果是否可接受**：机器检查与人工产品判断是否都完成；
5. **状态是否可继承**：其他人换机器、换 harness 后能否从项目事实源继续；
6. **执行是否可替换**：本地、CI 或远程 Agent 是否可以执行同一份任务契约。

角色数量、Agent 名称、OpenSpec 文件数量、issue 层级和 stage 数量都不是目标。只有当它们能更低成本地回答上述问题时才有价值。

## 4. 对原 Multica 工作流的 MECE 点评

### 4.1 产品定位：工作流被平台化

原项目名义上维护开发工作流，实际交付物同时包含：

- Multica Agent 与 squad 配置；
- Agent system prompt 和 skill 绑定；
- OpenSpec schema、模板和制品 DAG；
- issue 状态机、stage 屏障、mention 唤醒与补救回路；
- 安装、同步、生成和平台退役脚本；
- 测试角色、实现角色、审查角色和调度角色。

这已经不是“一个开发工作流”，而是一个依赖 Multica 语义的微型 control plane。问题不在于它不能工作，而在于使用者必须接受整套平台模型，才能获得其中任何一个局部能力。

毒舌一点说：为了不漏掉一次状态转换，项目创造了足够多的新状态转换；为了确保每个角色各司其职，项目先制造了大量只能由这些角色处理的协调工作。

### 4.2 资产所有权：团队知识被留在个人 workspace

原方案的 issue、评论、Agent 配置、skill 副本和运行证据大量保存在各自的 Multica workspace 中。仓库虽然保存 OpenSpec 制品和部分报告，却无法仅凭 Git 重放完整流程。

这会造成四个直接问题：

- 新成员拿到仓库后看不到完整任务历史；
- 换 workspace 或平台后，issue 与 Agent 绑定无法自然迁移；
- 平台上的 skill 副本可能与仓库事实源漂移；
- 审计需要同时拼接 Git、Multica issue、评论、run 和个人环境。

Matt 一类 repo-first skill 的优势正在这里：规格、ticket 和上下文首先沉淀在项目，而不是某个使用者的私有控制面中。

### 4.3 需求阶段：有具体盘问法，但术语 Gate 原本不够明确

原项目并非只有抽象的“MECE、第一性原理”口号。`clarify` 与 `issue-brainstorming` 已经包含可执行做法：

- 先读取项目上下文；
- 将待决问题组织为决策树；
- 每轮只询问当前 frontier 上相互独立的问题；
- 问题全局编号并给出推荐项；
- 可查事实由 Agent 自查，只有判断交给人类；
- 每轮复述已确认答案；
- 直到不存在沉默假设后才通过确认闸门。

它的缺口是没有把“术语统一”明确建模为 `grill-me` 之前的独立阶段。需求双方可能用同一个词指不同对象，然后在错误概念上完成一整轮高质量盘问。

目标工作流因此强制：

```text
术语对齐 -> 需求盘问 -> 边界澄清
```

每个核心术语必须逐一确认定义、适用范围、排除范围、歧义或易混概念及确认状态。术语未全部确认前，不得调用 `grill-me`、`grill-with-docs` 或 `/grilling`。

### 4.4 Spec 阶段：OpenSpec 被当成默认前提，收益与任务规模失衡

OpenSpec 能提供正式结构、差量规格和审计轨迹，但它不是所有任务的必需条件。对于跨团队协议、复杂状态机、长期兼容约束，它可能值得；对于一个十四行脚本，它只是昂贵的仪式。

`multica-e2e-fixture` 给出了最直接的量化证据。一次问候脚本变更包含：

| 类别 | 行数 |
| --- | ---: |
| 实现脚本 | 14 |
| Bash 测试 | 93 |
| brainstorm/proposal/tasks/specs/verify | 294 |

该功能从 OpenSpec 初始化基线到 verify 共有 17 个提交：6 个 baseline、5 个 merge-in、3 个 OpenSpec、1 个测试、1 个实现、1 个验证。TDD 顺序正确，但编排成本完全失真。

结论不是“OpenSpec 无用”，而是**不得将 OpenSpec 设为核心前置条件**。默认规格阶段应使用 Matt 的 `to-spec` 和 `to-tickets`；只有项目本身需要 OpenSpec 时，才通过 Adapter 映射额外制品。

### 4.5 多 Agent：角色包装重复了 harness 原生能力

测试、实现、架构审查和代码审查确实适合不同上下文，但不需要永久建立“救护车、爵士、钛师傅”等平台角色才能做到。Codex 与 Claude Code 均能启动原生多 Agent，也可以定义 reviewer、test writer、security reviewer 等项目角色。

真正重要的是：

- 测试和实现的先后关系；
- reviewer 是否使用 fresh context；
- 每个角色能读写什么；
- finding 如何阻断合并；
- 证据最终保存在哪里。

角色的名字、人格和平台常驻配置都不是质量保证。把测试角色从 Multica Agent 改成 Codex reviewer 不会削弱契约；只要输入、权限、输出和 Gate 保持一致，执行者应当可替换。

### 4.6 状态机：确定性被误解成“更多流程状态”

原方案构造了 backlog、todo、in_progress、done、blocked、stage 屏障、两步恢复、mention 唤醒和 A/B/C 补救回路。它的优点是异常不会静默消失；缺点是大量故障来自编排本身，而不是业务实现。

历史复盘已经给出证据：一次 CLI 同步 change 使用 17 个 sub-issue，约 7.1 小时审计窗口；仅因为 chore 类任务没有预先声明测试豁免，就触发 4 次同型补救回路。流程正确拦住了流程自己制造的问题。

应保留的是依赖边、阻断 finding 和失败大声暴露；应删除的是为了迁就某个平台唤醒语义而进入核心模型的状态机细节。

### 4.7 远程执行：平台绑定很重，远程触发能力却不完整

Multica 配置占据了核心位置，但原方案没有形成一个平台无关的“项目 ticket -> 隔离 Agent run -> 证据回写”远程执行契约。与此同时：

- GitHub `gh-aw` 可以把 Agent 工作声明在仓库 workflow 中；
- Symphony 可以根据 GitHub 工作项触发远程任务；


### 4.8 强制性：提示词、hook 和 CI 不是同一种硬度

原方案有不少“不可绕过”的文字，但逻辑声明本身并不等于执行强制。合理的分层应是：

| 层级 | 机制 | 强度 | 适合承担 |
| --- | --- | --- | --- |
| 认知规则 | AGENTS、skill、prompt | 软 | 方法、判断标准、工作习惯 |
| Harness hook | Stop/PreTool 等事件 | 半硬 | 提前反馈、阻断当前 harness 的错误结束 |
| 确定性脚本 | validator、lint、test | 硬但可手动绕过 | 可机器判断的契约 |
| CI required check | 服务端 pipeline | 硬 | 合并前统一验证 |
| Branch protection + approval | 仓库治理 | 最终权威 | 禁止绕过 Gate、保留人工决策 |

ECC hooks 确实属于半硬性拦截，比单纯 prompt 更可靠；但 hook 依赖具体 harness，也可能被关闭或从外部绕过。跨工具的一致硬约束必须落到 CI workflow 和仓库保护规则中。

### 4.9 可维护性：安装同步机制扩大了漂移面

原项目既维护仓库内 skill，又把其同步到 Multica；同步机制只增不删，删除线上副本需要 UI 手工操作。结果是：

- Git 删除不等于平台删除；
- 旧 Agent、autopilot 和 skill 会形成幽灵资产；
- 日常 sync 不能安全完成退役；
- 同一个规则在仓库、Agent prompt、平台 skill 和 issue 模板中重复出现。

这正是“为了使用 Multica，而把流程硬塞进 Multica”的技术表现。平台集成不再是薄层，而成为持续维护的第二事实源。

## 5. 对 `multica-e2e-fixture` 的定位

该仓库值得保留，但必须正确命名其能力。

它最初用于 Multica CLI 升级的隔离 E2E，历史上真实验证过：

- 项目与本地 Git 资源绑定；
- Agent 工作目录落到 fixture；
- 文件修改与 Git commit；
- issue 评论父子关系；
- `--content-file` 的工作目录约束；
- 评论附件和 metadata 读写；
- 多类 CLI 资源的创建、更新和清理。

它也发现了真实平台限制：部分命令只适用于 chat task，Agent 自己发出的根评论不会自然触发下一轮，CLI 与 daemon 可能版本漂移，文档参数可能落后于实际行为。

但当前仓库能够独立重复执行的只有 `greet.sh` 的四个 Bash 断言和 OpenSpec 结构校验。它没有：

- CI 配置；
- Multica 任务创建和触发脚本；
- 等待远程 run 的稳定轮询；
- 证据采集器；
- 环境初始化和自动清理；
- 平台无关的场景 manifest。

所以它是“曾经真实跑通过的 fixture”，不是“现在可以一键重复的 Multica E2E 套件”。最合适的未来定位是：

> Multica Adapter 的黑盒验收 fixture，只保存可修改目标和最终断言；平台操作由独立 adapter harness 承担。

## 6. `agent-dev-workflow` 的目标设计

### 6.1 设计原则

1. **Matt-first**：Matt Pocock Skills `v1.2.3+` 拥有需求盘问、领域建模、规格、ticket、实现/TDD 与自动审查主干；
2. **repo-first**：团队知识和交付状态进入 Git、项目 tracker、PR/MR 或 CI 产物；
3. **adapter-last**：只有核心契约无法表达的平台差异才进入 Adapter；
4. **缺口补齐**：项目只实现 Matt 未提供的推理证据、人工 QA、交付验证和确定性契约；
5. **执行者可替换**：同一个 Journey ticket 可以由本地 Agent、原生多 Agent、CI 或远程平台执行；
6. **强制分层**：文字规则、hook、validator、CI 和人工批准各承担与其强度相符的职责；
7. **失败大声暴露**：未运行是 `UNVERIFIED`，不是 `PASS`；
8. **默认最小流程**：复杂度必须由风险证明，不能由工具能力倒推需求。

### 6.2 主流程

```text
Idea
  |
  v
Align [HITL]
  术语对齐 -> 需求盘问 -> 边界澄清
  |
  v
Destination [HITL]
  目标结果 + 成功标准 + 测试缝 + 非目标
  |
  v
Journey [HITL]
  纵向 ticket + blocking edges
  |
  v
Implement [AFK]
  一次一个 ticket，一次一个 red-green slice
  |
  v
Auto Review [fresh AFK context]
  规格、实现、测试、安全和范围审查
  |
  v
Human Acceptance [HITL]
  产品行为、测试价值、接口和真实可用性
  | rejected / new behavior
  +--------------------------> 新 Journey ticket
  |
  v
Verify & Merge [HITL]
  项目 test/lint/build/security/E2E + CI + 人工批准
```

该流程刻意没有“固定五个 Agent”“每阶段一个 sub-issue”或“必须 OpenSpec”。那些都是可能的执行策略，不是开发工作的本质阶段。

### 6.3 架构分层

```text
┌─────────────────────────────────────────────────────┐
│ 项目事实源                                          │
│ Git + Context/ADR + Tracker + PR/MR + CI artifacts │
└──────────────────────────┬──────────────────────────┘
                           │
┌──────────────────────────v──────────────────────────┐
│ agent-dev-workflow 核心                             │
│ manifest + rules + evidence + validator + QA Gate  │
└───────────────┬───────────────────────┬─────────────┘
                │                       │
┌───────────────v──────────┐  ┌────────v─────────────────────┐
│ Provider                 │  │ Harness                      │
│ Matt 必需 / ECC 可选     │  │ Codex / Claude Code / 其他  │
└───────────────┬──────────┘  └────────┬─────────────────────┘
                └───────────┬───────────┘
                            │
┌───────────────────────────v──────────────────────────┐
│ 可选远程 Adapter                                     │
│ gh-aw / Symphony / Multica                         │
└──────────────────────────────────────────────────────┘
```

完整架构图见 [`docs/assets/agent-dev-workflow-architecture.html`](assets/agent-dev-workflow-architecture.html)。

### 6.4 目录布局

项目借鉴 ECC 的“能力按目录分层”思路，但不嵌入 ECC：

```text
AGENTS.md                  # 极短入口与读取顺序
CONTEXT-MAP.md             # 递归上下文入口
ADR-MAP.md                 # 递归决策入口
manifests/                 # 可机器读取的工作流与安装契约
rules/                     # 跨阶段不变量
skills/                    # 只放 Matt 未覆盖的项目能力
hooks/
  shared/                  # 与 harness 无关的 guard
  adapters/                # Codex/Claude 等事件薄映射
integrations/
  matt/                    # 必需 Provider 的版本/来源契约
  ecc/                     # 可选 capability 映射
docs/                      # 架构、Context、ADR、证据与说明
src/ + scripts/            # 确定性 validator 与 installer
tests/                     # 契约、负向变异和生命周期测试
```

ECC `v2.2.0` 只作为可选 Provider，当前映射 `verification-loop`、`eval-harness`、`security-review` 和 `contract-first`。缺失 ECC 不影响主流程；检测到 ECC 时也不复制其 68 个 Agent、286 个 skill、94 个命令和整套 hook runtime。

### 6.5 资产安装与所有权

`agent-dev-workflow v1.0.0` 使用 manifest 和 SHA-256 ownership ledger 初始化目标仓库：

- `install --dry-run` 先列出每个目标 action；
- 未托管同名文件默认保留并阻断整体安装；
- `--accept-existing` 只登记为项目自管，不取得覆盖或删除权；
- `repair` 只恢复缺失托管文件，不自动覆盖 modified/outdated 文件；
- `uninstall` 仅在 ledger、目标文件、当前源文件三方哈希一致时删除；
- ledger 只保存相对路径，不保存本机路径。

这一设计承认业务仓库已有自己的 `AGENTS.md`、Context 和 ADR。安装器的职责是提出可检查的合并计划，而不是替用户做语义覆盖。

### 6.6 Issue 与状态

工作流只规定 ticket 必须包含状态、依赖边、可观察交付和接受标准，不拥有 issue control plane。

- 小型项目可以使用仓库内 `.scratch/<feature>/issues/`；
- 已使用 GitHub Issues 的团队应切换到对应 tracker；
- 同一项目不得同时维护两个 canonical tracker；
- Multica issue 只能作为 Adapter 映射，不得成为唯一事实源；
- 远程执行状态必须回写项目 tracker 或 PR/MR，而不能只停留在 Agent 平台中。

### 6.7 远程执行 Adapter

远程层应共享同一个最小契约：

```text
输入：Journey ticket + repository/ref + permissions + acceptance command
执行：隔离 checkout/worktree + Agent run + bounded retries
输出：commit/patch + evidence packet + terminal status
回写：项目 tracker + PR/MR + CI artifact
```

每个 Adapter 只回答平台差异：如何触发、如何隔离、如何等待、如何回写、如何取消。它不能重新定义 Destination、Journey、测试策略或完成标准。

`v1.0.0` 尚未实现这些远程 Adapter；对应 ticket 仍为 `ready-for-agent`。当前已完成的是核心流程、仓库资产、确定性 Gate、安全 installer、Matt provenance 和可选 ECC 映射。

## 7. 哪些应保留、删除或降级

| 原能力 | 处理 | 理由 |
| --- | --- | --- |
| MECE 决策树、frontier、事实自查 | 保留并吸收 | 是具体有效的需求澄清方法 |
| 术语表与 glossary | 强化 | 必须前置于 grilling |
| Context/ADR 递归 Map | 保留 | 降低上下文加载成本，资产属于仓库 |
| 验证证据三态 PASS/FAIL/UNVERIFIED | 保留 | 防止静默跳过 |
| 测试先于实现、fresh review | 保留 | 直接提高正确性 |
| 固定五 Agent 人设 | 从核心删除 | harness 原生角色可替换 |
| 一个 stage 恰好一个 sub-issue | 删除 | 把平台屏障细节误当工作流本质 |
| A/B/C 状态补救编排 | 简化为 blocking ticket | 当前复杂度主要服务 Multica 唤醒语义 |
| OpenSpec 必选 | 降级为 Adapter | 复杂任务有价值，小任务成本失真 |
| Multica issue/skill 为事实源 | 禁止 | 团队资产不可困在个人 workspace |
| Multica install/sync 全量维护 | 降级为 Adapter 安装 | 平台副本只应服务执行，不拥有流程 |
| ECC 整套嵌入 | 禁止 | 过重且复制主流程 |
| ECC hooks、安全、eval 思路 | capability 级复用 | 有价值但应保持可选 |
| `multica-e2e-fixture` | 保留为 Adapter fixture | 可验证真实平台边界，但不是工作流样板 |

## 8. 迁移路线

### 阶段 1：冻结事实源

- 指定 Git、项目 tracker、PR/MR 和 CI 为新的 canonical state；
- 停止把新规则只写入 Multica Agent 或个人 skill；
- 列出现有 OpenSpec、Context、ADR、issue 评论和平台配置的资产清单。

### 阶段 2：迁移有长期价值的资产

- 将领域术语、决策和上下文迁入递归 Context/ADR Map；
- 将仍有效的 issue 迁入单一项目 tracker；
- 将可机器判断的规则迁入测试、validator 和 CI；
- 将只对 Multica 有意义的字段留在 `integrations/multica/`。

### 阶段 3：切换默认主流程

- 使用 Matt 完成 Align、Destination、Journey、Implement 和 Auto Review；
- 使用项目 `human-qa` 与 `delivery-verification` 补齐人工接受和交付 Gate；
- 默认使用 Codex/Claude 原生多 Agent，不再要求常驻汽车人角色。

### 阶段 4：实现远程 Adapter

- 先定义平台无关输入/输出 contract test；
- 实现一个最小 GitHub Actions/webhook 或 Symphony Adapter；
- 再实现 Multica Adapter，并使用 `multica-e2e-fixture` 做黑盒验收；
- 所有 Adapter 都必须把结果回写项目事实源。

### 阶段 5：退役双写和幽灵资产

- 确认没有在途任务依赖旧 Agent、skill 或 stage 机制；
- 停止仓库与 Multica skill 的双向同步；
- 显式归档旧 Agent、autopilot 和平台副本；
- 保留历史报告作为审计材料，但不继续维护其运行逻辑。

迁移期间最危险的做法是长期双写。两个 canonical tracker、两套 skill、两套状态机不会提高可靠性，只会让冲突变得无法判定。

## 9. 成功标准

目标设计成立，至少需要满足以下可验证条件：

1. 新成员仅凭仓库和团队 tracker 可以理解当前目标、决策、ticket 和验证状态；
2. 不安装 ECC、OpenSpec 或 Multica 时，核心工作流仍能完整运行；
3. 替换 Codex、Claude Code 或远程 Agent 时，不需要重写工作流阶段；
4. 每个实现 ticket 是一个可独立验证的纵向切片，而不是测试层/实现层的横向任务；
5. 术语未确认、required skill provenance 不可信、fresh review 缺失或必需检查未运行时，确定性 Gate 会失败；
6. 本地 hook 可以提供早期反馈，但关闭 hook 仍不能绕过 CI required check；
7. Multica Adapter 的 E2E 可以从脚本启动、等待、验收和清理，不依赖个人路径或手工拼证据；
8. 小任务的制品成本与风险相称，不再出现十四行实现搭配数百行强制规格的默认行为。

## 10. 当前边界与下一步

`agent-dev-workflow v1.0.0` 已完成：

- Matt-first 七阶段契约；
- 术语对齐前置 Gate；
- Matt skill 来源和最低版本验证；
- ECC `v2.2.0` 可选能力映射；
- Context/ADR 递归 Map；
- 交付 guard、GitHub Actions 基线；
- 安全 install/status/repair/uninstall 生命周期；
- 对抗性负向测试和交付验证。

尚未完成：

- GitHub `gh-aw` Adapter；
- GitHub Actions/webhook Adapter；
- Symphony Adapter；
- Multica Adapter 与可重复 E2E harness；
- 将既有业务仓库的真实 test/build/security/E2E 自动接入 installer；
- 远程执行的统一 evidence packet 和取消语义。

优先级最高的下一步不是继续增加规则，而是完成一个薄的远程 Adapter，并证明同一 Journey ticket 能在本地和远程执行后产生同样的证据契约。只有这个闭环成立，`agent-dev-workflow` 才从“可靠的本地工作流组合层”进化为“平台可替换的团队开发工作流”。

## 11. 最终判断

原方案的优点是认真、可审计、愿意暴露失败；缺点是把认真等同于复杂，把可审计等同于制品数量，把多 Agent 等同于固定角色，把流程可靠性等同于 Multica 状态机。

正确的简化不是删掉测试、审查和 Gate，而是把它们放回正确的所有权边界：

- 方法论交给成熟 Provider；
- 团队资产交给仓库和 tracker；
- 确定性约束交给代码与 CI；
- 人类判断保留在关键 Gate；
- Agent 平台只负责执行；
- 平台差异只存在于 Adapter。

这也是 `agent-dev-workflow` 采用这个名字，而不是 `reasoning-contract` 或 `decision-contract` 的原因：推理与决策都只是开发工作流的一部分。真正需要交付的是一条从想法到可接受变更的完整、轻量、可替换路径。

## 12. 证据索引

- 原工作流：`openspec-superpowers-4-multica` 的 `src/openspec-superpowers/`、`src/scratch/clarify/` 与归档 change；
- Fixture：`multica-e2e-fixture@aa14064` 的 `greet.sh`、`scripts/tests/test_greet.sh` 和 `openspec/changes/add-greet-script-with-smoke-test-e2e/`；
- 目标设计：本仓库 `manifests/workflow.json`、`rules/`、`docs/architecture.md`、`docs/contexts/workflow/CONTEXT.md` 与 `docs/adr/workflow/0001-matt-first-optional-providers.md`；
- Matt Provider：[mattpocock/skills v1.2.3](https://github.com/mattpocock/skills/releases/tag/v1.2.3)；
- ECC Provider：[affaan-m/ECC v2.2.0](https://github.com/affaan-m/ECC/releases/tag/v2.2.0)；
- Fixture 远端：`multica-e2e-fixture`。
