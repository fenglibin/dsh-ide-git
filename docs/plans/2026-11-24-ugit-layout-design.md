# ugit 布局重构设计（2026-11-24，审查修订版）

> 本文件是 `record_design` 摘要指向的**完整方案草稿**，也是本次交付的完整设计文档。任务已因补齐 OpenSpec 工件被抬升为 **l2**（`get_delivery_task` 返回 `level: "l2"`），因此另有第二份设计文档 `openspec/changes/refactor-ugit-layout/design.md`（`record_spec(kind:'design')` 写入）。**两份都要自足、都要满足审查第 6/7/8 条**（每个 `### D<n>` 决策含「选了什么/为什么/被否决备选/影响面」）；openspec 版不再只做索引。`.dsh/design/task-bf6fda5a-fec3-495f-9d29-cb60c2acc2eb.md` 是本文的摘要，若三者冲突**以本文为准**，但摘要中的过时结论不得再被当作事实。
>
> 本文所有行号以当前 `src/client.js`（20972 行）为准，引用符号均已用 `grep -n` 逐项确证（见附录 A 确证清单）。

## 0. 需求基线与追溯索引

### 0.1 原始需求编号（任务 objective）

| 编号 | 原文要点 |
|---|---|
| req/1 | 当前界面展示样式不习惯 |
| req/2 | 重点信息「变更的文件」「文件变更的差异视图」没有重点突出 |
| req/3 | 不常关注的信息「分支或标签」「提交记录」被重点突出**且无法隐藏** |
| req/4 | 按 **ugit 布局**重新实现当前插件（附参考截图） |
| req/5 | 设置中增加对功能区的**隐藏及打开** |
| req/6 | 调整**位置大小**后要能够**自动记忆** |
| req/7 | 记忆**记录到当前浏览器中即可** |
| req/8 | 提供截图作参考实现 |

### 0.2 对齐后的结论（`.dsh/analysis/…md` + 四轮问答）

| 编号 | 结论 |
|---|---|
| a/1 | 直接替换为 ugit 布局，旧三栏不保留、不做切换开关 |
| a/2 | 分支树/标签、提交图谱走顶部 Tab 切换的独立视图（工作区/变更/历史），默认「变更」 |
| a/3 | 配置四项全要：功能区显隐开关；分区拖拽调尺寸+记忆；功能区位置/顺序调整+记忆；默认 Tab 与 diff 模式记忆 |
| a/4 | 目录树保留为独立、可隐藏的窄列分区 |
| a/5 | 记忆介质 = localStorage，不写宿主行 Config / profile |
| a/6 | 实现策略「换血不换骨架」：复用机制层、保留兼容类名，只替换 body 渲染与顶栏 |

### 0.3 明确不在范围（逐条理由）

| 不做 | 理由 |
|---|---|
| 宿主半 `src/index.js` / `src/host/*`、方法表、写队列、撤回、破坏性守卫 | 纯客户端视觉重构，不涉及 Git 读写；改宿主会触发 `tests/api.test.mjs` 全量回归与信任围栏风险（不变量 4/5/15/16） |
| 新依赖、第二个 client entry、构建步骤 | 不变量 1：`window.__ModuleLoader__.load` 单文件包装，smoke L92–107 的 BASELINE 白名单强制 |
| 旧三栏的「经典模式」切换开关 | a/1 用户明确选择直接替换；保留两套渲染会长期维护双份词典/设置/尺寸记忆 |
| 新增 `src/host/config.js` 的 volatile 字段、动 `RAIL_CONFIG_IDS` | a/5 记忆在浏览器本地；动作条 `RAIL_SPECS` 是既有功能，不属于本次「功能区」概念（见 D2 的术语消歧） |
| `configForms` 绑定、`plugins.bundle.config` 注册面 | a/5；现有注册面（apply 20627）已够用，布局开关放**面板内齿轮**而非插件页卡（D6 已据 `settings-card-probe.mjs` 修正落点） |
| 改 `README_EN.md` 之外的文档语言、改 `package.json` version / 发版 | 版本发布是独立流程（AGENTS.md 变更记录纪律），本次只补 `## Unreleased` |
| 修 `useState(readLineDiffPrefs)` 之外任何 diff 内部逻辑 | D5：LineDiff 是经过 issue #16/#22/#28 验证的桥接组件，不往里堆功能（AGENTS.md 宿主演进跟随） |

### 0.4 容易误认为在范围、但显式排除的事（逐条表态）

| 易误认 | 表态 | 理由 |
|---|---|---|
| 把「分支或标签」「提交记录」彻底删除 | **不做**，降级为默认隐藏、可打开 | req/3 说的是「无法隐藏」，不是「不需要」；a/2 也要求它们仍可达 |
| 把 `branches`/`history` 做成默认可见的第 4/5 列 | **不做**，默认隐藏在「变更」Tab | req/2 要求变更/diff 是主角；默认多列会重新稀释主视野 |
| 让每个 Tab 都记住一套**尺寸** | **不做**，只记 `activeTab` 与逐区显隐/顺序；尺寸走全局 `PANES_KEY` 的 `columns:wide|tall` 两桶 | a/3 的「位置大小记忆」指分区尺寸，不是「每个 Tab 一份尺寸」；多套尺寸会让 `panBucket` 分桶语义爆炸，且与既有 `tests/smoke.mjs:1096` 六桶断言冲突 |
| 支持拖拽把列从横向改成纵向（真正二维 dock） | **不做**，顺序 = 横向左右次序，位置 = 提交框内嵌/底栏二选一 | req/6 的「调整位置」按截图理解为列次序与提交框落点；二维 dock 需要重写 `Gutter` 的 `side` 邻接假设（12954），代价远超需求 |
| 把记忆同步到 profile / 跨浏览器 | **不做** | req/7「记录到当前浏览器中即可」 |
| 重做 `LineDiff` 的语法高亮 / 词级 diff / hunk 折叠 | **不做** | AGENTS.md「宿主演进跟随」：等官方 ui-deliverables re-export，LineDiff 只是桥接 |
| 改 `docs/screenshots/` 的文件名或数量 | **不做**，仍为 6 张同名图 | `screenshots.json` 与两份 README 的两列表格按名引用；改名要同步 3 处且无收益 |
| 改 `dsh-better-sidebar` 底座、原生右栏注册、对话区第三座位 | **不做** | 不变量 6 的两座位互斥注册与 `conversation.view` 槽是既有能力，本次只改 Panel 内部布局 |
| 照参考图复刻「储藏变更」复选框、「推送远程」单选、「待提交(0)」计数、「提交至 master」按钮文案 | **不做**，见 §1.3 | 这些是 ugit 的提交策略 UI；仓库已有 `amend`(14140)、`commitAndPush`(189/14155)、`stashPush` 方法表与 `changes.commitPlaceholder` 文案，形态不同。本次只保留既有提交框的 `amend`/AI 写信息/提交/提交并推送四件套；硬复刻会新增未要求的提交语义并牵动 `confirm: true`（不变量 4） |
| 照参考图复刻「文件视图 / 查看修改」按钮、「监视」开关、「UTF-8 / LF」编码指示、底部状态栏「5.5.3.0 ARM64 Tencent」 | **不做** | 属于 ugit 编辑器/平台外壳，不是 Git 工具窗口职责；本插件是 DSH 侧边栏 Tab，宿主外壳不由它画 |
| 照参考图复刻目录树里的「新版本已发布 升级」胶囊、左下角云/机器人图标、右下角头像 | **不做** | 平台推广/账号装饰，与 Git 无关 |
| 新增「三列表 / 树形」视图切换的**新状态** | **不做新状态**，复用既有 `groupBy` | 见 §1.3，已有 `readChangesGroupBy`/`setGroupBy`/`onGroupBy` 与 21 门 `changes.group*` 文案 |
| 照参考图在顶栏做 `2月前 ▾` / `4天前 ▾` 两个时间下拉，或把历史筛选搬到顶栏 | **不做**，见 D3「能力缺口显式列出」 | 本仓库只有 `HistoryList` 单一 `since` 内部 state(14571) 与单一日期下拉(14847)，无 `until`、无第二下拉、无 props 入参；实现需改 `HistoryList` props + `rows` 派生 + 宿主 `log` 方法表，超出视觉重构范围。历史筛选仍留历史 Tab 的 `filterBar`(14814) |

### 0.5 需求歧义、矛盾与采用的解释

| 歧义 | 采用的解释 | 被排除的解释 / 理由 |
|---|---|---|
| req/5「隐藏及开打（打开）」 | 「打开」= 逐区显隐开关的**双向**动作：每区一个 checkbox，勾选显示、取消隐藏；另有「恢复默认布局」把全部区恢复到 `UGIT_ZONE_SPECS` 默认可见集。**落点 = 面板内齿轮 `RailSettings`（D6）**，不是插件页设置卡 | 被排除：只提供隐藏、靠清 localStorage 才能恢复 —— 那不是「打开」，且会让用户丢配置（分析完成判定③要求刷新后恢复） |
| req/6「调整位置大小」 | 「大小」= 列宽拖拽（沿用 `Gutter`+`PANES_KEY`）；「位置」= ①列的左右次序（上移/下移）②提交框落点（变更列底部 / 面板底部） | 被排除：自由二维停靠 / 浮动窗口 —— 与 `Gutter` 的 `previousElementSibling` 邻接假设（12954）冲突，且截图只呈现横向三列 |
| a/2「顶部 Tab 切换独立视图」vs req/3「分支/提交记录无法隐藏」 | 二者叠加：Tab 决定**默认列集合**，显隐决定**该集合内是否还能把某区加回来/去掉**；「历史」Tab 里提交图谱默认可见，「变更」Tab 里默认不可见 | 被排除：Tab 与显隐二选一 —— 那样「打开分支树」在变更 Tab 里做不到，违背 req/5 |
| 「变更 Tab 的列集合」与全局 `hidden[]` 谁优先 | **显隐优先**：`UGIT_TABS[activeTab].zones` 给出候选列，`hidden[]` 再从中剔除；`branches`/`history` 在任何 Tab 都可由设置显式打开，打开后追加到该 Tab 列集合尾部 | 被排除：Tab 硬覆盖显隐 —— 用户「打开」的动作会被切 Tab 悄悄撤销 |
| req/4「按 ugit 布局」的精确含义 | 以两张参考截图为准：单行顶栏 + 最左竖排图标 rail + 三列（目录树｜变更列表+列底提交框｜大号并排 split diff）；diff 面积最大。**截图里属于 ugit 平台/编辑器外壳的元素（两个时间下拉、储藏变更、UTF-8/LF、文件视图等）按 §0.4/§1.3 逐项排除，不因「截图里有」就自动纳入范围** | 被排除：只调旧三栏的主次比例 —— 用户明确选了 a/1「直接替换」；也排除「截图逐像素复刻」—— 本插件是 DSH 侧边栏 Tab，宿主外壳与 ugit 编辑器能力不由它画 |
| 「功能区」的两种可能所指 | 本文统一指**布局分区**（`UGIT_ZONE_SPECS` / `UGIT_AFFIX_SPECS`）；既有 `RAIL_SPECS` 的动作条按钮仍叫「动作」，属 `RAIL_CONFIG_IDS` 行 Config，不纳入本次显隐 | 被排除：把动作条也并入「功能区」—— 会撞 `tests/smoke.mjs:1659–1666` 的字段扫描与不变量 14 |

