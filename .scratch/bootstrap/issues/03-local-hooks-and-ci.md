# 03 - 增加本地早期反馈与服务端 Gate

**交付内容：** 一个共享 delivery guard、Claude/Codex 薄事件 adapter，以及等价的 GitHub Actions 检查。

**Blocked by:** 02 - 发布 repo-first 工作流 surface。

**Status:** done

- [x] 共享 guard 放行已验证工作，并阻断失败或无法执行的验证。
- [x] Harness adapter 只包含事件映射。
- [x] GitHub Actions 执行统一的 test 和 verify 命令。

## 证据

RED/GREEN 命令、capability provenance 与 review 修复见 [`docs/evidence/bootstrap.md`](../../../docs/evidence/bootstrap.md)。
