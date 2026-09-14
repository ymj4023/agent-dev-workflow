# 01 - 建立 Matt-first 工作流契约

**交付内容：** 可机器读取的 idea-to-merge 工作流，包含必需 Matt 阶段、纵向切片不变量、可选 ECC 集成和 capability discovery。

**Blocked by:** 无，可立即开始。

**Status:** done

- [x] Canonical workflow 通过确定性验证。
- [x] 隐藏 ECC 依赖、横向切片、过期 review context 和循环依赖均会使测试失败。
- [x] Doctor 能区分必需 Matt gap 与可选 Provider gap。

## 证据

RED/GREEN 命令、capability provenance 与 review 修复见 [`docs/evidence/bootstrap.md`](../../../docs/evidence/bootstrap.md)。