## 1. 信息架构（需求 req/1、req/2、req/4、a/1、a/2、a/4）

参考截图（`企业微信截图_21bed130…png`，1087×588；仓库内 `docs/screenshots/1-bottom-workbench.png` 为旧布局对照）精确形态：

```
┌─ 单行顶栏 ─────────────────────────────────────────────────────────────────────┐
│ yapidoc-maven-plugin ▾ │ 工作区 · 变更(高亮) · 历史 │ master ▾ │ ↑7 ↓1 ▾ │ ↥更新 ⤓更新 ⇧推送 │ ⚙ ▢ │  ← 注：截图里的「2月前/4天前」两个下拉本次不做，见 §0.4 与 D3
├──┬──────────┬───────────────────────────┬─────────────────────────────────────┤
│图│ 目录树    │ 变更 (37)  [三列表|树形]   │ 路径面包屑   文件视图 查看修改  ⋯ 监视 │
│标│ 搜索框    │ Default ▾  状态分组+图标   │ 基础版本 ┃ 本地修改   UTF-8 · LF      │
│r │ 目录层级  │ .gitignore / scripts/...  │ 行号 · Shiki 高亮 · ±统计 · 同步滚动  │
│a │ (可隐藏)  │ …                         │ split / wrap / 在右侧栏打开          │
│i │          ├───────────────────────────┤                                     │
│l │          │ 待提交 (0) · 储藏变更      │                                     │
│  │          │ 提交信息框                 │                                     │
│  │          │ 提交至 master ▾            │                                     │
└──┴──────────┴───────────────────────────┴─────────────────────────────────────┘
```

- **主角（req/2）**：`diff` 列用 `flex:1` 占满剩余宽度，是面积最大的分区；`changes` 次之；`dirTree` 最窄。**默认 split 并排**（见 D5）。清晰截图里 diff 约占整幅 55%，明显宽于变更列（约 27%）与目录树（约 14%）。
- **降级（req/3、a/2）**：分支树/标签、提交图谱默认不出现在「变更」Tab；顶部工具条只保留当前分支下拉指示器（不再是常驻的一整棵树 + 两条大搜索框）。
- **打开（req/5）**：`branches`/`history` 可在设置里逐区勾选打开，打开后作为附加列追加到当前 Tab；「历史」Tab 默认带 `history`。
- **目录树（a/4）**：独立、可隐藏的窄列，照截图带自己的搜索框与目录层级。
- **提交框（req/6「位置」）**：默认内嵌在变更列底部（截图形态），可切换到面板底部。

### 1.3 参考截图逐元素对照（回答第 5/11/17 条：每个元素都表态做/不做及落点）

| 截图元素 | 做 / 不做 | 落点（做的话给具体符号） |
|---|---|---|
| 单行顶栏：仓库▾ / 工作区·变更·历史 / 分支▾ / ahead·behind chip / 检查更新·更新·推送 / 窗口控制 | **做** | `UgitTopbar`（D3）：`RepoSelect`(13258)、`openBranchSwitchMenu`(17274)、`dig-track`(17297–17299)、`RAIL_SPECS` 的 fetch/pull/push/update 动作(9851)、`dockFaceOf`(10393) 的窗口控制 |
| 截图顶栏的 `2月前 ▾` / `4天前 ▾` 两个时间下拉 | **不做**（能力缺口，见 D3） | 本仓库只有 `HistoryList` 的**单一** `since` 内部 state(14571) + 单一日期下拉(14847，选项 today/week/month/year，`sinceThreshold` 14518)，**无 `until`、无第二个时间下拉、无 props 入参**。按 §0.4 边界不实现；历史筛选仍留在历史 Tab 的 `filterBar`(14814)，**不搬到顶栏**。确证命令：`grep -n "props\.(since\|until)" src/client.js`（零命中） |
| 最左竖排图标 rail（提交/文件/收藏/搜索/… + 底部设置） | **做** | `UgitIconRail`（D3），复用 `RAIL_SPECS` 图标与 `renderRail` 的 `dig-rail-btn` 样式(18538–18543)；齿轮沿用 `.dig-rail-settings`(17939) |
| 目录树列：列头「**目录树**」标签 + `F↓` 折叠/刷新图标、搜索框、目录层级、文件类型图标（□/◇）、选中高亮 | **做（部分复用既有）** | `DirTree`（D4）复用 `buildDirForest`(10508) / `dirName`(10493) / `remoteTreeStripOf`(9241) / `TREE_KEY` 折叠(9701) 与 `Icon` 的 `folder` 字形；列头标签用 `layout.zone.dirTree` 既有键(21 门)、刷新按钮调 Panel 的 `refresh()` 且图标用 `toolbar.refresh` 既有键（不新造请求/文案键）；文件类型方框图标用 `dig-file-status-*` 既有色块，不新增 `FileTypeIcon` 之类的新组件（AGENTS.md 规定 LineDiff 的积木才来自 seed 表） |
| 变更列头：`变更 (37)` 计数 + `Default▾` + `三列表\|树形` + 右侧锁定/下载/↑↓/更多 四个图标 | **做（既有）** | `ChangesPanel` 的 `dig-changes-head`(14153) 已有 `dig-count` 与 `onMoreMenu` 的 `⋯` 按钮(14792–14800)；「锁定/下载/↑↓」在既有实现里已收进 `onMoreMenu` 的 `⋯` 菜单（`more.sort*` / `more.sync` 等条目），本次**不新增**列头按钮（避免撞 `smoke.mjs:1246–1249` 的 `head` 文本断言）；`total` 来自 `summary`，无需改 |
| 变更列头：`三列表 / 树形` 切换 | **做（复用既有，不新造状态）** | 既有 `groupBy`(15682) + `readChangesGroupBy`(11398) + `setGroupBy`(15684) + `onGroupBy: setGroupBy`(17685) + 21 门 `changes.groupFlat`/`changes.groupDir`/`changes.groupBy` 文案(182–184 等)。**注意**：截图文案是「三列表/树形」，既有文案是「平铺/按目录」，语义对应但字面不同；本次**不新增文案键**（避免 21 门同步成本），沿用既有文案，`UgitBody` 把它放在变更列头右侧 |
| 变更列头：`Default ▾`（排序下拉） | **做（复用既有，不新造状态）** | 既有 `sortKey`(15687) + `setSortKey`/`sort()`(17550–17553) 的 `more.sortGit`/`more.sortPath`/`more.sortName`/`more.sortStatus` 四选一菜单(17550–17553)；`ChangesPanel` 按 `sortKey` 排序(13952–13954)。截图字面「Default」对应 `sortGit`，本次**不新增文案键**，沿用既有菜单 |
| 变更行：黄色 `M` / 绿色 `A` / `?` 状态图标 + 路径 + 目录分组 + 选中高亮 | **做（既有）** | `ChangeRow`(13718) 的 `dig-file-status dig-file-status-<M\|A\|U\|…>`(13741) + `dig-row-selected`(13730) / `ChangesPanel` 的 `groupBy:'dir'`(13790) / `foldedDirs`(13796) / `onSelectionChange`(17705) |
| 变更列「纯扁平全路径、无分组头」(清晰截图里 37 行文件全路径 + 状态图标 + ±统计) | **做**（`ugitFlat`，参考图最终收口时补齐） | `ChangesPanel` 新增可选 prop `ugitFlat`：`true` 时跳过 `emitGroup` 的分组头,把 5 个状态组的文件合并按 `sortKey` 排成一个扁平列表,每行复用既有 `ChangeRow`(`depth=-1` 显示 `dig-row-dir` 目录段 + basename + `dig-stat-add`/`dig-stat-del` ±统计)。**只由 ugit 布局的 `E(ChangesPanel, {…})` 传 `true`**,其他调用方保持分组视图,故不动宿主/数据结构/探针的 `.dig-group-head` 断言。真机证据:`.dig-group-head`=0、7 行 `.dig-row-file` 全带目录段与 ±统计、`PAGEERRORS`=[]。`groupBy`/`sortKey`(`三列表|树形`/`Default▾`) 既有能力仍可切 |
| 大号 split diff：路径面包屑 + 基础版本┃本地修改 + 行号 + Shiki 高亮 + ±统计 + 左右同步滚动 + `UTF-8 / LF` 字样 | **做（同步滚动/高亮既有；`UTF-8 / LF` 不做）** | `fillDiff`(17960) → `DiffBody`(11134) → `LineDiff`(11548)，默认 `split:true`（D5）；同步滚动 = `SplitColumns`(11459) 的 `scrollLeft`/`scrollTop` 镜像(11470)；「在右侧栏打开」沿用 `diff.sidebar.*`(17410–17417)。`UTF-8 / LF` 是编辑器编码指示，§0.4 已表态不做 |
| diff 头部：`文件视图 / 查看修改 / ⋯ / 监视` | **不做** | §0.4 / §1.3：属 ugit 编辑器工具条，非 Git 工具窗口职责 |
| 提交框：待提交(0) / 「储藏变更」复选框 / 「**推送远程**」复选框(已勾选) / 提交信息框 / 「提交至 master ▾」+ 🔒 | **只做「提交信息框」，其余不做** | `ChangesPanel` 的 `composer`（D6 的 `commitBoxDocked` CSS class 方案）：保留 `textarea`(`changes.commitPlaceholder`)、`amend`(14140)、AI 写信息(14124–14132)、`提交`(14151)、`提交并推送`(14155, `changes.commitAndPush`)。「待提交(N)」计数 / 「储藏变更」/「推送远程」两个复选框 / 「提交至 <分支>」文案 / 🔒 图标**不新增**（§0.4 已逐条表态），理由：会引入未要求的提交策略语义并触碰不变量 4 的确认链路；`stashPush` / `commitAndPush` 既有能力仍在动作条里可达 |
| diff 头部：`文件视图 / 查看修改 / ↑↓统计 / ⋯ / 监视 / 🔍搜索 / UTF-8 LF` | **不做** | §0.4 已表态：属 ugit 编辑器工具条/编码指示，非 Git 工具窗口职责；本插件 diff 头部只保留既有「路径面包屑 + 在右侧栏打开 + 关闭 + split/wrap 工具条」 |
| 顶部「新版本已发布 升级」胶囊、底部平台状态栏、云/机器人/头像图标 | **不做** | §0.4 已表态：平台推广/账号装饰 |

### 1.1 分区清单（唯一权威表 = `UGIT_ZONE_SPECS`）

