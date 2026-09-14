# 保持 Matt 为工作流主干，其他 Provider 可选

Matt Pocock Skills 拥有默认的 idea-to-review 流程，因为其纵向切片 TDD、带 blocking edges 的 ticket、阶段边界和独立审查构成一套完整系统。本仓库只拥有缺失的 Gate 与 Adapter；ECC 和平台集成保持可选，使其缺失不会破坏核心流程，也不会把维护成本强加给每个项目。

## 影响

新增核心阶段前必须先证明 Matt 主干无法承载该职责。Provider 适配只能映射能力，不得复制上游实现或成为隐藏前置条件；改变上述所有权边界时必须新增或替代本 ADR，并同步更新直接父级 `ADR-MAP.md`。
