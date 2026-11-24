# ugit 布局重构设计（2026-11-24）

## 0. 背景与结论

`dsh-ide-git` 当前是 JetBrains 式三栏：顶部「分支或标签 / 文本或哈希」两条大搜索框，主体「分支树 ｜ 提交图谱 ｜ 变更列表」三列，diff 只是中间列里一个 55% 高的小窗。用户报告：真正关心的**变更文件**与**文件差异**被挤成窄列，而**分支/标签树**、**提交记录**占了最大面积且无法隐藏。

用户提供了 ugit 截图（`yapidoc-maven-plugin`），要求按它重新实现，并能在设置里隐藏/打开功能区、调整位置大小后自动记忆到当前浏览器。

四轮问答已定死的结论：

1. **直接替换**为 ugit 布局，旧三栏不保留、不做切换开关。
2. 分支树/标签、提交图谱走**顶部 Tab 切换的独立视图**，默认「变更」。
3. 配置范围四项全要：功能区显隐、拖拽尺寸记忆、顺序/位置调整、默认 Tab 与 diff 模式记忆。
4. 目录树保留为**独立、可隐藏**的窄列分区。
5. 记忆介质明确为 **localStorage**，不写宿主行 Config / profile。

不在范围：宿主半（`src/index.js`、`src/host/*`）、方法表、写队列、撤回、破坏性守卫；不引入新依赖、不拆第二个 client entry、不加构建；不新增 `src/host/config.js` 的 volatile 字段。

## 1. 信息架构

照 ugit 截图，默认「变更」Tab：

```
┌─ 单行工具条 ────────────────────────────────────────────────────────────┐
│ ▣ 仓库▾ │ 工作区 · 变更 · 历史 │ master▾ │ ↑7 ↓1 │ 检查更新 更新 推送 │ ⚙ ▢ │
├──┬──────────┬─────────────────────┬────────────────────────────────────┤
│图│ 目录树    │ 变更 (37)           │ 大号并排 split diff                │
│标│ (窄,可隐) │ 状态分组 + 状态图标  │ 基础版本 │ 本地修改                  │
│rail│        │ 搜索/过滤/视图切换    │ 行号 · 语法高亮 · ±统计 · split/wrap│
│  │          ├─────────────────────┤ 顶部: 路径面包屑 + 在右侧栏打开      │
│  │          │ 提交信息框           │                                    │
│  │          │ 提交至 master       │                                    │
└──┴──────────┴─────────────────────┴────────────────────────────────────┘
```

- **主角**：`diff` 列用 `flex:1` 占满剩余宽度，是视觉面积最大的分区；`changes` 列次之；`dirTree` 最窄。
- **降级**：分支树、提交图谱不出现在默认视图；分别由「历史」Tab、设置里的显隐开关或顶部快捷图标唤出。顶部只保留当前分支的下拉指示器，不再有一整棵常驻树。
- **提交框**内嵌在变更列底部（截图形态），但作为独立可显隐、可换位置的附属分区。

### 分区清单

列分区（参与横向顺序与宽度拖拽）：

| id | 默认可见 | 默认宽 | 对应 pane key | 说明 |
|---|---|---|---|---|
| `dirTree` | 是 | 200px | `tree` | 新造 `DirTree`，复用 `buildDirForest` |
| `changes` | 是 | 290px | `changes` | 复用 `ChangesPanel` |
| `diff` | 是 | `flex:1` | — | 复用 `DiffBody`/`LineDiff`，不参与拖拽 |
| `branches` | 否 | 220px | — | 复用 `BranchTree`，打开后作为附加列 |
| `history` | 否 | 360px | — | 复用 `HistoryList`，打开后作为附加列 |

附属分区（只显隐，`commitBox` 可换位置）：`toolbar`、`iconRail`、`commitBox`。

### 三种 Tab 视图集