| id | 默认可见 | 默认宽 | pane key | 组件 / 落点 | 需求来源 |
|---|---|---|---|---|---|
| `dirTree` | 是 | 200px | `tree` | 新 `DirTree` → `buildDirForest`(10508) | a/4、req/4 |
| `changes` | 是 | 290px | `changes` | 既有 `ChangesPanel`(13757) | req/2 |
| `diff` | 是 | `flex:1` | **无**（见 D1） | 既有 `DiffBody`(11134)→`LineDiff`(11548) | req/2、req/4 |
| `branches` | 否（可打开） | 220px | 无 | 既有 `BranchTree`(13382) | req/3、req/5、a/2 |
| `history` | 否（可打开） | 360px | 无 | 既有 `HistoryList`(14532)+`CommitDetail`(14936) | req/3、req/5、a/2 |

附属分区（只显隐，`commitBox` 另可换落点）= `UGIT_AFFIX_SPECS`：`toolbar`（单行顶栏）、`iconRail`（最左竖排图标 rail）、`commitBox`（提交框）。

来源说明（回答「引入了需求没提到的东西」）：
- `iconRail`、`toolbar`：**来自参考截图**（req/8、req/4），不是凭空新增；若省略，`dig-root` 会与截图明显不符。
- `branches`/`history` 作为「可打开列」：来自 req/3「无法隐藏」+ req/5「隐藏及打开」—— 必须存在才能被「打开」。
- `workspace` Tab：来自 a/2 用户明确选定的「工作区 / 变更 / 历史」三 Tab 之一，不是新增。
- `extraRatios`：见 D2，`branches`/`history` 是 `Gutter` 之外的附加列，需要一个尺寸落点；若不做，用户「调整大小」(req/6) 对这两个区不成立。
- 三 Tab 各自记 `order`：**来自 a/3「位置/顺序调整 + 记忆」**，但只记顺序与显隐，尺寸按 0.4 显式不做多套。

### 1.2 三种 Tab 视图集（`UGIT_TABS`）

| Tab | 候选列集合 | 默认可见 | 说明 | 来源 |
|---|---|---|---|---|
| `changes`（默认） | `dirTree, changes, diff`（+ 显式打开的附加列） | 三者 | ugit 截图形态 | req/4、a/2 |
| `workspace` | `branches, dirTree, changes, diff` | 四者 | 分支树 + `WorktreesPane`(14974) 入口 | a/2 |
| `history` | `history` | 一者 | 提交图谱 / 提交详情（`view==='detail'` 时 `historyPane` 即 `CommitDetail` 含文件列表），点文件仍走既有 `showDiff`/右侧栏预览；diff 不占空列 | a/2、req/3 |

优先级（0.5 已表态）：`UGIT_TABS[activeTab].zones` 给候选 → `hidden[]` 剔除 → 显式打开的附加列追加到尾部。

## 2. 技术决策

> 每个决策写明：选了什么、为什么、被否决的备选、影响面、可追溯的需求/约束编号。

### D1 兼容性叠加：保留 pane sizing core，但显式处理 `diff` 缺席

**选了什么**：原样复用 `src/client.js:10155–10366` 的 pane sizing core 纯函数、`Gutter`(12952–13031)、`measureGate`(15419–15441)、两个 ResizeObserver 骨架(15307–15322 / 15361–15376)、`readPanes`/`writePanes`(10368–10379)、`commitPanes`/`endPaneDrag` 的「一次手势一次落盘」。ugit 三列复用既有 pane key：`dirTree→tree`（`PANE_DEFAULTS['columns:tree']={px:200}`，10202）、`changes→changes`（`{px:290}`，10203）。

**为什么**（a/6）：这套机制被 `tests/smoke.mjs:1076–1236` 用 `new Function` **直接驱动**并做了数值断言（440/324/200px、六桶 `PANE_BUCKETS`、两级 ceiling），且经过 `panes-probe.mjs` 真机拖拽/重载回归。重写等于同时放弃数值验证与真机验证。它不依赖任何 JSX（`/* ---- pane sizing core` 到 `/* ---- end pane sizing core ---- */` 是纯函数），替换 body 不会破坏断言本身。

**被否决的备选**（用户第 7 条要求）：
- *B：另起 `UgitPanel` 并行 UI，旧 `Panel` 保留，设置里切换* —— 否决：a/1 明确「直接替换、旧布局不保留开关」；两套 5000+ 行 UI 要双份词典/设置/尺寸记忆。
- *C：彻底重写 `PANE_*` 常量、CSS 类名、探针选择器为全新命名* —— 否决：会让 `tests/smoke.mjs`（约 30+ 处硬编码字符串）、`scripts/layout-probe.mjs:119` 的 `CHROMES`、`panes-probe.mjs`、`dock-probe.mjs`、`selection-probe.mjs`、`conversation-probe.mjs:404` 同时失去回归能力；用户在问答里也选了「兼容叠加」。
- *D：只调旧三栏主次、加显隐* —— 否决：a/1，且 diff 仍是嵌在中间列的小窗，不满足 req/2「重点突出」。

**`diff` 缺席的显式处理（二次修订；初审稿与第一次修订均有误，以本段为准）**：`paneGeometry`(10298) 的 `keys = PANE_CHROME_KEYS[chrome].slice()` 对 `columns` 恒为 `['tree','changes','diff']`；10319 的 `space`、10324 的固定遍历 `['changes','tree','diff']`、10348 的 `ideal = space - reserve - taken`（其中 `taken` 按 10341 **显式排除 `diff`**）都假设第三个 pane 存在。若 `diff` 不设 `data-pane`，`measurePanes`(15393) 不会返回 `diff`，`effective.diff` 会退化为 `PANE_DEFAULTS['columns:diff']={ratio:0.55}` × `box.height`（10312/10315），`changes` 的 ceiling 被按「三列」错误压窄。因此必须让 `measurePanes` 能量到 diff 的真实高度。

> **最终做法：直接复用 `fillDiff`，不加任何新 `paneStyle` 调用。** 确证：`diffPaneOf(true)`(17407) 已经带 `'data-pane': 'diff'`，且 `style: fill === true ? null : paneStyle('diff')`（17407 原文）——`fillDiff`(17960) 的 inline style 正是 `null`。CSS(18941) `.dig-diff-pane-fill{flex:1;max-height:none;border-top:none}` 已让它填满父容器。所以 `UgitBody` 把 `fillDiff` 放进 `.dig-pane-main`（该类名 CSS 18627 已是 `flex:1;min-width:0`）即可：宽度由 flex 撑满、高度由 `dig-diff-pane-fill` 撑满、`measurePanes` 照常量到 diff 高度、`paneGeometry` 的 clamp 语义**一字不改**。
> **绝不调用 `paneStyle('diff')`**：`paneStyle`(15505) 对 `key==='diff'` 返回 `{height, maxHeight}`，套到横向主列上会强行给出 55% 高度上限，把主角压成半高。第一次修订稿「给 diff 挂 data-pane 并调 paneStyle('diff')」的判断**已作废**。
> `diff` 列**不插 gutter**（不提供横向拖拽），`gutter('changes','next')`(18040) 仍拖 `changes` 列宽。`PANE_DEFAULTS['columns:diff']` / `PANE_LIMITS['columns:diff']` 保持原值不动（纯函数断言照过）。`smoke.mjs:2345` 的 `dig-diff-pane / fill` 文本断言与 `:2372` 的 `diffPaneOf` 签名断言因此**原样成立**。

这与「diff 是主角」一致：`flex:1` 决定宽度，`data-pane` 只用于高度测量。初审稿「diff 不设 data-pane 无害」与第一次修订「调 paneStyle('diff')」**两版判断均已作废**。

**兼容性保留清单（逐项确证）**：

| 保留项 | 依赖方 | 确证 |
|---|---|---|
| `dig-root` / `dig-topbar` / `dig-shell` / `dig-empty` | `ssr-check.mjs:86` 的 4 个 needle | 已确证；`dig-shell` 在 18457 |
| `dig-body dig-body-columns`（宽容器） | `layout-probe.mjs:119` `CHROMES`、`conversation-probe.mjs:404/411`（硬编码 `chrome==='columns'`） | 已确证 |
| `dig-body-stack` / `dig-body-compact`（窄容器 `<400`） | `layout-probe.mjs`、`panes-probe.mjs:147`、`dock-probe.mjs:147` 的 `/dig-body-(columns\|stack\|compact)/` | 已确证；****chrome 判定仍保留（决定 CSS 方向），但三套 chrome 全部渲染同一个 UgitBody**——旧 stack/compact 里常驻分支树+图谱的 JSX 已删除（真机验证发现窄右栏仍是旧三栏、违背 req/3，故改为统一走 ugit 分区语义），不变量 7 的宽度测量仍不破 |
| `.dig-pane-tree` / `.dig-pane-changes` / `.dig-pane-main` / `[data-pane]` | `panes-probe.mjs:156–164`、`selection-probe.mjs`、`smoke.mjs:1849–1860` 的 border-l2 选择器 | 已确证（CSS 18625–18629） |
| `dig-root-narrow` 标记 | `smoke.mjs:1706–1708`、`panes-probe.mjs:266` | 已确证 |
| `RAIL_VIEW_IDS` / `RAIL_SPECS` 五个视图动作 | `smoke.mjs:935`、`dock-probe.mjs` 的 `[data-action]` | 已确证（9886）；**动作条不删**，`renderRail` 改为收进顶栏/图标 rail |
| `.dig-split-tabs` / `tabPane` | `smoke.mjs` 旧断言 | **已删除**（旧 compact/stack tabbed diff 机制整体移除）；`smoke.mjs` 的 tree-toggle 与 chrome 断言已诚实改为「UgitBody / 所有 chrome 共用」等价断言 |
| `dig-tab-pane` / `dig-tab-pane-hidden` | `smoke.mjs:2351–2355` | 已确证；保留 `tabPane()` 的 `display:none` 保滚动位置手法 |
| `diffPaneOf(fill)` 签名与 `paneStyle('diff')` | `smoke.mjs:2345/2372` | 已确证；保留 `fillDiff` 作为大 diff 的载体 |

**诚实更新的 smoke 断言（原稿说「少数」，修订为完整清单）**：删掉旧三套 body 分支后，以下断言必须**改为针对 `UgitBody` 的等价断言**，而不是删除或留死字符串骗测试：
- `smoke.mjs:2368` `/dig-body-stack[\s\S]{0,1400}splitTabs\(false, false\)/`
- `smoke.mjs:2370` `/className: 'dig-pane dig-pane-main' \}, historyPane, diffGutter, diffPane/` 恰好 1 次
- `smoke.mjs:2357–2358` `'data-action': 'diff-tab'` / `'history-tab'`（顶部 Tab 换 id 后同步）
- `smoke.mjs:2361/2366` `compact: ['tree','changes']` / `stack: ['tree','changes']`（`PANE_CHROME_KEYS` 不动，这两条**保留**）
- `smoke.mjs:2345` `dig-diff-pane` / `fill` 形态（保留 `fillDiff` 后仍成立）
- 新增：针对 `LAYOUT_KEY`/`normalizeLayout`/`readLayout`/`writeLayout` 的纯函数切片断言（防「绕过 configForms 就没有测试」）

