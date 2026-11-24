## Why

dsh-ide-git 当前是 JetBrains 式三栏（分支树｜提交图谱｜变更列表），真正关心的「变更文件」与「文件差异」被挤成窄列，而「分支或标签」「提交记录」占最大面积且无法隐藏。用户提供了 ugit 参考截图，要求按它重新实现，并能在设置里隐藏/打开功能区、调整位置大小后自动记忆到当前浏览器。

经四轮问答对齐：直接替换为 ugit 布局（不保留旧三栏）、分支/提交图谱降级为顶部 Tab 独立视图、目录树保留为独立可隐藏窄列、配置四项全要（显隐/尺寸记忆/顺序调整/默认 Tab 与 diff 模式记忆）、记忆介质为 localStorage、实现策略「换血不换骨架」（复用机制层、保留兼容类名）。

## What Changes

- **默认「变更」Tab 改为 ugit 三列**：单行顶栏 + 最左竖排图标 rail + 目录树（窄、可隐藏）｜变更文件列表（列底内嵌提交框）｜大号并排 split diff（flex:1，视觉主角）。
- **次要信息降级**：分支树/标签、提交图谱默认不在主视野，由「工作区 / 变更 / 历史」Tab 或设置里的显隐开关唤出；顶部两条大搜索框（分支或标签、文本或哈希）收进分支下拉与历史 Tab 过滤条。
- **新增浏览器本地布局配置** `LAYOUT_KEY='dsh-ide-git.layout.v2'`：逐区显隐（双向：隐藏与打开）、列顺序、默认 Tab、提交框落点、附加列宽；`normalizeLayout` 丢弃未知/重复 id、按规格补齐、代码顺序写空串。
- **沿用既有记忆**：`PANES_KEY`（tree/changes 列宽 ratio）、`LINEDIFF_KEY`（split/wrap，默认值改为 split:true）、`TREE_KEY`（目录树折叠）、`CHANGES_GROUP_KEY`（平铺/按目录）。
- **设置面**：面板内齿轮新增逐区双向开关、上移/下移、默认 Tab、提交框落点、恢复默认布局；插件页设置卡只加只读说明与「打开布局设置」入口（不加 checkbox，避免与 settings-card-probe 冲突）。
- **文档/外观**：CHANGELOG 补 Unreleased、AGENTS.md 不变量 7 改写、两份 README 效果段文字、重拍 6 张 README 效果图。

## Capabilities

- `ugit-layout`：ugit 三列布局与顶部 Tab 视图集。
- `zone-config`：功能区显隐/顺序/位置/尺寸的浏览器本地配置与自动记忆。
- `diff-focus`：大号并排 split diff 作为视觉主角与 diff 偏好记忆。

## Impact

- 仅 `src/client.js`（单文件客户端半）、`tests/smoke.mjs`、`scripts/screenshots.mjs`、`docs/screenshots/*.png`、`README*.md`、`CHANGELOG.md`、`AGENTS.md`、`docs/plans/`。
- **不动**宿主半 `src/index.js`/`src/host/*`、方法表、写队列、撤回、破坏性守卫、`src/host/config.js`、`RAIL_CONFIG_IDS`、`configForms` 绑定、两座位注册、第三座位。
- 唯一外部可见行为变更：`readLineDiffPrefs` 默认 `split:false→true`（仅影响从未操作过 split 的用户，老用户 stored 值优先，可逆）。
- 完整设计与逐项符号确证见 `docs/plans/2026-11-24-ugit-layout-design.md`（审查修订版）。