| Tab | 默认列集合 | 说明 |
|---|---|---|
| `changes`（默认） | `dirTree, changes, diff` | ugit 截图形态，提交框内嵌变更列底部 |
| `workspace` | `branches, dirTree, changes, diff` | 工作区/分支管理，复用 `WorktreesPane` 入口 |
| `history` | `history, diff` | 提交图谱 + 选中提交的文件差异/详情，复用 `historyPane` |

每个 Tab 独立记忆自己的列顺序、显隐与尺寸；切回来自动恢复。

## 2. 技术决策

### D1 兼容性叠加：保留 pane sizing core，只替换 body 渲染

`src/client.js:10155–10366` 的 pane sizing core 是一套经过真机验证、被 `tests/smoke.mjs:1076–1236` 用 `new Function` 直接驱动的纯函数（ratio 归一化、clamp、两级 ceiling、永不缩小未触碰 pane）。它**不依赖任何 JSX**，因此替换 body 不会破坏这些数值断言。

策略：

- 该纯函数块、`Gutter` 组件（12952–13031）、`measureGate`（15419–15441）、两个 ResizeObserver 骨架（15307–15322 / 15361–15376）、`readPanes`/`writePanes`（10368–10379）、`commitPanes`/`endPaneDrag` 的「一次手势一次落盘」节奏，**全部原样复用**。
- ugit 三列恰好复用 `columns` chrome 的既有键：`dirTree → tree`（默认 200px）、`changes → changes`（默认 290px），两列照旧用 `gutter()` 拖宽、照旧写 `PANES_KEY`。
- `diff` 列**不设 `data-pane`、不调 `paneStyle()`、不插 gutter**，靠 CSS `flex:1` 自动占满。`paneGeometry` 里对 `diff` 的高度特判因此不会被消费，无害；纯函数断言照过。
- 删除 17999–18055 的三套 chrome body 分支，换成单个按配置数组 `map` 渲染的 `UgitBody`。
- **兼容性保留**：新 body 容器继续带 `dig-body dig-body-columns`（宽）/ `dig-body-stack`（窄）类名，三列继续带 `.dig-pane-tree` / `.dig-pane-changes` / `.dig-pane-main` 与 `[data-pane]`，顶部继续用 `dig-topbar`。这样 `ssr-check.mjs` 的 4 个 needle、六个真机探针的 `.dig-pane-*` / `[data-pane]` / `.dig-gutter` 选择器、以及 smoke 的 CSS 类名断言都不必连锁改名。
- **诚实更新**：smoke 里少数针对旧 body JSX 的**文本级**断言（如 `dig-body-stack … splitTabs(false,false)`、`dig-pane dig-pane-main }, historyPane, diffGutter, diffPane` 恰好 1 次）改为针对新 `UgitBody` 的断言，不留死代码骗测试。

### D2 分区模型：ZONE_SPECS / AFFIX_SPECS / LAYOUT_KEY

照 `RAIL_SPECS`(9851) + `railOrderOf`/`railOrderText`(9930/9941) + `migrateRailConfig`(10097) 的成熟范式，新建一份**浏览器本地**的布局配置：

- `UGIT_ZONE_SPECS`：列分区权威表（id / 文案键 / 默认可见 / 默认宽 / min / max / 图标）。
- `UGIT_AFFIX_SPECS`：附属分区权威表。
- `LAYOUT_KEY = 'dsh-ide-git.layout.v2'`，读写走 `readLayout()` / `writeLayout()` / `normalizeLayout()`，一律 `try/catch` 静默降级（照 11376–11406 范式）。
- `normalizeLayout()` 丢弃未知/重复 id、按 `UGIT_ZONE_SPECS` 补齐，代码顺序写成空串（同 `railOrderText`），所以以后新增分区不会被旧文档隐藏。
- 旧 `PANES_KEY` 只作为尺寸记忆继续写；**不**从 `RAIL_KEY` 读，写路径禁止回退到任何退役键（不变量 14）。
- 新增分区（`branches`/`history`）的宽度存 `LAYOUT_KEY.extraRatios`，配一个复用 `Gutter` 组件的简化 clamp，不污染 pane core。

### D3 顶部 Tab 视图集与次要视图降级