**影响面**：`src/client.js`（Panel return、body 分支、`renderRail`、`topBar`）、`tests/smoke.mjs`（上述断言）、`scripts/*.mjs` 探针（仅当选择器变动时）。`src/host/*`、`tests/api.test.mjs`、`repos.test.mjs`、`graph.test.mjs` 不受影响。

### D2 分区模型：`UGIT_ZONE_SPECS` / `UGIT_AFFIX_SPECS` / `UGIT_TABS` / `LAYOUT_KEY`

**选了什么**：照 `RAIL_SPECS`(9851) + `railOrderOf`(9930) / `railOrderText`(9941) + `migrateRailConfig`(10097) 的成熟范式，新建一份**浏览器本地**配置：
- `UGIT_ZONE_SPECS`：列分区权威表（id / 文案键 / 默认可见 / 默认宽 / min / max / 图标），唯一权威，增删分区只改这里。
- `UGIT_AFFIX_SPECS`：`toolbar` / `iconRail` / `commitBox`。
- `UGIT_TABS`：三个 Tab 的候选列集合。
- `LAYOUT_KEY = 'dsh-ide-git.layout.v2'`（**新键，与现有 11 个 key 无冲突**，见附录 A）；`normalizeLayout` / `readLayout` / `writeLayout`，一律 `try/catch` 静默降级（照 11376–11406 范式）。
- `normalizeLayout` 丢弃未知/重复 id、按规格补齐、代码顺序写空串（同 `railOrderText`），所以以后新增分区不会被旧文档隐藏。
- `PANES_KEY` 继续承载 `tree`/`changes` 列宽 ratio（按 `columns:wide|tall` 两桶）；`branches`/`history` 的附加列宽存 `LAYOUT_KEY.extraRatios`，用**复用 `Gutter` 组件的简化 clamp**（min/max 来自 `UGIT_ZONE_SPECS`），不污染 pane core。

**为什么**（a/5、req/7、不变量 14）：用户明确「记录到当前浏览器中即可」，所以后端是 localStorage 而非行 Config；照搬 `RAIL_SPECS` 范式是为了复用「丢弃未知/重复 id、按规格补齐、代码顺序写空串」这套已验证的归一化纪律，而不是另发明。旧 `RAIL_KEY`(9845) 已退役，写路径**禁止**回退到它（不变量 14）。

**被否决的备选**：
- *走行 Config（`configForms` + `config.js` volatile 字段）* —— 否决：a/5 明确排除；且 `tests/smoke.mjs:1659–1666` 会把每个新字段强制去宿主找 `shape.<field>`，与「浏览器本地记忆」语义不符。
- *把新配置塞进现有 `PANES_KEY`* —— 否决：`normalizePanes`(10243) 只认固定六桶与 `tree/changes/diff` 三 key，塞进去会被静默丢弃（`smoke.mjs:1106–1129` 断言其形状）。
- *不设权威表、直接在 JSX 里写 `hidden[]`* —— 否决：新增分区时旧文档会隐藏新区（不变量 14 的教训）。

**影响面**：`src/client.js` 新增约 120 行纯配置函数（**最终落点 `writePanes`(10379) 之后、`/* ---- dock action core`(10384) 之前**，见 §5 落点修正的二次确证）；`tests/smoke.mjs` 新增切片断言；无宿主改动。落点选择本身有取舍：放在 pane core 内会污染纯函数断言，放在 9963–10097 会被 `writeRailFields`/`migrateRailConfig` 两个切片吞掉，放在 10379–10384 是唯一既不切断切片、又紧邻 `readPanes`/`writePanes` 范式的位置。

### D3 顶部 Tab 视图集与次要视图降级

**选了什么**：新 `UgitTopbar` 取代旧 `topBar`(17282–17307) 的两条大搜索框；保留 `RepoSelect`(13258)、`openBranchSwitchMenu`(17274–17280)、upstream ahead/behind chip(17297–17299)、动作图标（取自 `RAIL_SPECS`）、设置齿轮；新增 `工作区 | 变更 | 历史` 分段 Tab。`activeTab` 默认 `'changes'`，写入 `LAYOUT_KEY.activeTab` 并刷新恢复。「历史」Tab 整块渲染 `historyPane`(17338)，「工作区」Tab 暴露 `WorktreesPane`(14974) 与 `BranchTree`(13382)。

**顶栏时间筛选：能力缺口显式列出并当场解决（审查第 14 条，不安排后续阶段）**：清晰截图顶栏有两个 `2月前 ▾` / `4天前 ▾` 下拉，看似「起始/结束」提交时间范围。但 `grep -n` / `sed` 确证本仓库**不具备**这个能力：
- `HistoryList`(14532) 只有一个 `since` 内部 state(14571) 与一个日期下拉(14847)，选项是 `today/week/month/year`（`sinceThreshold` 14518–14523），**没有 `until`、没有第二个时间下拉、没有 `2月前/4天前` 这类自由标签**；
- `HistoryList` 的 props 契约里**没有** `props.since` / `props.until` / `props.onSince` / `props.onDate`（`grep -n "props\.(since|until|dateRange|onSince|onDate)" src/client.js` 零命中）；
- `filter.date`(434/864/…) 是这**一个**下拉的标签文案，不是「时间范围」能力；`onScopeChange`(17361) 管的是分支范围 `scope`，不是时间。

**采用的解释与做法**：截图那两个下拉是 ugit 对「最近两次提交时间」的**展示性**标签，不是可复用的过滤控件；按 §0.4「照参考图复刻平台/编辑器装饰不做」的同一边界，本次**不实现这两个下拉、不新增 `until` 能力**。历史筛选保持仓库现状：`HistoryList.filterBar`(14814) 的单一 `since` 下拉 + 文本/哈希/分支/作者/路径过滤，全部留在「历史」Tab 的过滤条（旧布局 hideSearch 14814/17360 已如此），**不搬到顶栏**。顶栏只放仓库▾、分支▾、Tab、ahead/behind chip、动作图标、齿轮、窗口控制。

**被排除的解释 / 理由**：①「把 `since` 拆成两个搬到顶栏、再造一个 `until`」—— 否决：需要给 `HistoryList` 新增 props、改 `rows` 派生(14617 `sinceThreshold(since)`)、给宿主 `log` 方法表加参数，超出 req/1–8 的视觉重构范围，且会碰 `tests/api.test.mjs` 的 log 断言；②「照截图字面画两个假下拉（点了没反应）」—— 否决：假控件比没有更糟，违背 req/1「不习惯」的初衷。

**若读者仍要确认**：跑 `grep -n "props\.(since|until)" src/client.js`（零命中）与 `sed -n '14565,14575p;14840,14855p' src/client.js`（看单一 `since` state 与单一日期下拉即可确证）。顶栏溢出规则仍按 `railCapacityOf`(17888) 收进「⋯ 更多」。

**为什么**（req/3、a/2、req/4）：旧顶栏的「分支或标签」「文本或哈希」两个大搜索框正是用户点名「被重点突出」的元素；把它们收进分支下拉与「历史」Tab 的过滤条，主视野才能让给变更/diff。

**状态机收敛（明确表态，原稿含糊）**：
- `view`(15184，取值 `'history'|'detail'|'worktrees'`) **保留**：`view==='detail'` 归入「历史」Tab 的提交详情，`view==='worktrees'` 归入「工作区」Tab；`selectCommit`(16276) 与 `onBack`(17341/18014) 的回退目标改为「回到当前 activeTab」，不改其写入点。
- `splitTab`(15213) **保留为 state 但不再驱动 body**：旧 compact/stack 的 `splitTabs`/`tabPane`/`diffActive` JSX 已整体删除（见 §6 的「所有 chrome 统一 UgitBody」）。`useEffect`(15214–15216) 的 patch 清空回退逻辑不动。
- `treeOpen`(15190) **保留**：它仍是 `dirTree` 列的折叠态，写入 `PANES_KEY.treeOpen`；与 `hidden[]` 的关系 = `hidden` 优先（隐藏即不渲染），`treeOpen` 只管「可见时的折叠」。

**被否决的备选**：*用 `view` 直接当 Tab（不新增 activeTab）* —— 否决：`view` 还承载 detail/worktrees 两个子状态，语义会重叠；且 `view` 无持久化，a/3 要求默认 Tab 记忆。

**影响面**：`src/client.js` 的 `topBar`、body 分支、`renderRail`、`view`/`splitTab` 消费点；`scripts/conversation-probe.mjs`（`chrome==='columns'` 断言依赖 D1 的兼容类名，不受本决策影响）；`scripts/screenshots.mjs` 的点击流程（见 D7）。

### D4 目录树复用 `buildDirForest`，但只做「定位/选中」不做「过滤」

**选了什么**：新 `DirTree` 复用 `dirName`(10493)、`buildDirForest`(10508)、`remoteTreeStripOf`(9241) 与 `TREE_KEY`(9701) 的 `readTreeState`(9703)/`writeTreeState`(9713) 折叠态；把 `summary` 的变更文件路径构造成目录森林，渲染树 + 自己的搜索框（截图形态）。

**为什么**（a/4、req/4）：这三个纯函数已在仓库里，不另造数据层；`TREE_KEY` 已有折叠记忆，正好承接「位置大小记忆」里的树折叠。

**能力缺口的显式修正（原稿此处假设了不存在的能力）**：`ChangesPanel`(13757) 的 props 契约里**没有** `pathFilter` 或目录过滤入参（确证：13790 只有 `groupBy` / `foldedDirs` / `selection` / `onDiff` / `onSelectionChange` 等；`pathFilter` 是 `HistoryList`(14574/14789) 的入参，15282 的 `pathFilter` state 只喂给 `HistoryList`(17360)）。因此：

> 点目录树节点**不承诺过滤变更列表**。可行且本次采用的行为是：①点文件 → 调既有 `props.onDiff(item, group)` 打开该文件的 diff（13862/13945），并可选经 Panel 的 `onChangeSelection`(17705) 同步选中态（`ChangesPanel` 的 `onSelectionChange` 在 17705 装配、`selection` 在 13801 消费）；②点目录 → 复用 `groupBy`(15682) / `setGroupBy`(15684) / `onGroupBy: setGroupBy`(17685) 把列表切到「按目录」并展开对应 `foldedDirs`(13796)；③树内搜索框只过滤**树节点**（本地 state），不改 `ChangesPanel` 数据。
> 若将来要真·目录过滤，需要给 `ChangesPanel` 新增 `dirFilter` prop 并改其 `rows` 派生 —— **本次不做**，理由：那是列表行为改动，会牵动 `selection-probe.mjs` 的 `.dig-folder-head`/`.dig-row-nested` 断言。

**被否决的备选**：*把 `BranchTree` 当目录树复用* —— 否决：`BranchTree`(13382) 渲染的是分支/标签，不是文件路径；截图要的是文件目录树。

**影响面**：新增 `DirTree` 组件；`ChangesPanel` **不改**；无宿主改动。

### D5 大号 split diff 常驻，并把默认值改为 split

