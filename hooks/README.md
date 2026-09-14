# Hooks

`shared/delivery-guard.mjs` 在 harness 结束工程回合前执行仓库契约。验证通过时退出码为 `0`；验证失败或无法执行时，以退出码 `2` 和 `NOT_READY` 原因阻断完成。

`adapters/` 下的文件只负责把 harness 事件映射到共享脚本。安装适配器前必须确认目标 harness 会把退出码 `2` 视为阻断结果。本地 hook 在 harness 外可能被关闭或绕过，因此 CI 始终保留最终权威。

Codex 适配器针对 2026-09-05 已验证的 hook surface。没有 `Stop` hook 的旧版本 Codex 使用手工验证与 CI 兜底。