- 新 `UgitTopbar` 取代旧 `topBar`(17282–17307) 的两条大搜索框：保留 `RepoSelect`、`openBranchSwitchMenu`、upstream ahead/behind chip、动作图标（取自 `RAIL_SPECS`）、设置齿轮；新增 `工作区 | 变更 | 历史` 分段 Tab。
- `activeTab` state 默认 `'changes'`，写入 `LAYOUT_KEY.activeTab`，刷新恢复。
- 分支树不再常驻；「历史」Tab 整块渲染 `historyPane`（`HistoryList` + `CommitDetail`），「工作区」Tab 暴露 `WorktreesPane` 与分支树。
- `view`（`'history' | 'detail' | 'worktrees'`）与 `splitTab` 的旧状态机收敛：`view==='detail'` 归入历史 Tab，`view==='worktrees'` 归入工作区 Tab，`splitTab` 由新 Tab 取代但保留 `tabPane()` 的 `display:none` 保滚动位置手法（17997）。

### D4 目录树复用 buildDirForest

仓库已有 `dirName`(10493)、`buildDirForest`(10508)、`remoteTreeStripOf`(9241) 三个纯函数，正好用于把变更文件路径构造成目录森林。新 `DirTree` 组件只负责渲染树 + 折叠态（`TREE_KEY` 已有 `readTreeState`/`writeTreeState`，9701–9715 直接复用），点击目录过滤变更列表、点击文件打开 diff。不另造数据层。

### D5 大号 split diff 常驻并默认 split

- 复用 `diffPaneOf(true)`(17407–17424) 的 `fillDiff` 形态：`.dig-diff-head` 路径面包屑 + 「在右侧栏打开」+ `DiffBody`(11134) → `LineDiff`(11548)。
- 默认 `split: true`（截图是并排），通过既有 `LINEDIFF_KEY`(11378) 的 `{split, wrap}` 记忆；`LineDiff` 内部的 split/wrap 工具条、`onActiveFile → setDiffPath` 上报链**一行不改**。
- `unified` 即 `split===false`，无需新状态。

### D6 设置面走 localStorage，绕开 configForms

- 在 `RailSettingsCard`(12075) 新增 `fold('layout.settings.title', …)` 一节：逐区显隐 checkbox、上移/下移调顺序（仿 `moveRailAction` 17860 / `dropRailAction` 17869）、默认 Tab 下拉、提交框位置下拉、「恢复默认布局」按钮。
- 另外在面板内设置编辑器（齿轮）提供同一份配置的快捷开关，照 `RailSettings`(12653) 的 items/onMove/onToggle/onReset 装配。
- **关键约束**：新设置项**不能**用 `textRow` / `selectRow` / `const field = '…'` 这些被 `tests/smoke.mjs:1659–1666` 扫描并去宿主 `config.js` 找 `shape.<field>` 的写法。改用独立命名的 `layoutToggle` / `layoutSelect` / `const key = …`，因为它们的存储后端是 localStorage 而非行 Config——命名差异恰好反映后端差异。同时**新增 smoke 断言**覆盖新设置的 localStorage 读写，确保不是靠绕过检查蒙混。
- `configForms` / `config.js` / `RAIL_CONFIG_IDS` 一律不动。

### D7 词典与测试同步演进

- 尽量复用已有键（`changes.title`、`pane.diff`、`toolbar.tree`、`settings.history.title` 等），只新增约 20 个 `layout.*` 键。
- 新键必须 **21 门全同步**（ZH 107 / EN 537 / `LOCALES` 19 门自 973 起），否则 `smoke.mjs:971–1003` 的逐门 `deepEqual` 与多处 `===21` 计数全红。用一次性脚本按 `/* locale: <tag> */` 标记批量插入，插完跑 `npm test` 验证键集。
- `t` 仍必须是查表函数、`ctx.locale.register` 不变（不变量 10）；hooks 依赖数组注意先声明后引用（不变量 12），改完跑 `ssr-check.mjs`。
- 探针与 smoke 的文本断言按 D1 策略诚实更新；`CHANGELOG.md` 按纪律补 `## Unreleased` 条目。