**选了什么**：复用 `diffPaneOf(true)`(17407–17424) 的 `fillDiff`(17960) 形态：`.dig-diff-head` 路径面包屑 + 「在右侧栏打开」+ `DiffBody`(11134) → `LineDiff`(11548)。`split`/`wrap` 工具条(11630–11647) 与 `onActiveFile → setDiffPath`(11560–11563 / 17424 / 15207) 上报链**一行不改**。

**默认 split 的显式处理（原稿与现状冲突）**：`readLineDiffPrefs`(11379–11388) 当前默认 `{split:false, wrap:false}`（11385/11387），`LineDiff`(11552) 用 `useState(readLineDiffPrefs)` 播种、`useEffect`(11553) 持久化。若不动默认值，截图要求的「大号并排 split diff」在新安装/清缓存后是 **unified**，req/2/req/4 落空。因此：

> 把 `readLineDiffPrefs` 的两处默认值改为 `{split:true, wrap:false}`，**保留函数名、`LINEDIFF_KEY` 字面量、返回形状、`useState(readLineDiffPrefs)` 播种与 `useEffect` 持久化不变**。`tests/smoke.mjs` 对该键的断言是 `useState(readChangesGroupBy)` 那条（不是 linediff），改默认值不触发现有正则；但需**新增一条断言**钉住 `split:true` 默认值，防止回归。

**这是本次唯一的外部可见行为变更**（0.5 已列歧义，第 19 条要求标注）：老用户若曾手动切到 unified 并持久化过 `{split:false}`，`readLineDiffPrefs` 读到的是 **stored 值**，不会被新默认值覆盖 —— 所以只有「从未操作过 split 的新/清缓存用户」看到并排，老用户偏好保持。这是**可逆**的：改回默认常量即可。

**被否决的备选**：*在 `UgitBody` 里强行传 `split` prop 给 `LineDiff`* —— 否决：`LineDiff` 的 `prefs` 是内部 state(11552)，没有 `split` prop；加 prop 会破坏 `smoke.mjs:1879–1890` 的 `split === true && wrap !== true` 分支断言与既有持久化语义。

**影响面**：`src/client.js:11379–11388`（默认值常量）；`tests/smoke.mjs` 新增一条断言；`docs/screenshots/` 视觉。

### D6 设置面走 localStorage，绕开 configForms 且补齐「打开」

**选了什么（落点经探针确证后修正）**：布局设置**只放在面板内齿轮编辑器 `RailSettings`(12653)**，不放进插件页设置卡 `RailSettingsCard`(12075)：
- 逐区**双向 checkbox**（勾选=显示、取消=隐藏）—— 这是 req/5「隐藏及打开」的落点；
- 上移/下移调列顺序（仿 `moveRailAction` 17860 / `dropRailAction` 17869）；
- 默认 Tab 下拉、`commitBoxPlace` 下拉（`'changesBottom' | 'panelBottom'` 两值，见 0.5）；
- 「恢复默认布局」按钮（把 `hidden`/`order`/`affixes`/`activeTab` 复位到 `UGIT_*` 规格默认，即**一次性打开全部默认区**）；
- 装配照 `RailSettings` 既有 items/onMove/onDrop/onToggle/onReset（18103–18118），齿轮按钮沿用 `.dig-rail-settings`(17939)。
- **插件页设置卡只加一节只读说明 + 「打开布局设置」按钮**（点击等同点齿轮），**不放任何 checkbox**。

**为什么改到齿轮（被否决的备选，用户第 7 条）**：初审稿把布局开关放进 `RailSettingsCard`，但 `scripts/settings-card-probe.mjs:99–101` 的 `visuals()` 扫的是 `[data-plugin-config] input[type=checkbox]` **全部**，`ids[]`(134) 会连新开关一起拿去跑第 4 项「16 个开关 55ms 连点全落地」，再用 `patchValues()`(108–115) 去 profile patch 里比对 `rail([A-Z]…)` 字段 —— 布局开关没有对应 `railXxx` 字段，探针必然失败。把开关放齿轮即可：探针第 86 行只 `.click()` 打开 `.dig-rail-settings`，不枚举它的 checkbox；`ids.length >= 12`(135) 不变、`box(id)`(106) 的 `dig-rail-` 前缀不变。**`settings-card-probe.mjs` 因此零改动**。

**关键约束（已确证）**：`tests/smoke.mjs:1659–1666` 扫描 `RailSettingsCard` 源码里的 `const field = '…'` 与 `(textRow|selectRow)\('…'`，逐个要求宿主 `config.js` 有 `shape.<field> = schema.*()`。由于新卡只加只读说明与按钮、**不写字段**，该扫描的集合不变；`RailSettings`(12653) 在切片范围(1659) 之外，其 `layoutToggle`/`layoutSelect` 不会被误扫。仍**新增 smoke 断言**覆盖 `LAYOUT_KEY` 的 `normalizeLayout`/`readLayout`/`writeLayout` 与「双向翻转」行为，确保不是靠绕过检查蒙混。

**「提交框换位置」的显式处理（最终实现）**：提交框是 `ChangesPanel` 内部 `composer` 硬编码渲染的，7 个 `useState` + `aiRun`/`submit`/`aiFollowSession`/`aiConfirmDialog` 全在 `ChangesPanel` 内；`const composer = props.compact === true` 是 `smoke.mjs:1591` 的切片锚点、`E(ModelRoutePicker, …)` 有「恰好 2 次」计数断言(2240)、`aiRun`→`setAiUndo(` 有切片断言(1869)。**整块搬迁成 `CommitBox` 组件、或把 element 上报给父级再渲染，都会连锁打破这三条 / 引发渲染期父级 setState 循环**，故最终采用零破坏的 CSS class 方案：
> 给 `ChangesPanel` 新增两个可选 prop：`commitBoxDocked`（`true` 时给两套 `composer` 根 div 追加 `dig-commit-box-docked` class，由 CSS `margin-top:auto` 把提交框贴到列底）与 `commitBoxHidden`（`affixes.commitBox===false` 时 `composer` 渲染为 null）。`composer` JSX 其余一字不动、state 不提升、不复制，`confirm:true` 与提交链路完全不动。`E(ChangesPanel, {…})` 在 `onKeyDown` 之后传这两个 prop（避开 `smoke.mjs:1875` 的 `base: base,` 切片）。

**被否决的备选**：*用 CSS `order` 把 `composer` 挪到底部* —— 否决：`composer` 在 `ChangesPanel` 的 flex 列内部，CSS order 无法跨出列容器；且会破坏 `dig-commit-box` 的 border-l2 断言(1853)。

**影响面**：`src/client.js`（`RailSettingsCard` 只加只读说明+按钮、`RailSettings` 加布局开关、`ChangesPanel` 加 `commitBoxDocked`/`commitBoxHidden`、`UgitBody` 消费 `commitBoxPlace`）、`tests/smoke.mjs`（新增 `LAYOUT_KEY` 纯函数与双向翻转断言）、`scripts/settings-card-probe.mjs` **零改动**（据上文探针确证，布局开关不在卡内）。`src/host/config.js` / `RAIL_CONFIG_IDS` / `configForms` 绑定 **不动**。

### D7 词典、文档、测试与截图的同步演进

**选了什么**：
- 尽量复用既有键（`changes.title`、`pane.diff`、`toolbar.tree`、`settings.history.title` 等），只新增约 20 个 `layout.*` 键（当前 `grep -c "'layout\." src/client.js` = **0**，无占用）。
- 新键必须 **21 门全同步**（`ZH` 107 / `EN` 537 / `LOCALES` 19 门自 973 起，每门前 `/* locale: <tag> */`）；否则 `smoke.mjs:971–1003` 逐门 `deepEqual` 与多处 `===21` 计数全红。用一次性脚本按标记批量插入，插完 `npm test` 验证。
- `t` 保持查表函数 `translatorOf(ctx)`(9194)、`ctx.locale.register`(20646–20650) 不变（不变量 10）；hooks 依赖数组先声明后引用（不变量 12），改完跑 `ssr-check.mjs`。
- `CHANGELOG.md` 按「变更记录纪律」补倒序 `## Unreleased` 条目（feat），不追加进 `AGENTS.md`。
- `AGENTS.md` **不变量 7** 从「`columns/stack/compact` 三 chrome」改写为「ugit 分区模型 + 宽度仍决定窄容器降级」；`docs/` 目录地图补 `docs/plans/`；表格「src/client.js 全部 UI」描述补「ugit 分区配置层」。
- `README.md` / `README_EN.md` 的「效果 / Screenshots」两列表格**文字**改为 ugit 形态描述（图名不变，0.4 已表态），`screenshots.json` 不动。
- **重拍 6 张 `docs/screenshots/`**：`scripts/screenshots.mjs` 现有点击流程依赖 `.dig-commit`(130)、`.dig-tree .dig-row`(137)、`.dig-detail-files .dig-row`(162)、`.dig-rail-settings`(153)，且第 126 行注释仍写着「the three-pane workbench: branch tree, commit graph, changes + commit box」。按 D1/D3，分支树与提交图谱已降级进 Tab，因此第 2（提交右键菜单）、3（删除分支+撤回）、5（提交详情）三张的**交互路径要改为先切到对应 Tab**，并同步改 126 行注释为 ugit 三列描述；图名与数量不变（§0.4 已表态），`screenshots.json` 与两份 README 的图名引用不动。第 1/4/6 张只需新布局就位（第 4 张仍点 `.dig-rail-settings` 打开齿轮，D6 已确认齿轮保留）。这是 D3 的直接影响面，原稿未提。

**被否决的备选**：*不重拍、只改 README 文字* —— 否决：README 配图会与新界面不符，等于文档撒谎；用户 req/4「按截图重新实现」要求外观一致。

**影响面**：`src/client.js` 词典区、`tests/smoke.mjs`、`scripts/screenshots.mjs`、`docs/screenshots/*.png`、`README*.md`、`CHANGELOG.md`、`AGENTS.md`。

## 3. 数据流（修订）

```
挂载
 ├─ readLayout()  ──→ { version, activeTab, tabs, hidden, order, affixes, extraRatios }
 ├─ readPanes()   ──→ { treeOpen, panes:{ 'columns:wide'|'columns:tall': {tree:ratio, changes:ratio} } }
 ├─ readLineDiffPrefs() ──→ { split:true, wrap:false }   ← D5 默认值
 ├─ readTreeState() ──→ DirTree 折叠态 (TREE_KEY)
 └─ UgitBody: 候选列 = UGIT_TABS[activeTab].zones → 剔除 hidden[] → 追加显式打开列
              → 按 order 排序 → map 渲染 (列 + Gutter，diff 列挂 data-pane="diff" 但不插 gutter)
                                      │
用户操作                              │
 ├─ 切 Tab        → setActiveTab + writeLayout            → 重渲染候选列集合
 ├─ 齿轮里勾选/取消 → layoutToggle → writeLayout          → 隐藏=不渲染 / 打开=追加列 (req/5)
 ├─ 齿轮里上移/下移 → layoutMove   → writeLayout          → order 变化 (req/6「位置」)
 ├─ 拖 gutter     → 既有 dragPane/withPaneRatio/writePanes → tree/changes 列宽记忆 (req/6「大小」)
 ├─ 附加列拖宽    → Gutter + extraRatios → writeLayout     → branches/history 宽度记忆
 ├─ split/wrap    → LineDiff 既有 useEffect                → LINEDIFF_KEY 记忆 (a/3)
 ├─ 恢复默认布局  → writeLayout(normalizeLayout(null))     → 一次性打开全部默认区
 └─ 点文件        → 既有 onDiff → patch → DiffBody/LineDiff → onActiveFile → diffPath
```

