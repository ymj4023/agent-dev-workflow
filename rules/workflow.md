# 工作流不变量

1. Align 必须严格遵循“术语对齐 → 需求盘问 → 边界澄清”。对每个核心术语逐一确认定义、适用范围、排除范围和歧义/易混概念；全部获得人类确认前，不得调用 `grill-me`、`grill-with-docs` 或 `/grilling` 开始需求盘问。
2. Matt 拥有默认流程：对齐、Destination、Journey、实现/TDD 与自动审查。
3. 每个实现 ticket 都是适合一个 fresh context 的纵向切片；在其中一次只完成一个 red-green slice。
4. HITL Gate 负责人机对齐、切片形状、产品接受和合并批准。只有输入稳定后才能开始 AFK 工作。
5. 自动审查在实现后使用 fresh context 执行。人工接受发生在机器反馈之后，不能被自动审查替代。
6. 失败的审查或 QA 观察必须变成带 blocking edges 的新 Journey ticket。除非产品决策改变，否则保留原 Destination。
7. 持久状态属于 Git、配置的项目 tracker、PR/MR 历史或 CI 产物。
8. Provider 是能力来源，不是工作流所有者。可选 Provider 只能增强阶段，不得成为隐藏前置条件。