## 3. 数据流

```
挂载
 ├─ readLayout() ──→ { activeTab, tabs, hidden, order, affixes, extraRatios }
 ├─ readPanes()  ──→ { treeOpen, panes:{ 'columns:wide': {tree:ratio, changes:ratio} } }
 ├─ readLineDiffPrefs() ──→ { split, wrap }
 └─ 首帧按 layout.tabs[activeTab].zones 过滤 hidden/order → UgitBody 渲染
                                      │
用户操作                              │
 ├─ 切 Tab      → setActiveTab + writeLayout            → 重渲染列集合
 ├─ 拖 gutter   → 现有 dragPane/withPaneRatio/writePanes → tree/changes 列宽记忆
 ├─ 设置显隐/顺序 → writeLayout                          → 列集合重排
 ├─ 切 split/wrap → LineDiff 既有 useEffect              → LINEDIFF_KEY 记忆
 └─ 点文件      → 既有 onDiff → patch → DiffBody/LineDiff → onActiveFile → diffPath
```

## 4. 持久化 schema

```
LAYOUT_KEY = 'dsh-ide-git.layout.v2'   (localStorage, JSON)
{
  version: 2,
  activeTab: 'changes',                       // 默认 Tab 记忆
  tabs: {                                     // 每个 Tab 的列顺序
    changes:   { order: '' },                 // '' = 代码默认顺序
    workspace: { order: '' },
    history:   { order: '' }
  },
  hidden: ['branches', 'history'],           // 逐区显隐
  order:  '',                                // 全局列顺序，'' = 默认
  affixes: { toolbar: true, iconRail: true, commitBox: true,
             commitBoxPlace: 'changesBottom' },
  extraRatios: { branches: 0.20, history: 0.34 }
}

PANES_KEY   = 'dsh-ide-git.panes.v1'   (沿用，tree/changes 列宽 ratio，按 columns:wide|tall 分桶)
LINEDIFF_KEY= 'dsh-ide-git.linediff.v1' (沿用，{split,wrap})
CHANGES_GROUP_KEY / TREE_KEY           (沿用，分组与折叠节)
```

`normalizeLayout` 保证：未知/重复 id 丢弃、缺失 id 用 `UGIT_ZONE_SPECS` 默认值补齐、`activeTab` 非法回退 `'changes'`、`affixes` 逐项布尔化。

## 5. 组件与改动点（行号以当前 client.js 为准）

| 位置 | 动作 |
|---|---|
| 10155–10366 pane sizing core | **不动**（纯函数，测试直接驱动） |
| 12952–13031 `Gutter` | **不动**（通用控件） |
| 11134 `DiffBody` / 11548 `LineDiff` / 11378 `LINEDIFF_KEY` | **不动**（diff 偏好链） |
| 10493 `dirName` / 10508 `buildDirForest` / 9241 `remoteTreeStripOf` | **不动**（复用给新 `DirTree`） |
| 9701–9715 `TREE_KEY` 读写 | **不动**（复用给目录树折叠） |
| 新增 `UGIT_ZONE_SPECS` / `UGIT_AFFIX_SPECS` / `UGIT_TABS` / `LAYOUT_KEY` / `normalizeLayout` / `readLayout` / `writeLayout` | 放在 pane sizing core 之后、rail config core 之前 |
| 新增 `UgitTopbar` / `UgitIconRail` / `DirTree` / `UgitBody` / `UgitLayoutSettings` | 放在 `RailSettings` 附近的组件区 |
| 17282–17307 `topBar` | 替换为 `UgitTopbar` |
| 17999–18055 body 五分支 | 替换为单个 `UgitBody`（按配置 map 列 + gutter） |
| 17896–17942 `renderRail` | 动作图标收进 `UgitTopbar` / `UgitIconRail`，容量算法改为按顶栏宽度 |
| 12075 `RailSettingsCard` | 新增 `fold('layout.settings.title', …)` 一节 |
| 12653 `RailSettings` / 18103–18118 装配 | 追加布局配置快捷开关 |
| 18498–19208 `CSS` 数组 | 新增 ugit 布局规则；保留兼容类名；`dig-topbar` 改为单行 |
| 107 / 537 / 973… 21 门词典 | 新增约 20 个 `layout.*` 键 |
| 20627 `apply(ctx)` | 无需改（注册面不变） |