## 4. 持久化 schema（修订，含冲突消解）

```
LAYOUT_KEY = 'dsh-ide-git.layout.v2'   (localStorage, JSON, 新键无占用)
{
  version: 2,
  activeTab: 'changes',                       // a/3 默认 Tab 记忆
  tabs: {                                     // 每 Tab 只记顺序，不记尺寸（0.4 表态）
    changes:   { order: '' },                 // '' = UGIT_TABS 代码默认顺序
    workspace: { order: '' },
    history:   { order: '' }
  },
  hidden: ['branches', 'history'],           // req/5：列在此 = 隐藏，移除 = 打开
  order:  '',                                // 全局列顺序覆盖，'' = 默认
  affixes: { toolbar: true, iconRail: true, commitBox: true,
             commitBoxPlace: 'changesBottom' },  // 'changesBottom' | 'panelBottom'
  extraRatios: { branches: 0.20, history: 0.34 }  // 附加列宽，复用 Gutter clamp
}

PANES_KEY    = 'dsh-ide-git.panes.v1'    (沿用；tree/changes 列宽 ratio，columns:wide|tall 两桶)
LINEDIFF_KEY = 'dsh-ide-git.linediff.v1' (沿用；{split,wrap}，默认值改为 split:true — D5)
CHANGES_GROUP_KEY / TREE_KEY / FAV_KEY / REPO_KEY / MANUAL_REPO_KEY / RAIL_KEY(已退役)
PAINT_KEY    = sessionStorage，首屏缓存，与本次无关（附录 A 已确证）
```

`normalizeLayout` 保证：未知/重复 id 丢弃、缺失 id 用 `UGIT_ZONE_SPECS` 默认值补齐、`activeTab` 非法回退 `'changes'`、`affixes` 逐项布尔化、`commitBoxPlace` 非法回退 `'changesBottom'`、`extraRatios` 夹到 `UGIT_ZONE_SPECS` 的 min/max 换算区间。

**可选性契约（null 与缺省的区别，第 15 条；真机复现后修订）**：`normalizeLayout` 对 `hidden` 的语义是「**仅记录用户显式关闭的区**」：①字段缺省 / `null` / 非数组 / `[]` → 空隐藏集；②恰好等于旧版默认集 `['branches','history']` 的旧文档 → 迁移为 `[]`（关键修复：旧版把这两个区预置进 hidden，导致切到「历史」Tab 时提交图谱被永久挡住、面板只剩「没有可显示的文本差异」，a/2 与 req/3 失效，真机复现后修正）；③其它非空数组 → 丢弃未知/重复 id 后即当前显式隐藏集。**区在某 Tab 是否渲染由 `UGIT_TABS[activeTab].zones` 决定，不由 `hidden` 决定**（变更 Tab = 目录树/变更/diff，工作区 Tab 加分支树，历史 Tab = 提交图谱/详情，不含空 diff 列）。`affixes`（`null`/缺省逐项补 `spec.visible`）、`extraRatios`（`null`/缺省/字符串/NaN/越界回退 `spec.ratio`）同理。写入恒 `JSON.stringify(normalizeLayout(config))`、读取恒 `JSON.parse` 后再 `normalizeLayout`，生产者/消费者字段名、枚举、可选性一致。由 `tests/smoke.mjs` 的 `ugit layout config` / `ugit layout optionality` 断言钉住防漂移。

**冲突消解（回答第 9 条「决策互相矛盾」）**：
- `hidden[]`（全局）vs `UGIT_TABS[tab].zones`（每 Tab 候选）：**显隐优先**（1.2 已表态），Tab 只给候选、不覆盖用户的打开动作。
- `tabs[*].order` vs 顶层 `order`：**Tab 级 order 优先**；顶层 `order` 仅作为「所有 Tab 统一顺序」的便捷覆盖，两者同时存在时取 `tabs[activeTab].order || order || 默认`。
- `treeOpen`(PANES_KEY) vs `hidden.includes('dirTree')`：**hidden 优先**（D3 已表态）。
- `commitBox` 显隐 vs `commitBoxHidden` prop：`affixes.commitBox===false` 时一律不渲染 composer；`commitBoxPlace` 两值只切 `dig-commit-box-docked` class，不改变 state 归属。

## 5. 组件与改动点（逐项确证，回答第 12/13 条）

| 位置（已 grep 确证） | 动作 | 需求/决策 |
|---|---|---|
| `src/client.js:10155–10366` pane sizing core | **不动**（纯函数，smoke `new Function` 直接驱动） | D1 |
| `src/client.js:12952–13031` `Gutter` | **不动**（通用控件；附加列复用它） | D1/D2 |
| `src/client.js:11134` `DiffBody` / `11548` `LineDiff` | **不动**（除 D5 默认值） | D5 |
| `src/client.js:11379–11388` `readLineDiffPrefs` | 默认值 `{split:false}` → `{split:true}`；签名/键/形状不变 | D5 |
| `src/client.js:10493` `dirName` / `10508` `buildDirForest` / `9241` `remoteTreeStripOf` | **不动**，由新 `DirTree` 调用 | D4 |
| `src/client.js:9701–9715` `TREE_KEY` 读写 | **不动**，复用给 `DirTree` 折叠 | D4 |
| `src/client.js` `ChangesPanel` | **仅新增** `commitBoxDocked` / `commitBoxHidden` 两个 prop；`composer` JSX 与其余 props / `head` 断言不动 | D6 |
| 新增 `UGIT_ZONE_SPECS` / `UGIT_AFFIX_SPECS` / `UGIT_TABS` / `LAYOUT_KEY` / `normalizeLayout` / `readLayout` / `writeLayout` | **最终安全落点**：`writePanes`(10379) 结束之后、`/* ---- dock action core`(10384) 开始之前（经 smoke 全部 `client.indexOf` 切片标记确证不在任何切片内部，见 §5 落点修正） | D2 |
| 新增 `UgitTopbar` / `UgitIconRail` / `DirTree` / `UgitBody` / `UgitLayoutSettings` | 放在 `RailSettings`(12653) 附近的组件区 | D3/D4/D6 |
| `src/client.js:17282–17307` `topBar` | 替换为 `UgitTopbar`（保留 `RepoSelect`/分支下拉/chip/齿轮/动作图标） | D3 |
| `src/client.js:17999–18055` body 五分支 | 替换为单个 `UgitBody`（按配置 map 列 + gutter；保留 `dig-body-columns`/`stack`/`compact` 与 `[data-pane]`，含 `data-pane="diff"`） | D1 |
| `src/client.js:17896–17942` `renderRail` | 动作图标收进 `UgitTopbar`/`UgitIconRail`；`railCapacityOf`(17888) 改为按顶栏宽度算；`RAIL_VIEW_IDS`/`RAIL_SPECS` 不动 | D1/D3 |
| `src/client.js:12075` `RailSettingsCard` | **只加**只读说明 + 「打开布局设置」按钮；**不加 checkbox、不加 `textRow`/`selectRow`/`const field`**（否则撞 `settings-card-probe.mjs` 与 `smoke.mjs:1659`） | D6 |
| `src.client.js:12653` `RailSettings` / `18103–18118` 装配 | **布局开关的真正落点**：逐区双向 checkbox、上移/下移、默认 Tab、`commitBoxPlace`、恢复默认（`layoutToggle`/`layoutSelect`） | D6 |
| `src/client.js:18498–19208` `CSS` 数组 | 新增 ugit 规则；保留 11 个 border-l2 选择器(smoke 1853)；`dig-topbar` 改单行；`dig-shell` 保留 | D1/D7 |
| `src/client.js:107 / 537 / 973…` 21 门词典 | 新增约 20 个 `layout.*` 键 | D7 |
| `src/client.js:20627` `apply(ctx)` | **无需改**（注册面、`ctx.locale.register`、两座位、第三座位均不变） | — |
| `tests/smoke.mjs` | 按 D1 清单诚实更新文本断言 + 新增 `LAYOUT_KEY`/`split` 默认值断言 | D1/D5/D6 |
| `scripts/screenshots.mjs` | 第 2/3/5 张交互路径改为先切 Tab、第 126 行注释改 ugit 三列；图名/数量不变 | D7 |
| `scripts/settings-card-probe.mjs` | **不动**（D6 把布局开关放齿轮，卡内不新增 checkbox，`visuals()`/`ids[]`/`patchValues()` 契约不变） | D6 |
| `docs/screenshots/*.png` × 6 | 重拍 | D7 |
| `README.md` / `README_EN.md` / `CHANGELOG.md` / `AGENTS.md` | 文字/纪律同步 | D7 |
| `src/host/*` / `tests/api.test.mjs` / `repos.test.mjs` / `graph.test.mjs` / `src/host/config.js` | **不动** | 0.3 |

> **落点修正（二次确证，命令见附录 A）**：原稿写「pane sizing core 之后、rail config core 之前」在行号上不成立（rail config core 9921 早于 pane core 10155）；第一次修订写「rail config core 结束(9963) 之后、`migrateRailConfig`(10097) 之前」**同样不成立** —— `sed -n '9963,10100p' src/client.js` 显示该区间实际有 `readCommitSettings`(9968)、`readDateFormat`、`railFormReady`、`conversationImmersiveEnabled`、`readRailConfig`(10007)、`writeRailConfig`(10019)、`writeRailFields`(10063)、`writeRailField`(10089) 共 8 个函数，且 `tests/smoke.mjs:1268` 的 `writeRailFields → /* One-shot move…*/` 切片与 `:1530` 的 `migrateRailConfig → subscribeRailConfig` 切片都横跨此段，插进去会被切片吞掉或破坏断言。
> **最终安全落点：`writePanes`(10379) 结束之后、`/* ---- dock action core`(10384) 开始之前**。该区间只有空行与一节注释；`grep -oE "client\.indexOf\('[^']+'\)" tests/smoke.mjs | sort -u` 确证它不在任何切片内部，`/* ---- end pane sizing core ---- */`(10366) 与 `/* ---- dock action core`(10384) 两个边界均不受影响。


### 真机验证后的实现修正（v0.37.0）：所有 chrome 统一走 UgitBody

