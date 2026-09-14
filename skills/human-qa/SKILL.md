---
name: human-qa
description: 在自动审查后需要人类接受行为、测试价值、接口形状或产品质量时使用。
---

# 人工 QA

准备能让人判断改动的最小 review surface：可运行行为、接受标准、承载最高风险的测试，以及机器无法可靠判断的视觉或设备路径。

请人类分别回答四个相互独立的问题：

1. 交付行为是否解决了 Destination？
2. 测试是否通过约定测试缝覆盖了有价值的行为？
3. 模块接口与失败模式是否容易理解？
4. 结果在真实环境中是否可用且得体？

每个答案连同证据记录为 accepted、rejected 或 unverified。每个被拒绝或新发现的行为都转换成小型纵向切片 Journey ticket，并显式标明 blocking edges。只有人类改变产品决策时才修改 Destination。

四个问题都有明确人工答案，且每个拒绝项都有 ticket 或显式 out-of-scope 决策后，本阶段才完成。
