## ADDED Requirements

### Requirement: 大号并排 split diff 为默认视觉主角

diff 列 MUST 常驻渲染 `fillDiff → DiffBody → LineDiff`，默认 `split:true`（基础版本｜本地修改并排、行号、Shiki 高亮、±统计、左右同步滚动、split/wrap 工具条、在右侧栏打开）。`readLineDiffPrefs` 默认值 MUST 为 `{split:true, wrap:false}`，且 MUST 保留既有 `LINEDIFF_KEY`、`useState` 播种、`useEffect` 持久化与 `onActiveFile → setDiffPath` 上报链。

#### Scenario: 首次打开即为并排 diff

- **WHEN** 用户从未操作过 split/wrap（无 `LINEDIFF_KEY` 记录）并点击一个变更文件
- **THEN** diff MUST 以并排 split 视图渲染，左右两列行号与内容同步滚动
- **AND** diff 列 MUST 占面板最大宽度

#### Scenario: 老用户偏好不被新默认值覆盖

- **WHEN** 用户此前手动切到 unified 并持久化过 `{split:false}`
- **THEN** 面板 MUST 仍以 unified 渲染
- **AND** 用户新切换的 split/wrap MUST 继续写入 `LINEDIFF_KEY` 并在刷新后恢复

### Requirement: 兼容类名与既有验证契约不回归

替换 body 渲染后 MUST 保留 `dig-root`/`dig-topbar`/`dig-shell`/`dig-empty`、`dig-body-columns|stack|compact`、`.dig-pane-tree`/`.dig-pane-changes`/`.dig-pane-main`、`[data-pane]`、`dig-root-narrow`、`RAIL_VIEW_IDS`、`splitTabs`/`tabPane`、`fillDiff`/`diffPaneOf` 签名。`paneGeometry` 纯函数块 MUST 一字不改，其数值断言 MUST 全绿。

#### Scenario: SSR 自检与布局探针通过

- **WHEN** 运行 `node scripts/ssr-check.mjs` 与 `node scripts/layout-probe.mjs "<url>" [out]`
- **THEN** ssr-check MUST 找到 4 个 needle 且无渲染期异常
- **AND** layout-probe 的 11 档宽度 MUST 能读出 chrome、无 header 溢出、零 pageerror

#### Scenario: diff 不被 paneStyle 压半高

- **WHEN** 渲染 columns 布局的 diff 列
- **THEN** diff 列 MUST NOT 调用 `paneStyle('diff')`（它返回高度/55% 上限）
- **AND** diff 列 MUST 带 `data-pane="diff"` 供 `measurePanes` 测高度
- **AND** `paneGeometry` 的 clamp 语义 MUST 与改动前一致

## ADDED Requirements

### Requirement: 词典与文档同步

新增 `layout.*` 文案键 MUST 在 21 门词典（ZH/EN/19 门 LOCALES）键集完全一致。`CHANGELOG.md` MUST 补 `## Unreleased`，`AGENTS.md` 不变量 7 MUST 改写为 ugit 分区模型，两份 README 效果段文字 MUST 与 ugit 形态一致，`docs/screenshots/` 6 张图 MUST 重拍为 ugit 形态（图名/数量/`screenshots.json` 不变）。

#### Scenario: 21 门键集一致

- **WHEN** 运行 `npm test`
- **THEN** `tests/smoke.mjs` 的逐门 `deepEqual` 与 `===21` 计数断言 MUST 全绿
- **AND** 面板 MUST NOT 出现半翻译（缺键静默回退英文）状态

#### Scenario: 全套验证通过

- **WHEN** 按 `npm test` → ssr-check → layout/panes/dock/selection/settings-card/conversation-probe → screenshots 顺序运行
- **THEN** 每一条 MUST 通过，零 pageerror
- **AND** 验证 MUST 只在隔离 `DSH_HOME` + 端口 3099 实例上进行，MUST NOT 触碰 3080 或替用户重启 `dsh web`