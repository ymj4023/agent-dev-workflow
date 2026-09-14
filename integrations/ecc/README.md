# 可选 ECC Provider

ECC 是可选的增强 Provider。检测到 ECC 后，它的 verification、eval、security、contract 和 harness-hook 能力可以增强对应阶段；没有 ECC 时，核心工作流、validator 与完成基线仍然可用。

本集成只映射 capability，不 vendor ECC 文件、不安装 ECC、不复制其 Agent 目录，也不假设 ECC hook 能跨 harness 直接移植。

映射固定到上游 tag `v2.2.0`。选择性安装的 ECC 可能缺少部分映射能力；`doctor` 会把它们报告为 optional gap，不会仅凭文件名断言完整 ECC 版本已经安装。
