# 架构

`agent-dev-workflow` 是工作流组合层。Matt 提供主流程；本仓库只提供缺失的人工 QA、证据、交付验证、确定性契约以及 Provider/平台的薄适配。

```text
想法
  -> Align (术语对齐 -> Matt grilling + domain-modeling -> 边界澄清, HITL)
  -> Destination (Matt to-spec, HITL)
  -> Journey (Matt to-tickets, HITL)
  -> Implement (Matt implement + vertical-slice TDD, AFK)
  -> Auto Review (Matt code-review, fresh AFK context)
  -> Human Acceptance (project human-qa, HITL)
  -> Verify and Merge (project baseline + optional Providers, HITL)
             | 被拒绝的行为
             +---------------------> 新 Journey ticket
```

## 所有权

- `manifests/workflow.json`：可机器读取的阶段契约。
- `manifests/install.json`：从本仓库 source 到目标仓库相对路径的安装清单。
- `skills/`：只包含 Matt 主流程缺少的能力。
- `rules/`：跨阶段不变量，由 `AGENTS.md` 的短入口按需指向。
- `integrations/`：映射可选 Provider，不复制其实现。
- `hooks/`：在 harness 暴露相应事件时提前反馈；CI 仍是合并权威。
- `scripts/adw.mjs`：执行确定性校验和 capability discovery。
- `src/installer.mjs`：计算安装计划、维护 SHA-256 ownership ledger，并执行 install/status/repair/uninstall；不自动合并目标已有文件。
- `CONTEXT-MAP.md` 与 `ADR-MAP.md`：递归披露任务相关知识与决策，避免一次性加载全部文档。

本项目不调度 Agent、不托管 issue、不替代 harness，也不强制要求 ECC、OpenSpec 或 Multica。

目标仓库中的 `.agent-dev-workflow/ownership.json` 只记录 installer 管理的相对路径与内容哈希。未托管文件默认冲突并保留；显式 `--accept-existing` 后记为项目自管，repair 不覆盖、uninstall 不删除。

普通 install 只要发现未托管冲突就整体停止写入，避免半安装；repair 可以在保留已修改或过期文件的同时恢复缺失资产，并用 `NOT_READY` 暴露仍需人工处理的路径。为抵御 ledger 篡改，outdated 不自动覆盖，uninstall 仅在 ledger、目标文件和当前 manifest 源内容三方哈希一致时删除。
