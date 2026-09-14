# 平台字样清理验证

日期：2026-09-14。

## 改动范围

- 两份 README、`docs/agents/issue-tracker.md`、`docs/analysis-and-design.md`：清理指定平台名称及原托管地址，clone 示例使用 `https://github.com/ymj4023/agent-dev-workflow.git`。
- `.scratch/bootstrap/spec.md`、issues 03 与 05、`docs/evidence/bootstrap.md`：同步移除对应平台说明。
- 架构图 HTML 与 PNG：CI 节点改为 GitHub CI，重新渲染并目视检查。
- 删除对应平台专属 CI 配置；同步更新 `src/repository-contract.mjs` 与 `tests/repository-contract.test.mjs`，保留 GitHub CI 运行时校验。

## 验证

| 检查 | 结果 |
| --- | --- |
| `node --test tests/repository-contract.test.mjs` | PASS：10 项通过，0 失败，0 跳过 |
| `node scripts/adw.mjs verify` | PASS：repository contract is valid |
| `git -c core.autocrlf=false diff --check` | PASS：无空白错误 |
| `node --test --experimental-test-coverage --test-coverage-lines=80 --test-coverage-functions=80` | FAIL：两个 installer 符号链接测试在创建链接时触发 EPERM；放宽沙箱后仍失败，未跳过测试 |
| 覆盖率（首次完整运行） | 行 91.05%，函数 98.81%；达到阈值，但不代表完整测试通过 |
| 工作区全文扫描 | PASS：包含隐藏与忽略文件，排除 `.git`，指定平台名称及原托管域名无命中 |
| PNG 目视检查 | PASS：CI 节点显示 GitHub CI，布局完整 |

## 剩余事项

- UNVERIFIED：符号链接保护行为，需维护者在允许创建符号链接的环境重跑完整测试。
- UNVERIFIED：人工接受，尚无用户对本轮结果的接受记录。
- 未改动 Git 历史；origin 已按用户提供的地址更新。仓库没有配置独立的 typecheck、lint、build 或安全检查命令。
- 状态：NOT_READY（完整测试受环境限制，人工接受未记录）。

## 平台统一补充

按用户后续要求，平台方案统一为 GitHub，CI 使用现有 GitHub Actions，远程适配方案保留 GitHub Actions/webhook。原平台历史运行结果未改写成 GitHub 成功记录。用户已提供 GitHub 仓库地址，两份 README 与 origin 统一使用 `https://github.com/ymj4023/agent-dev-workflow.git`。