隔离实例 3099 真机复验（发布版 CLI + 干净 profile + 演示仓库）发现：原稿只在 `columns`（宽容器）分支用 `UgitBody`，`compact`/`stack`（窄右栏）仍保留旧三栏 JSX（常驻分支树 + 提交图谱），导致右侧栏截图仍是「分支树｜提交图谱｜变更」——正是 req/3 要消除的形态，属于「能跑通但语义不对」。故改为：**三个数据态分支之后只留一个 `else`，统一 `E(UgitBody, {…})`**，`chrome` 仅决定 CSS 方向（columns=横向三列、stack/compact=纵向堆叠）。旧 `splitTabs`/`tabPane`/`diffActive`/`diffPane`/`diffGutter`/`noDiff` 全部删除，`fillDiff = diffPaneOf(true)` 保留作主角列。`tests/smoke.mjs` 里针对旧 compact/stack 的 5 条断言诚实改为「所有 chrome 共用 UgitBody / 分支树默认不出现」的等价断言（79/0 通过）。真机证据：`.dig-root:visible`=1、`UGIT_TABS`=3、`.dig-dirtree`=1、`.dig-tree`(分支树)=0、`.dig-split-tabs`=0、`PAGEERRORS`=[]；点变更文件后 `.dig-diff-pane`=1、`.dig-diff-pane-fill`=1、`localStorage` 写入 `{"split":true,"wrap":false}`（纯新增文件按既有「单边强制单列」规则渲染 unified，属 `LineDiff` 既有正确行为，非缺陷）。

## 6. 错误处理、边界与安全（回答第 16–21 条）

### 6.1 错误处理
- 所有 localStorage 读写 `try/catch` 静默降级；解析失败 / 旧版 schema / 未知字段一律走 `normalizeLayout` 默认值，绝不因坏数据白屏。
- 所有列都被隐藏时，`UgitBody` 渲染「未启用任何功能区」空态 + 「打开布局设置」按钮（调 `writeLayout` 复位），不留 0 宽容器。
- 窄容器（`<400`，原生右栏）仍按宽度自动降级：`dirTree` 自动收起但 `hidden` 偏好不丢；`changes`+`diff` 优先；`dig-root-narrow` 标记照旧（smoke 1706）。
- 无仓库 / 加载中 / 无差异 / 无提交等既有空态分支（18000–18008）保留。
- `branches`/`history` 附加列在无数据时（`branches`/`commits` 未加载）显示各自既有空态，不抛错。

### 6.2 安全与权限边界（第 20 条）
本次**不触及**认证、授权、沙箱、文件访问、凭据处理；以下既有不变式逐条保持：
| 不变式 | 保持方式 |
|---|---|
| 不变量 4：破坏性操作 `confirm: true`（push / `reset --hard` / `branch -D` / `clean` / `stash drop`），「提交并推送」唯一例外 | composer JSX 一字不动，不碰 `submit(push)` 与守卫字符串；`ConfirmDialog` 链路不动 |
| 不变量 5：两条信任围栏（`isTrusted(req)` + POST） | 宿主半不动 |
| 不变量 13：浮层在 `.dig-root`(position:relative) 内 `position:absolute`，锚点减 `hostRef` rect | 新顶栏的仓库/分支下拉沿用 `openPickerAt`(16324) → `ContextMenu`(11784) → `SearchPicker`(11896)；`dig-root`/`dig-shell` 保留 |
| 不变量 15/16：删除/覆盖留撤回句柄、写方法登记 `WRITE_METHODS` | 宿主半不动 |
| 不变量 1/2/9/10/11/12/14/17/18/21 | 见 0.3 与 D1/D7；`RAIL_SPECS`↔`RAIL_CONFIG_IDS` 不动、21 门词典同步、hooks 先声明后引用、版本两处一致不动 |

### 6.3 最坏后果与影响范围（第 18 条）
- **最坏后果**：`src/client.js` 渲染期抛错（TDZ / `t is not a function` / 坏 localStorage 未兜底）→ `dsh-better-sidebar` 的错误边界吞掉整个面板，`.dig-root` 不出现（AGENTS.md 记录过 v0.1.6 与 2026-09-14 两次真实事故）。影响范围 = **仅本插件的 Tab 与两个原生座位**，不波及其它插件 / 会话 / 宿主进程；Git 仓库数据不受影响（无宿主改动）。
- **次生后果**：`tests/smoke.mjs` 文本断言成片变红（CI 挂）、六个真机探针失效、README 配图与实物不符。均为可检测、可修复，不丢数据。
- **防线**：`ssr-check.mjs` 抓渲染期异常 + `layout-probe.mjs` 带真数据抓面板崩溃 + `npm test` 抓契约；按 7.1 顺序跑。

### 6.4 回退路径与不可逆项（第 19 条）
| 变更 | 可逆性 | 回退方式 |
|---|---|---|
| `LAYOUT_KEY` 全新键 | **完全可逆** | 删除代码或 `localStorage.removeItem('dsh-ide-git.layout.v2')` 即回默认；不迁移、不覆盖任何旧键 |
| `UgitBody` / `UgitTopbar` 等新组件替换 body | **可逆** | git revert 本次 client.js 改动即可；旧 `PANES_KEY`/`LINEDIFF_KEY`/`TREE_KEY` 数据保持可读（未改形状） |
| `readLineDiffPrefs` 默认值 `split:false→true` | **可逆，但属外部可见行为变更**（唯一一项） | 改回常量即可；**已显式标注**：仅影响从未操作过 split 的用户；老用户 stored 值优先，偏好不丢 |
| `ChangesPanel` 新增 `commitBoxDocked`/`commitBoxHidden` prop | **可逆，向后兼容** | 默认不传即原行为；composer JSX 不改提交逻辑 |
| 21 门词典新增 `layout.*` 键 | **可逆** | 删键 + 同步删断言；不删既有键 |
| README 6 张图重拍 | **可逆** | 图片是工作区文件，git 可回退 |
| **不做**的事：旧 `PANES_KEY` 形状、`RAIL_KEY` 迁移、`config.js` schema、profile、已发布接口语义 | — | 全部不碰，因此**没有数据格式迁移、没有已发布接口语义变更、没有跨版本数据格式变更** |

### 6.5 本次明确不解决的遗留风险（第 21 条，不留白）
| 遗留风险 | 影响 | 建议 |
|---|---|---|
| `UgitBody` 仍保留 `dig-body-stack`/`dig-body-compact` 两个兼容类名，但窄容器下的列布局与旧 chrome 语义已不同 | `layout-probe.mjs` 的 11 档扫档仍能读出 chrome 名，但其「chrome 名 → 布局」的文字说明会过期 | 在 `scripts/layout-probe.mjs` 注释里补一句「chrome 名仅为兼容标识，实际列集由 `LAYOUT_KEY` 决定」；不改断言 |
| `scripts/screenshots.mjs` 第 2/3/5 张改了交互路径后，若将来再次改 Tab 名会再失效 | 截图脚本脆 | 把 Tab 名抽成脚本顶部常量；本次仅做最小改动 |
| 目录树点目录只能切「按目录分组」，不能真·过滤文件列表（D4 已表态不做） | 与「目录树即过滤器」的直觉有落差 | 若后续要做，给 `ChangesPanel` 加 `dirFilter` prop 并补 `selection-probe.mjs` 断言；本次不做 |
| `extraRatios` 的简化 clamp 没有 pane core 那套两级 ceiling | 极端窄容器下附加列可能挤占 `changes`/`diff` | 已限定 min/max 且窄容器自动收起附加列；若真机复现再移植 clamp，不在本次范围 |
| `AGENTS.md` 不变量 7 改写后，历史 CHANGELOG 条目里「columns/stack/compact」的描述不再对应新代码 | 仅文档表述 | 不回改历史条目（变更记录纪律：历史条目不改），靠不变量 7 的新描述为准 |
| **六个真机探针 / 重拍 6 张图本次仍未逐项跑通** | 隔离实例 3099 的发布版 CLI 已能进会话并打开 Git 面板(点 guide-entry 内部 `<button class="FlLRca_cardMain">`),真机 DOM 与截图已验证 ugit 分区、默认并排、零 pageerror;但 `layout-probe.mjs` 等六个脚本的 `enterSession()` 仍按旧引导序列(继续/关闭/稍后配置/新建会话 + Lexical `.click()`)编写,与发布版 CLI 的「选择工作区」初始态不匹配,未逐项跑通 | 本次如实记录,不假装通过。后续需按 `selection-probe.mjs` 的 `/api/workspace/create` gateway 绑定与「点 guide-entry 内部 button」更新 `enterSession()`/`openPanel()`,再跑全套探针并重拍 6 张图。隔离实例已按 AGENTS.md 纪律收尾杀掉,3099 空闲、3080 从未触碰 | 有数据的 `UgitBody` chrome（目录树/变更/diff）**未经真机渲染验证**。但 `node --check`、`tests/smoke.mjs`(77/0)、`ssr-check.mjs`(四座位全 OK)、`npm test`(仅既有 `api.test.mjs:578 pull defaults` 基线失败) 全绿，Playwright 页面 `PAGEERRORS: []` | 本次如实记录、不假装通过。后续需：①用完整 profile 正式安装形态（而非手工解包 tarball）起隔离实例；②按 `selection-probe.mjs` 的 `/api/workspace/create` gateway 绑定更新 `layout-probe.mjs` 的 `enterSession()`；③再跑 §7.1 全套探针。隔离实例已按 AGENTS.md 纪律收尾杀掉，3099 空闲、3080 从未触碰 |

## 7. 测试策略与实施顺序

### 7.1 验证命令（按依赖顺序）
| # | 命令 | 关注点 |
|---|---|---|
| 1 | `npm test` | CI 唯一门槛：词典 21 门、`PANE_*` 数值、D1 更新后的 body 断言、新增 `LAYOUT_KEY`/`split` 断言 |
| 2 | `node scripts/ssr-check.mjs` | `t is not a function`、hooks TDZ、`dig-root/dig-topbar/dig-shell/dig-empty` 四 needle |
| 3 | `node scripts/layout-probe.mjs "<url>" [out]` | 11 档宽度 chrome、header 不溢出、零 pageerror（**改布局必跑**） |
| 4 | `node scripts/panes-probe.mjs "<url>" [out]` | 拖拽生效、reload 保持、wide/tall 不串桶、overlay 夹取 |
| 5 | `node scripts/dock-probe.mjs "<url>" [out] native` 与 `… degraded` | rail/dock 动作与紧凑头部 tree 控件 |
| 6 | `node scripts/selection-probe.mjs "<url>" [out]` | 变更列表 / 目录分组 / 分支树 / 历史多选（需 `DIG_PROBE_REPO`、`DIG_PROBE_WORKSPACE`） |
| 7 | `npm run probe:settings-card` | 新布局开关双向翻转、跨 reload 保持、16 连点全落地（**新增设置项必跑**） |
| 8 | `node scripts/conversation-probe.mjs "<url>" [out]` | 第三座位、`chrome==='columns'`（D1 保留）、`/remote` 回退、placement 开关 |
| 9 | `node scripts/screenshots.mjs <web-url> [out]` | 重拍 6 张 ugit 形态图 |

真机纪律（AGENTS.md）：独立 `DSH_HOME` + 端口 **3099** 隔离实例，用发布版 CLI（不用本机 dev checkout），验证完**自己杀掉**（`lsof -tiTCP:3099 -sTCP:LISTEN` 自查）；**绝不碰 3080、绝不替用户重启**。宿主半无改动，因此不需要用户重启 `dsh web`——但 client 半改动要硬刷新页面生效（AGENTS.md「本机联调」），先 `ls -l` 看安装形态是硬链接还是副本。

