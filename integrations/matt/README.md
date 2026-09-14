# Matt Provider

Matt Pocock Skills `v1.2.3` 或更高版本提供必需的工作流主干。本仓库只引用已安装 skill 的名称，绝不 vendor 其内容。

必需 capability 从 `manifests/workflow.json` 派生。运行 `npm run doctor` 验证配置的 skills 目录；只有安装位置不在 `$HOME/.agents/skills` 时才设置 `MATT_SKILLS_DIR`。
