# 04 - 安装工作流资产且不覆盖用户内容

**交付内容：** 面向目标仓库的 manifest 驱动 installer、status/doctor 输出、ownership ledger、漂移检测、repair 与 uninstall 行为。

**Blocked by:** 03 - 增加本地早期反馈与服务端 Gate。

**Status:** done

- [x] Dry-run 展示全部目标路径与预期变更。
- [x] 保留并报告现有非本工具所有或已修改文件。
- [x] 重复安装保持幂等。
- [x] Uninstall 只删除 installer 所有且未被修改的文件。

## 证据

`tests/installer.test.mjs` 覆盖 dry-run、幂等、项目自管冲突、drift status、repair、uninstall、路径逃逸和 symlink；`tests/cli.test.mjs` 使用真实 `manifests/install.json` 验证 CLI dry-run。