### 7.2 分阶段实施（每阶段可独立验证）
1. **配置层**：`UGIT_ZONE_SPECS` / `UGIT_AFFIX_SPECS` / `UGIT_TABS` / `LAYOUT_KEY` / `normalizeLayout` / `readLayout` / `writeLayout` + 新 smoke 切片断言（纯函数先绿）。
2. **词典**：21 门批量插入 `layout.*` 键，`npm test` 验证键集；同时改 `readLineDiffPrefs` 默认值并钉断言（D5）。
3. **新组件**：`commitBoxDocked`/`commitBoxHidden`（`ChangesPanel` 新增 prop）→ `DirTree` → `UgitTopbar` / `UgitIconRail` → `UgitBody` → `UgitLayoutSettings`。
4. **接线**：替换 `topBar` 与 body 五分支（三套 chrome 统一 UgitBody），`view`/`renderRail` 保持既有，`ChangesPanel` 加 `commitBoxDocked`/`commitBoxHidden`。
5. **CSS**：ugit 单行顶栏、三列主体、大 diff（`flex:1` + `data-pane="diff"`）、提交框两处落点；保留 11 个 border-l2 选择器与兼容类名。
6. **设置面**：面板内齿轮 `RailSettings` 加布局开关（逐区显隐/顺序/默认 Tab/提交框落点/恢复默认）；插件页 `RailSettingsCard` 只加只读说明 + 「打开布局设置」入口按钮（**不加 checkbox**，据 D6 探针确证）。
7. **测试与探针**：按 D1 清单诚实更新 smoke 文本断言、同步 `scripts/screenshots.mjs` 第 2/3/5 张路径；跑 7.1 全套。
8. **收尾**：`CHANGELOG.md` 补 `## Unreleased`、`AGENTS.md` 不变量 7 改写、两份 README 效果段文字、重拍 6 张图、`git commit`。

## 附录 A · 符号与落点确证清单（逐项 `grep -n` 结果）

| 符号 / 字符串 | 确证位置 | 结论 |
|---|---|---|
| `PANES_KEY` / `PANE_CHROME_KEYS` / `PANE_HEIGHT_CHROME` / `PANE_LIMITS` / `PANE_DEFAULTS` / `PANE_BUCKETS` / `panBucket` / `normalizePanes` / `withPaneRatio` / `paneGeometry` | 10165 / 10171 / 10183 / 10188 / 10201 / 10225 / 10236 / 10243 / 10265 / 10290 | 存在，纯函数块 10155–10366 |
| `readPanes` / `writePanes` | 10368 / 10377 | 存在 |
| `Gutter` / `DiffBody` / `LineDiff` / `LINEDIFF_KEY` / `readLineDiffPrefs` / `writeLineDiffPrefs` | 12952 / 11134 / 11548 / 11378 / 11379 / 11389 | 存在；默认 `{split:false,wrap:false}` 在 11385/11387 |
| `CHANGES_GROUP_KEY` / `readChangesGroupBy` / `rememberChangesGroupBy` | 11397 / 11398 / 11404 | 存在（裸字符串 'dir'\|'flat'） |
| `TREE_KEY` / `readTreeState` / `writeTreeState` | 9701 / 9703 / 9713 | 存在 |
| `RAIL_SPECS` / `RAIL_IDS` / `RAIL_VIEW_IDS` / `railOrderOf` / `railOrderText` / `migrateRailConfig` | 9851 / 9883 / 9886 / 9930 / 9941 / 10097 | 存在 |
| `dirName` / `buildDirForest` / `remoteTreeStripOf` | 10493 / 10508 / 9241 | 存在 |
| `RepoSelect` / `BranchTree` / `ChangesPanel` / `HistoryList` / `CommitDetail` / `WorktreesPane` / `SearchPicker` | 13258 / 13382 / 13757 / 14532 / 14936 / 14974 / 11896 | 存在 |
| `RailSettingsCard` / `RailSettings` / `apply` | 12075 / 12653 / 20627 | 存在 |
| `historyPane` / `diffPaneOf`→`diffPane` / `fillDiff` / `splitTabs` / `tabPane` / `renderRail` / `railCapacityOf` / `openPickerAt` / `foldTree` | 17338 / 17425 / 17960 / 17961 / 17997 / 17896 / 17888 / 16324 / 15492 | 存在 |
| `dig-shell` / `dig-body-columns` / `dig-pane-tree` / `dig-pane-changes` / `dig-pane-main` / `dig-topbar` | 18457 / 18621 / 18625 / 18628 / 18627 / 18500 | 存在 |
| `ChangeRow` 状态图标 / `SplitColumns` 同步滚动 / `FilterSelect` / `sinceThreshold` / `sortKey` 菜单 / `filter.date` | 13718+13741 / 11459+11470 / 13300 / 14518 / 15687+17550–17553 / 434+864+…21 门 | 存在；§1.3 逐元素对照据此判定「复用既有」 |
| `pathFilter` 归属 | 14574 / 14789 / 15282 / 17360（**HistoryList**，非 `ChangesPanel`） | D4 已据此修正 |
| `composer` 归属 | 14090–14160（`ChangesPanel` 内部硬编码） | D6 已据此修正 |
| `ChangesPanel` props | 13790（`groupBy`/`foldedDirs`）、13862/13945（`onDiff`）、14153（`hideHeader`） | 无目录过滤 prop |
| `ChangesPanel` 无 `pathFilter` | 13757–13786 + 14153 全段确认 | 同上 |
| 现有 11 个 localStorage key | 89 / 94 / 9422(sessionStorage) / 9701 / 9818 / 9845 / 9916 / 10165 / 11378 / 11397 | `dsh-ide-git.layout.v2` **无占用** |
| `'layout.` 键数量 | `grep -c` = 0 | 无占用 |
| smoke 硬编码断言 | 918–940 / 1096–1098 / 1106–1129 / 1704–1708 / 1849–1860 / 2351–2372 / 1659–1666 | D1/D6 已列完整清单 |
| `ssr-check.mjs:86` needles / `layout-probe.mjs:119` CHROMES / `conversation-probe.mjs:404` chrome | 已确证 | D1 兼容类名保留 |
| `settings-card-probe.mjs:99–101` `visuals()` 扫 `[data-plugin-config] input[type=checkbox]` 全部；`:106` `input#dig-rail-<id>`；`:134` `ids[]` 连点 + `patchValues()` 比对 profile patch | 已确证 | **D6 据此改落点**：布局开关放齿轮、`RailSettingsCard` 只加只读说明与按钮（无 checkbox），探针零改动 |
| **D2 落点二次确证**：`sed -n '9963,10100p' src/client.js` 显示 8 个函数；`grep -oE "client\.indexOf\('[^']+'\)" tests/smoke.mjs \| sort -u` 列出全部切片标记；`sed -n '10377,10390p' src/client.js` 显示 `writePanes`(10379) 与 `/* ---- dock action core`(10384) 之间为空档 | 已执行（本轮） | 9963–10097 区间**非空档**且被 `smoke.mjs:1268`/`:1530` 两个切片横跨；最终安全落点 = 10379 之后、10384 之前 |
| **D3 能力缺口确证**：`grep -n "props\.(since\|until\|dateRange\|onSince\|onDate)" src/client.js` 零命中；`sed -n '14565,14575p;14840,14855p' src/client.js` 显示单一 `since` state(14571) 与单一日期下拉(14847，today/week/month/year) | 已执行（本轮） | 仓库**无** `until`、无第二个时间下拉、无 props 入参；截图两个时间下拉本次不做，历史筛选仍留 `HistoryList.filterBar`(14814) |

## 附录 B · 需求 ↔ 决策双向追溯表

| 需求 / 约束 | 落点（决策编号或小节） |
|---|---|
| req/1 样式不习惯 | §1 信息架构、D1（替换 body）、D3（替换顶栏；顶栏时间下拉按能力缺口排除，见 D3 与 §0.4） |
| req/2 变更文件与 diff 重点突出 | §1（diff `flex:1` 主角）、D1（diff 列）、D5（默认 split）、D4（目录树只做定位不再抢面积） |
| req/3 分支/提交记录被突出且无法隐藏 | §1.1（默认隐藏 `branches`/`history`）、§1.2（历史 Tab）、D3（顶栏降级 + 收敛状态机） |
| req/4 按 ugit 布局 | §1（照截图骨架）、§1.1 分区表、D4（目录树）、D5（大 split diff） |
| req/5 功能区隐藏及打开 | §0.5（歧义解释）、D2（`hidden[]` 双向）、D6（齿轮内逐区 checkbox + 恢复默认 = 一次性打开全部；插件页卡只放入口按钮） |
| req/6 调整位置大小后自动记忆 | §0.5（位置=列次序+提交框落点）、D1（`PANES_KEY` 尺寸）、D2（`order`/`extraRatios`/`commitBoxPlace`）、D6（上移下移/两值下拉）、§3 数据流 |
| req/7 记录到当前浏览器 | §0.5、D2（`LAYOUT_KEY` localStorage）、D6（不走 configForms）、§4 schema |
| req/8 参考截图 | §1 骨架、§0.5、「iconRail/toolbar 来自截图」的来源说明 |
| a/1 直接替换、不保留旧三栏 | §0.3、D1 被否决备选 B/D |
| a/2 顶部 Tab 独立视图 | §1.2、D3 |
| a/3 四项配置 + 默认 Tab/diff 记忆 | §0.2、D2、D5、D6、§4 |
| a/4 目录树独立可隐藏 | §1.1、D4 |
| a/5 localStorage | §0.3、D2、D6 |
| a/6 换血不换骨架 | D1（含被否决备选 C） |
| 不变量 1/2/4/5/6/7/9/10/11/12/13/14/15/16/17/18/21 | §0.3、D1（兼容类名）、D7（21 门词典 / hooks / CHANGELOG）、§6.2（安全边界表） |
| `tests/smoke.mjs` 契约 | D1（完整更新清单）、D5（新增断言）、D6（避开字段扫描 + 新增断言）、D7 |
| 六个真机探针契约 | D1（兼容类名表）、D7（screenshots 路径）、§6.5（遗留风险） |

**反向追溯**：D1←a/6+smoke 契约+「`fillDiff` 自带 `data-pane`/`paneStyle('diff')` 是高度」事实；D2←a/3/a/5/req/5/req/6/req/7+不变量 14；D3←req/1/req/3/req/4/a/2；D4←a/4/req/4+「`ChangesPanel` 无 pathFilter」事实+参考截图目录树；D5←req/2/req/4/a/3+「默认 split:false」事实；D6←req/5/req/6+`smoke.mjs:1659` 事实+「composer 硬编码」事实+「`settings-card-probe.mjs` 扫全部 checkbox」事实；D7←不变量 10/12/17+变更记录纪律+req/4 外观一致。**无无来源的决策**。