## 6. 错误处理与边界

- 所有 localStorage 读写 `try/catch` 静默降级；解析失败/旧版 schema 一律走 `normalizeLayout` 默认值，绝不因坏数据白屏。
- 所有分区都被隐藏时，`UgitBody` 渲染一个「未启用任何功能区」的空态 + 「打开布局设置」按钮，不留 0 宽容器。
- 窄容器（`<400`，右栏）仍按宽度自动折叠：优先保证 `changes` + `diff`，`dirTree` 自动收起但设置里的显隐偏好不丢。
- 浮层继续遵守不变量 13：`.dig-root`（`position:relative`）内 `position:absolute`，锚点减 `hostRef` rect。新顶栏的仓库/分支下拉沿用 `openPickerAt` → `ContextMenu` → `SearchPicker` 链路，不改定位基准。
- 无仓库 / 加载中 / 无差异 / 无提交等既有空态分支保留。
- 破坏性操作（push / discard / force delete）的 `confirm: true` 与二次确认弹窗完全不动。

## 7. 测试策略

| 验证 | 命令 | 关注点 |
|---|---|---|
| 文件级冒烟 + 集成 | `npm test`（CI 唯一门槛） | 词典 21 门键集、`PANE_*` 数值断言、更新后的 body 文本断言、新 localStorage 断言 |
| SSR 自检 | `node scripts/ssr-check.mjs` | `t is not a function`、hooks TDZ、`dig-root/dig-topbar/dig-shell/dig-empty` |
| 布局扫档 | `node scripts/layout-probe.mjs "<url>" [out]` | 11 档宽度下 chrome、header 不溢出、零 pageerror |
| 拖拽记忆 | `node scripts/panes-probe.mjs "<url>" [out]` | 拖拽生效、reload 保持、wide/tall 不串桶、overlay 夹取 |
| 设置卡 | `npm run probe:settings-card` | 新开关双向翻转、跨 reload 保持、16 连点全落地 |
| 对话区座位 | `node scripts/conversation-probe.mjs "<url>" [out]` | 第三座位、`chrome==='columns'`、`/remote` 回退、placement 开关 |
| 外观 | `node scripts/screenshots.mjs <web-url> [out]` | 重拍 `docs/screenshots/` 6 张为 ugit 形态 |

真机验证纪律（AGENTS.md）：独立 `DSH_HOME` + 端口 3099 隔离实例，验证完自己杀掉；**绝不碰 3080、绝不替用户重启**；用发布版 CLI 而非本机 dev checkout。

## 8. 分阶段实施

1. **配置层**：`UGIT_ZONE_SPECS` / `LAYOUT_KEY` / `normalizeLayout` / `readLayout` / `writeLayout` + 新 smoke 断言（纯函数，先绿）。
2. **词典**：21 门批量插入 `layout.*` 键，`npm test` 验证键集。
3. **新组件**：`UgitTopbar` / `UgitIconRail` / `DirTree` / `UgitBody` / `UgitLayoutSettings`。
4. **接线**：替换 `topBar` 与 body 五分支，收敛 `view`/`splitTab`/`renderRail`。
5. **CSS**：ugit 单行顶栏、三列主体、大 diff、提交框内嵌。
6. **设置面**：设置卡新增布局节 + 面板内快捷开关。
7. **测试与探针**：诚实更新 smoke 文本断言、探针选择器；跑全套验证。
8. **收尾**：`CHANGELOG.md` 补条目、重拍 README 效果图、`AGENTS.md` 更新布局不变量（不变量 7 的 `columns/stack/compact` 描述改为 ugit 分区模型）。
