---
name: delivery-verification
description: 在完成或合并前运行仓库 Gate、保存证据、暴露跳过项并请求人工批准。
---

# 交付验证

读取仓库脚本与 CI 配置，确认真实命令。先运行最窄反馈环；如果仓库提供对应命令，再依次执行 typecheck、lint、完整相关测试、build、安全检查与仓库契约验证。

每项预期检查记录为 `PASS`、`FAIL` 或 `UNVERIFIED`，并附准确命令与包含有效信号的输出。工具缺失、环境不支持、超时或跳过测试都属于 `UNVERIFIED`，绝不是 `PASS`。

检查最终 diff 是否包含意外文件、弱化配置、缺失错误处理、泄露 secret 或 ticket 范围外改动。ECC verification 或其他 Provider 可用时可以增加检查；其缺失不能移除本基线。

只有全部必需的确定性 Gate 通过、自动审查 blocker 已解决、人工 QA 已接受且没有重要检查处于未验证状态时，才能返回 `READY`。否则返回 `NOT_READY`，并为每个缺口标明 owner 与下一步动作。
