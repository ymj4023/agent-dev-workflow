# agent-dev-workflow Bootstrap

**Status:** ready-for-agent

## 问题

AI 开发工作流经常绑定单一 harness、issue 系统或过重插件。这会重复 Matt Pocock Skills 已提供的能力，把团队资产藏进个人工具，并用 prompt 纪律替代确定性仓库 Gate。

## 方案

建立 Matt-first、repo-first 的工作流组合层。Matt 拥有对齐、领域建模、Destination 生成、纵向切片 Journey ticket、TDD 实现和自动审查。本项目只补缺失的人工 QA、证据、完成验证、确定性校验和可选薄适配。

## 用户故事

1. 作为开发者，我需要一条显式 idea-to-merge 流程，以判断何时需要人工决策、何时适合 AFK 执行。
2. 作为开发者，我需要保持 Matt 纵向切片 TDD 为 canonical，使测试与实现通过快速端到端反馈共同演进。
3. 作为 reviewer，我需要自动审查运行在 fresh context 中，避免实现上下文掩盖缺陷。
4. 作为维护者，我需要阻止项目 skill 覆盖 Matt skill，使上游改进持续可用。
5. 作为维护者，我需要 ECC 保持可选，以便只采用有用能力而不继承全部重量。
6. 作为团队成员，我需要规格、ticket、决策与证据保存在仓库可见系统中，使其跨个人工具与会话存续。
7. 作为 CI 管理员，我需要 GitHub Actions 执行统一的确定性 validator，避免平台 adapter 重定义 readiness。
8. 作为人工批准者，我需要机器检查暴露未验证工作而不是静默通过，使最终判断拥有诚实证据。
9. 作为需求提出者，我需要在需求盘问前逐一确认核心术语的定义、范围和歧义，避免后续在不同概念上达成虚假共识。
10. 作为项目维护者，我需要先 dry-run 再安全初始化工作流；已有和已修改文件必须保留，更新与卸载权限必须由可检查的 ownership ledger 决定。

## 实现决策

- 使用带版本的 JSON workflow manifest 作为 canonical 阶段契约。
- 使用 Node.js 22+ 与纯标准库脚本完成跨平台确定性校验。
- 根据已安装 skill 名发现 Matt capability，不 vendor 其内容。
- 缺口能力放在 `skills/`，不变量放在 `rules/`，事件映射放在 `hooks/adapters/`，Provider 映射放在 `integrations/`。
- hook 只提供本地早期反馈，CI 与 branch protection 是最终确定性权威。
- Context 与 ADR 通过只列直接子级的 Map 递归披露。
- Align 内固定执行“术语对齐 → 需求盘问 → 边界澄清”，并用 manifest 与 validator 防止调换顺序。
- 安装由 `manifests/install.json` 驱动；ledger 只保存相对路径和 SHA-256，项目自管文件永不由 repair 覆盖或 uninstall 删除。

## 测试决策

- 通过公开 validator 函数与 CLI 测试 workflow manifest 和仓库。
- 使用对抗性变异覆盖缺失不变量、隐藏 ECC 要求、review context 漂移和循环依赖。
- 不启动真实 harness，直接测试 hook allow、block 与 runner failure 路径。
- GitHub Actions 执行统一的测试和仓库验证命令。

## 非目标

- 重新实现或 vendor Matt Skills。
- 打包 ECC、其 Agent 目录或完整 hook runtime。
- 构建 Agent runtime、issue tracker、control plane 或 model router。
- 强制要求 OpenSpec 或 Multica。
- 在 bootstrap slice 中实现远程调度。
- 声称本地 hook 与服务端 required check 拥有相同权威。

## 补充说明

严格的推理/证据契约只是工作流内部的一项横向质量能力，不是产品身份。高风险场景未来可以把测试作者与实现者分离作为 opt-in Gate；默认仍保持 Matt 的单测试/单最小实现纵向反馈环。
