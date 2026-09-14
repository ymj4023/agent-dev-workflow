# Bootstrap 证据

本文件记录 2026-09-05 的 `agent-dev-workflow` 初始实现，并在 2026-09-07 首次上传远程仓库前后刷新。

## RED 检查点

| 切片 | 命令 | 有效失败信号 |
| --- | --- | --- |
| 工作流契约 | `npm test` | `ERR_MODULE_NOT_FOUND: src/workflow-contract.mjs` |
| CLI 与仓库契约 | `npm test` | 缺少 `scripts/adw.mjs` 和 `src/repository-contract.mjs`；`verify` 返回 usage error |
| Delivery guard | `npm test` | `ERR_MODULE_NOT_FOUND: hooks/shared/delivery-guard.mjs` |
| Review 修复 | `npm test` | 尚未实现 Gate 时，测试错误接受了阶段边、Matt TDD 所有权、反馈目标、Provider 阶段注入、provenance、精确错误和 ECC 映射变异 |
| Node coverage 运行时 | `node --test tests/repository-contract.test.mjs` | 仓库仍声明 Node 20，但 coverage 命令使用了 Node 22 支持的阈值参数 |
| CLI 诊断 | `node --test tests/cli.test.mjs` | 普通 `doctor` 输出隐藏 provenance 失败，且 `--skills-root --json` 把 flag 吞成路径 |
| 中文入口与架构图 | `node --test tests/repository-contract.test.mjs` | 缺少 `README.ZH.md` 与仓库内架构图 |
| 递归文档 Map | `node --test tests/repository-contract.test.mjs` | 尚未导出 `validateDocumentationMap`，无法验证直接子级链接 |
| Align 术语前置 Gate | `node --test tests/workflow-contract.test.mjs` | 把需求盘问放到术语对齐前时，validator 错误返回空错误列表 |
| Safe installer | `node --test tests/installer.test.mjs tests/cli.test.mjs` | 缺少 `src/installer.mjs`，CLI install dry-run 无法输出 JSON 计划 |

## GREEN 验证

以下命令使用 bundled Node `v24.19.0`，表中缩写为 `node`。

| 命令 | 结果 |
| --- | --- |
| `node --test` | PASS：49 tests，0 failures，0 skipped |
| `node --test --experimental-test-coverage --test-coverage-lines=80 --test-coverage-functions=80` | PASS：line coverage 91.13%，branch coverage 78.04%，function coverage 98.81% |
| `node scripts/adw.mjs install <temp-repo> --dry-run --json` | PASS：列出真实 manifest 全部资产且目标无写入 |
| `install → status → uninstall` 临时 Git 仓库生命周期 | PASS：安装与状态通过，卸载后 ledger 消失 |
| `node scripts/adw.mjs validate` | PASS：workflow manifest 有效 |
| `node scripts/adw.mjs doctor` | PASS：7 个必需 Matt skill 均存在且 provenance 已验证；1 个可选 ECC capability 不可用 |
| `node scripts/adw.mjs verify` | PASS：repository contract 有效 |
| `node hooks/shared/delivery-guard.mjs` | PASS：退出码 0 |
| `node --check`：`src/*.mjs`、`scripts/adw.mjs` 与共享 hook | PASS |
| 高信号 token、private key 与本机信息扫描 | PASS：无命中 |

coverage 命令要求本地元数据、GitHub Actions 统一使用 Node 22。Node 22 CLI 文档包含 `--test-coverage-lines` 与 `--test-coverage-functions`，Node 20 CLI 文档没有这些阈值参数。

## Capability provenance

`node scripts/adw.mjs doctor --json` 根据 `$HOME/.agents/.skill-lock.json` 确认 7 个必需 workflow skill 均来自 `mattpocock/skills@v1.2.3`。可选 ECC 映射发现了 `verification-loop`、`eval-harness` 和 `security-review`；本地未安装 `contract-first`，因此保持为 optional gap。

## 独立审查

Fresh Standards 与 Spec reviewer 检查了完整 staged 初始树。其 finding 推动了确定性阶段契约、source/version provenance、结构化缺失 surface 错误、有界 hook timeout、精确 ECC `v2.2.0` 映射，以及对 Provider 专属必需阶段的拒绝。修复后没有剩余 CRITICAL/HIGH finding，Spec review 的其余问题由最终负向测试关闭。
