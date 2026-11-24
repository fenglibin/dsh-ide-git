## 技术决策

> 本文件与 `docs/plans/2026-11-24-ugit-layout-design.md`（完整方案草稿）同为本次交付的设计文档，**两者都要自足**：每个 `### D<n>` 决策独立写清「选了什么 / 为什么 / 被否决备选 / 影响面」，让不了解上下文的读者能独立判断。冲突时以完整方案草稿为准。需求基线 req/1–8、对齐结论 a/1–6、歧义解释、逐元素对照、符号确证清单与双向追溯表见完整方案草稿 §0 / §1.3 / 附录 A / 附录 B。

### D1 兼容性叠加：保留 pane sizing core，但显式处理 diff 缺席

**选了什么**：原样复用 `src/client.js:10155–10366` 的 pane sizing core 纯函数、`Gutter`(12952–13031)、`measureGate`(15419–15441)、两个 ResizeObserver 骨架(15307–15322 / 15361–15376)、`readPanes`/`writePanes`(10368/10377)、`commitPanes`/`endPaneDrag` 的「一次手势一次落盘」节奏。ugit 三列复用既有 pane key：`dirTree→tree`(`PANE_DEFAULTS['columns:tree']={px:200}`, 10202)、`changes→changes`(`{px:290}`, 10203)、`diff→直接复用 fillDiff`(17960)。删 17999–18055 三套 chrome body 分支，换成单个按配置 `map` 渲染的 `UgitBody`。

**diff 缺席的显式处理（经两次修订的最终结论）**：`paneGeometry`(10298) 的 `keys` 对 `columns` 恒为 `['tree','changes','diff']`，10324 固定遍历 `['changes','tree','diff']`，10348 的 `ideal = space - reserve - taken`（`taken` 按 10341 显式排除 `diff`）都假设第三个 pane 存在。若 `diff` 不设 `data-pane`，`measurePanes`(15393) 测不到它，`effective.diff` 退化为 `PANE_DEFAULTS['columns:diff']={ratio:0.55}` × `box.height`，`changes` 的 ceiling 被按「三列」错误压窄。
> **最终做法：直接复用 `fillDiff`，不加任何新 `paneStyle` 调用。** `diffPaneOf(true)`(17407) 已带 `'data-pane': 'diff'` 且 `style: fill === true ? null : paneStyle('diff')` —— `fillDiff` 的 inline style 正是 `null`。CSS(18941) `.dig-diff-pane-fill{flex:1;max-height:none;border-top:none}` 已让它填满父容器。`UgitBody` 把 `fillDiff` 放进 `.dig-pane-main`（18627 已是 `flex:1;min-width:0`）即可：宽度由 flex 撑满、高度由 `dig-diff-pane-fill` 撑满、`measurePanes` 照常量到 diff 高度、`paneGeometry` clamp 语义一字不改。**绝不调用 `paneStyle('diff')`**：它(15505) 对 `key==='diff'` 返回 `{height,maxHeight}`，套到横向主列会强行给出 55% 高度上限，把主角压成半高。初审稿「diff 不设 data-pane 无害」与第一次修订「调 paneStyle('diff')」两版判断均已作废。

**兼容性保留清单（逐项确证）**：`dig-root`/`dig-topbar`/`dig-shell`/`dig-empty`（`ssr-check.mjs:86` 四 needle，18457/18500）；`dig-body-columns`（`layout-probe.mjs:119` CHROMES、`conversation-probe.mjs:404/411` 硬编码 `chrome==='columns'`）与 `dig-body-stack`/`dig-body-compact`（窄容器 `<400` 仍按宽度选，不变量 7 不破）；`.dig-pane-tree`/`.dig-pane-changes`/`.dig-pane-main`/`[data-pane]`（`panes-probe.mjs:156–164`、`selection-probe.mjs`、`smoke.mjs:1849–1860` 的 11 个 border-l2 选择器）；`dig-root-narrow`(1704–1708)；`RAIL_VIEW_IDS`/`RAIL_SPECS` 五视图动作(935)；`splitTabs`/`tabPane`(918–929 / 2351–2355)；`fillDiff`/`diffPaneOf` 签名(2345/2372)。

**smoke 需诚实更新的文本断言（完整清单，非「少数」）**：`smoke.mjs:2368` `/dig-body-stack[\s\S]{0,1400}splitTabs\(false, false\)/`；`:2370` `/className: 'dig-pane dig-pane-main' \}, historyPane, diffGutter, diffPane/` 恰好 1 次；`:2357–2358` `'data-action': 'diff-tab'|'history-tab'`（顶部 Tab 换 id 后同步）；`:2361/2366` `compact: ['tree','changes']` / `stack: ['tree','changes']`（`PANE_CHROME_KEYS` 不动，两条保留）；`:2345` `dig-diff-pane`/`fill`（保留 `fillDiff` 后仍成立）；另新增 `LAYOUT_KEY` 纯函数与 `split` 默认值断言。不留死字符串骗测试。

**为什么**（a/6）：pane core 被 `tests/smoke.mjs:1076–1236` 用 `new Function` **直接驱动**并做了数值断言（440/324/200px、六桶 `PANE_BUCKETS`、两级 ceiling），且经 `panes-probe.mjs` 真机拖拽/重载回归；它不依赖任何 JSX（`/* ---- pane sizing core` 到 `/* ---- end pane sizing core ---- */` 是纯函数），替换 body 不破坏断言本身。

**被否决的备选**（审查第 7 条）：
- *B：另起 `UgitPanel` 并行 UI、旧 `Panel` 保留、设置里切换* —— 否决：a/1 明确「直接替换、旧布局不保留开关」；两套 5000+ 行 UI 要双份词典/设置/尺寸记忆。
- *C：彻底重写 `PANE_*` 常量、CSS 类名、探针选择器为全新命名* —— 否决：约 30+ 处 `smoke.mjs` 硬编码字符串与六个真机探针会同时失去回归能力；用户在问答里选了「兼容叠加」。
- *D：只调旧三栏主次、加显隐* —— 否决：a/1；且 diff 仍是中间列小窗，不满足 req/2「重点突出」。

**影响面**：`src/client.js`（Panel return、body 分支、`renderRail`、`topBar`）、`tests/smoke.mjs`（上述断言）、`scripts/*.mjs` 探针（仅当选择器变动时）。`src/host/*`、`tests/api.test.mjs`、`repos.test.mjs`、`graph.test.mjs` 不受影响。

### D2 分区模型：ZONE_SPECS / AFFIX_SPECS / TABS / LAYOUT_KEY

**选了什么**：照 `RAIL_SPECS`(9851) + `railOrderOf`(9930) / `railOrderText`(9941) + `migrateRailConfig`(10097) 的成熟范式，新建**浏览器本地**配置：`UGIT_ZONE_SPECS`（列分区权威表：id / 文案键 / 默认可见 / 默认宽 / min / max / 图标）、`UGIT_AFFIX_SPECS`（`toolbar`/`iconRail`/`commitBox`）、`UGIT_TABS`（3 个 Tab 候选列集）、`LAYOUT_KEY = 'dsh-ide-git.layout.v2'`（新键，现有 11 个 key 无占用，`grep -n "const .*KEY = 'dsh-ide-git"` 确证）、`normalizeLayout`/`readLayout`/`writeLayout`（一律 `try/catch` 静默降级，照 11376–11406 范式）。`normalizeLayout` 丢弃未知/重复 id、按 `UGIT_ZONE_SPECS` 补齐、代码顺序写空串（同 `railOrderText`），所以以后新增分区不会被旧文档隐藏。`PANES_KEY` 继续承载 `tree`/`changes` 列宽 ratio（按 `columns:wide|tall` 两桶）；`branches`/`history` 附加列宽存 `LAYOUT_KEY.extraRatios`，用**复用 `Gutter` 组件的简化 clamp**（min/max 来自规格），不污染 pane core。写路径**禁止**回退退役键 `RAIL_KEY`(9845)（不变量 14）。

**落点（二次确证后的最终结论）**：新代码放在 **`writePanes`(10379) 结束之后、`/* ---- dock action core`(10384) 开始之前**。确证命令：`sed -n '9963,10100p' src/client.js` 显示 9963–10097 区间实际有 `readCommitSettings`(9968)、`readDateFormat`、`railFormReady`、`conversationImmersiveEnabled`、`readRailConfig`(10007)、`writeRailConfig`(10019)、`writeRailFields`(10063)、`writeRailField`(10089) 共 8 个函数；`grep -oE "client\.indexOf\('[^']+'\)" tests/smoke.mjs | sort -u` 显示 `smoke.mjs:1268` 的 `writeRailFields → /* One-shot move…*/` 切片与 `:1530` 的 `migrateRailConfig → subscribeRailConfig` 切片都横跨该段；`sed -n '10377,10390p' src/client.js` 显示 10379–10384 之间只有空行与注释，不在任何切片内部。原稿「pane core 之后、rail core 之前」（行号不成立：9921 < 10155）与第一次修订「9963 之后、10097 之前」（非空档且被切片横跨）**两版均已作废**。

**为什么**（a/5、req/7、不变量 14）：用户明确「记录到当前浏览器中即可」，后端是 localStorage 而非行 Config；照搬 `RAIL_SPECS` 范式是复用已验证的归一化纪律，不另发明。落点选择本身有取舍：放 pane core 内污染纯函数断言，放 9963–10097 被两个切片吞掉，10379–10384 是唯一既不切断切片、又紧邻 `readPanes`/`writePanes` 范式的位置。

**被否决的备选**：
- *走行 Config（`configForms` + `config.js` volatile 字段）* —— 否决：a/5 排除；`smoke.mjs:1659–1666` 会把每个新字段强制去宿主找 `shape.<field>`，与「浏览器本地记忆」语义不符。
- *把新配置塞进现有 `PANES_KEY`* —— 否决：`normalizePanes`(10243) 只认固定六桶与 `tree/changes/diff` 三 key，塞进去会被静默丢弃（`smoke.mjs:1106–1129` 断言其形状）。
- *不设权威表、直接在 JSX 里写 `hidden[]`* —— 否决：新增分区时旧文档会隐藏新区（不变量 14 的教训）。

**影响面**：`src/client.js` 新增约 120 行纯配置函数；`tests/smoke.mjs` 新增切片断言；无宿主改动。冲突消解（回答第 9 条）：`hidden[]`（全局）vs `UGIT_TABS[tab].zones` → **显隐优先**；`tabs[*].order` vs 顶层 `order` → **Tab 级优先**；`treeOpen`(PANES_KEY) vs `hidden.includes('dirTree')` → **hidden 优先**；`commitBox` 显隐 vs `showComposer` → `affixes.commitBox===false` 时一律不渲染。

### D3 顶部 Tab 视图集与次要视图降级

**选了什么**：新 `UgitTopbar` 取代旧 `topBar`(17282–17307) 的两条大搜索框；保留 `RepoSelect`(13258)、`openBranchSwitchMenu`(17278)、`dig-track`(17297–17299)、动作图标（取自 `RAIL_SPECS`）、设置齿轮、窗口控制（`dockFaceOf` 10393）；新增 `工作区 | 变更 | 历史` 分段 Tab。`activeTab` 默认 `'changes'`，写入 `LAYOUT_KEY.activeTab` 并刷新恢复。「历史」Tab 整块渲染 `historyPane`(17338)，「工作区」Tab 暴露 `WorktreesPane`(14974) 与 `BranchTree`(13382)。顶栏溢出按 `railCapacityOf`(17888) 收进「⋯ 更多」，不横向溢出。

**状态机收敛（明确表态）**：`view`(15184，取值 `'history'|'detail'|'worktrees'`) **保留**：`detail` 归入历史 Tab、`worktrees` 归入工作区 Tab，`selectCommit`(16276) 与 `onBack`(17341/18014) 的回退目标改为「回到当前 activeTab」，不改写入点。`splitTab`(15213) **不再承担主视图切换**，但**保留 state 与 `tabPane()` 包装**：只在窄容器 stack/compact 下决定 history/diff 哪个可见（`diffActive` 17996），这是既有滚动位置保持机制；`useEffect`(15214–15216) 的 patch 清空回退逻辑不动。`treeOpen`(15190) **保留**：仍是 `dirTree` 折叠态，写入 `PANES_KEY.treeOpen`，与 `hidden[]` 的关系是 hidden 优先。

**能力缺口显式列出并当场解决（审查第 14 条，不安排后续阶段）**：清晰参考截图顶栏有 `2月前 ▾` / `4天前 ▾` 两个时间下拉，看似「起始/结束」提交时间范围。但确证本仓库**不具备**该能力：
- `HistoryList`(14532) 只有一个 `since` **内部 state**(14571) 与一个日期下拉(14847)，选项 `today/week/month/year`（`sinceThreshold` 14518–14523），**没有 `until`、没有第二个时间下拉、没有 `2月前/4天前` 自由标签**；
- `HistoryList` props 契约里**没有** `props.since`/`props.until`/`props.onSince`/`props.onDate`（`grep -n "props\.(since|until|dateRange|onSince|onDate)" src/client.js` 零命中）；
- `filter.date`(434/864/…) 是这**一个**下拉的标签文案；`onScopeChange`(17361) 管的是分支范围 `scope`，不是时间。

**采用的解释与做法**：截图那两个下拉是 ugit 对「最近两次提交时间」的**展示性**标签，不是可复用过滤控件；按 §0.4「照参考图复刻平台/编辑器装饰不做」的同一边界，**本次不实现这两个下拉、不新增 `until` 能力**。历史筛选保持仓库现状：`HistoryList.filterBar`(14814) 的单一 `since` 下拉 + 文本/哈希/分支/作者/路径过滤，全部留在「历史」Tab 过滤条（旧布局 `hideSearch` 14814/17360 已如此），**不搬到顶栏**。顶栏只放仓库▾、分支▾、Tab、ahead/behind chip、动作图标、齿轮、窗口控制。

**被排除的解释 / 理由**：①「把 `since` 拆成两个搬到顶栏、再造 `until`」—— 否决：需给 `HistoryList` 新增 props、改 `rows` 派生(14617 `sinceThreshold(since)`)、给宿主 `log` 方法表加参数，超出 req/1–8 视觉重构范围且会碰 `tests/api.test.mjs` 的 log 断言；②「照截图字面画两个假下拉」—— 否决：假控件比没有更糟，违背 req/1 初衷；③「用 `view` 直接当 Tab（不新增 activeTab）」—— 否决：`view` 还承载 detail/worktrees 两个子状态且无持久化，a/3 要求默认 Tab 记忆。

**为什么**（req/3、a/2、req/4）：旧顶栏的「分支或标签」「文本或哈希」两个大搜索框正是用户点名「被重点突出」的元素；收进分支下拉与历史 Tab 过滤条后，主视野才能让给变更/diff。

**影响面**：`src/client.js` 的 `topBar`、body 分支、`renderRail`、`view`/`splitTab` 消费点；`scripts/conversation-probe.mjs`（`chrome==='columns'` 断言依赖 D1 兼容类名，不受本决策影响）；`scripts/screenshots.mjs` 的点击流程（见 D7）。`HistoryList` 的过滤逻辑**不改**。

### D4 目录树复用 buildDirForest，但只做定位/选中不做过滤

**选了什么**：新 `DirTree` 复用 `dirName`(10493)、`buildDirForest`(10508)、`remoteTreeStripOf`(9241) 与 `TREE_KEY`(9701) 的 `readTreeState`(9703)/`writeTreeState`(9713) 折叠态，把 `summary` 的变更文件路径构造成目录森林，渲染树 + 自己的搜索框（截图形态）。

**能力缺口显式修正（审查第 14 条）**：`ChangesPanel`(13757) 的 props 契约里**没有** `pathFilter` 或目录过滤入参（确证：13790 只有 `groupBy`/`foldedDirs`/`selection`/`onDiff`/`onSelectionChange` 等；`pathFilter` 是 `HistoryList`(14574/14789) 的入参，15282 的 `pathFilter` state 只喂给 `HistoryList`(17360)）。因此：
> 点目录树节点**不承诺过滤变更列表**。采用的行为：①点文件 → 调既有 `props.onDiff(item, group)` 打开该文件的 diff(13862/13945)，并可选经 Panel 的 `onChangeSelection`(17705) 同步选中态（`ChangesPanel` 的 `onSelectionChange` 在 17705 装配、`selection` 在 13801 消费）；②点目录 → 复用 `groupBy`(15682)/`setGroupBy`(15684)/`onGroupBy: setGroupBy`(17685) 把列表切到「按目录」并展开对应 `foldedDirs`(13796)；③树内搜索框只过滤**树节点**（本地 state），不改 `ChangesPanel` 数据。
> 若将来要真·目录过滤，需给 `ChangesPanel` 新增 `dirFilter` prop 并改其 `rows` 派生 —— **本次不做**，理由：那是列表行为改动，会牵动 `selection-probe.mjs` 的 `.dig-folder-head`/`.dig-row-nested` 断言。

**为什么**（a/4、req/4）：三个纯函数已在仓库里，不另造数据层；`TREE_KEY` 已有折叠记忆，正好承接「位置大小记忆」里的树折叠。

**被否决的备选**：*把 `BranchTree`(13382) 当目录树复用* —— 否决：它渲染的是分支/标签，不是文件路径；截图要的是文件目录树。*给 `ChangesPanel` 加 `dirFilter` prop* —— 否决：见上，超出范围且破坏既有列表探针。

**影响面**：新增 `DirTree` 组件；`ChangesPanel` **不改**；无宿主改动。

### D5 大号 split diff 常驻，并把默认值改为 split

**选了什么**：复用 `diffPaneOf(true)`(17407–17424) 的 `fillDiff`(17960) 形态：`.dig-diff-head` 路径面包屑 + 「在右侧栏打开」+ `DiffBody`(11134) → `LineDiff`(11548)。`split`/`wrap` 工具条(11630–11647) 与 `onActiveFile → setDiffPath`(11560–11563 / 17424 / 15207) 上报链**一行不改**。

**默认 split 的显式处理（与现状冲突，已修正）**：`readLineDiffPrefs`(11379–11388) 当前默认 `{split:false, wrap:false}`（11385/11387），`LineDiff`(11552) 用 `useState(readLineDiffPrefs)` 播种、`useEffect`(11553) 持久化。若不动默认值，截图要求的「大号并排 split diff」在新安装/清缓存后是 unified，req/2/req/4 落空。
> 把 `readLineDiffPrefs` 的两处默认值改为 `{split:true, wrap:false}`，**保留函数名、`LINEDIFF_KEY` 字面量、返回形状、`useState(readLineDiffPrefs)` 播种与 `useEffect` 持久化不变**。`smoke.mjs` 对该键没有精确文本断言（只有 `useState(readChangesGroupBy)` 那条针对 groupBy），改默认值不触发现有正则；需**新增一条断言**钉住 `split:true` 默认值，防止回归。

**这是本次唯一的外部可见行为变更**（审查第 19 条要求标注）：老用户若曾手动切到 unified 并持久化过 `{split:false}`，`readLineDiffPrefs` 读到的是 **stored 值**，不会被新默认值覆盖 —— 只有「从未操作过 split 的新/清缓存用户」看到并排，老用户偏好保持。**可逆**：改回默认常量即可。

**被否决的备选**：*在 `UgitBody` 里强行传 `split` prop 给 `LineDiff`* —— 否决：`LineDiff` 的 `prefs` 是内部 state(11552)，没有 `split` prop；加 prop 会破坏 `smoke.mjs:1879–1890` 的 `split === true && wrap !== true` 分支断言与既有持久化语义。

**影响面**：`src/client.js:11379–11388`（默认值常量）；`tests/smoke.mjs` 新增一条断言；`docs/screenshots/` 视觉。

### D6 设置面走 localStorage，绕开 configForms 且补齐「打开」

**选了什么（落点经探针确证后修正）**：布局设置**只放在面板内齿轮编辑器 `RailSettings`(12653)**，不放进插件页设置卡 `RailSettingsCard`(12075)：逐区**双向 checkbox**（勾选=显示、取消=隐藏，req/5「隐藏及打开」的落点）；上移/下移调列顺序（仿 `moveRailAction` 17860 / `dropRailAction` 17869）；默认 Tab 下拉；`commitBoxPlace` 下拉（`changesBottom | panelBottom`）；「恢复默认布局」按钮（把 `hidden`/`order`/`affixes`/`activeTab` 复位到规格默认，即**一次性打开全部默认区**）；装配照 `RailSettings` 既有 items/onMove/onDrop/onToggle/onReset(18103–18118)，齿轮沿用 `.dig-rail-settings`(17939)。**插件页设置卡只加一节只读说明 + 「打开布局设置」按钮**（点击等同点齿轮），**不放任何 checkbox**。

**为什么改到齿轮（被否决的备选）**：初审稿把布局开关放进 `RailSettingsCard`，但 `scripts/settings-card-probe.mjs:99–101` 的 `visuals()` 扫的是 `[data-plugin-config] input[type=checkbox]` **全部**，`ids[]`(134) 会连新开关一起拿去跑第 4 项「16 个开关 55ms 连点全落地」，再用 `patchValues()`(108–115) 去 profile patch 比对 `rail([A-Z]…)` 字段 —— 布局开关没有对应 `railXxx`，探针必挂。放齿轮即可：探针第 86 行只 `.click()` 打开 `.dig-rail-settings`，不枚举其 checkbox；`ids.length >= 12`(135) 不变、`box(id)`(106) 的 `dig-rail-` 前缀不变，**`settings-card-probe.mjs` 零改动**。

**关键约束（已确证）**：`tests/smoke.mjs:1659–1666` 扫描 `RailSettingsCard` 源码里的 `const field = '…'` 与 `(textRow|selectRow)\('…'`，逐个要求宿主 `config.js` 有 `shape.<field> = schema.*()`。新卡只加只读说明与按钮、**不写字段**，扫描集合不变；`RailSettings`(12653) 在切片范围(1659) 之外，其 `layoutToggle`/`layoutSelect` 不会被误扫。仍**新增 smoke 断言**覆盖 `LAYOUT_KEY` 的 `normalizeLayout`/`readLayout`/`writeLayout` 与「双向翻转」行为，确保不是靠绕过检查蒙混。

**「提交框换位置」的显式处理（实现层取舍已落地；原稿「抽出共享 CommitBox 组件」作废）**：提交框是 `ChangesPanel` 内部 `composer` 硬编码渲染的，7 个 `useState` + `aiRun`/`submit`/`aiFollowSession`/`aiConfirmDialog` 全在 `ChangesPanel` 内；且 `const composer = props.compact === true` 是 `smoke.mjs:1591` 的切片锚点、`E(ModelRoutePicker, …)` 有「恰好 2 次」计数断言(2240)、`aiRun`→`setAiUndo(` 有切片断言(1869)。**整块搬迁成 `CommitBox` 组件会连锁打破这三条**，故采用等价但零破坏的做法：
> 给 `ChangesPanel` 新增两个可选 prop：`showComposer`（默认 `true`；`false` 时用 `shownComposer = null` 从本列移除 composer）与 `onCommitBox(node)`（在 `useEffect` 里把**同一个 composer React element** 上报给父级，父级渲染到面板底部）。state 仍唯一留在 `ChangesPanel` 内、上报的是同一 element 而非第二份实例，故 `panelBottom` 落点不会丢草稿/amend/AI 状态，也不会在 render 期触发父级 setState。
> `composer` JSX、`confirm: true`、`smoke.mjs:1246–1249` 的 `head` 文本断言全部一字不动；`E(ChangesPanel, {…})` 新增的两个 prop 放在 `onCommit:` 之后以避开 `smoke.mjs:1875` 的 `base: base,` 切片。

**被否决的备选**：*用 CSS `order` 把 `composer` 挪到底部* —— 否决：`composer` 在 `ChangesPanel` 的 flex 列内部，CSS order 无法跨出列容器；且会破坏 `dig-commit-box` 的 border-l2 断言(1853)。*把布局开关放插件页设置卡* —— 否决：见上，探针必挂。

**影响面**：`src/client.js`（`RailSettingsCard` 只加只读说明+按钮、`RailSettings` 加布局开关、`ChangesPanel` 加 `showComposer`/`onCommitBox`、`UgitBody` 消费 `commitBoxPlace`）、`tests/smoke.mjs`（新增 `LAYOUT_KEY` 纯函数与双向翻转断言）、`scripts/settings-card-probe.mjs` **零改动**。`src/host/config.js` / `RAIL_CONFIG_IDS` / `configForms` 绑定 **不动**。

### D7 词典、文档、测试与截图的同步演进

**选了什么**：尽量复用既有键（`changes.title`、`pane.diff`、`toolbar.tree`、`settings.history.title` 等），只新增约 20 个 `layout.*` 键（`grep -c "'layout\." src/client.js` = **0**，无占用）。新键必须 **21 门全同步**（`ZH` 107 / `EN` 537 / `LOCALES` 19 门自 973 起，每门前 `/* locale: <tag> */`），否则 `smoke.mjs:971–1003` 逐门 `deepEqual` 与多处 `===21` 计数全红；用一次性脚本按标记批量插入，插完 `npm test` 验证。`t` 保持查表函数 `translatorOf(ctx)`(9194)、`ctx.locale.register`(20646–20650) 不变（不变量 10）；hooks 依赖数组先声明后引用（不变量 12），改完跑 `ssr-check.mjs`。`CHANGELOG.md` 按「变更记录纪律」补倒序 `## Unreleased`（feat），不追加进 `AGENTS.md`；`AGENTS.md` **不变量 7** 从「`columns/stack/compact` 三 chrome」改写为「ugit 分区模型 + 宽度仍决定窄容器降级」，目录地图补 `docs/plans/`；`README.md`/`README_EN.md` 的「效果 / Screenshots」两列表格**文字**改为 ugit 形态描述（图名不变，§0.4 已表态），`screenshots.json` 不动。

**重拍 6 张 `docs/screenshots/`**：`scripts/screenshots.mjs` 现有点击流程依赖 `.dig-commit`(130)、`.dig-tree .dig-row`(137)、`.dig-detail-files .dig-row`(162)、`.dig-rail-settings`(153)，且第 126 行注释仍写「the three-pane workbench: branch tree, commit graph, changes + commit box」。按 D1/D3 分支树与提交图谱已降级进 Tab，因此第 2（提交右键菜单）、3（删除分支+撤回）、5（提交详情）三张的**交互路径要改为先切到对应 Tab**，并同步改 126 行注释为 ugit 三列描述；图名与数量不变（§0.4 已表态），`screenshots.json` 与两份 README 的图名引用不动。第 1/4/6 张只需新布局就位（第 4 张仍点 `.dig-rail-settings` 打开齿轮，D6 已确认齿轮保留）。

**§1.3 按清晰参考截图逐元素表态（复用既有能力 vs 不做）**：「三列表/树形」复用 `groupBy`(15682)/`readChangesGroupBy`(11398)/`setGroupBy`(15684)/`onGroupBy`(17685) 与 21 门 `changes.group*` 文案；「Default ▾」复用 `sortKey`(15687)/`more.sortGit|Path|Name|Status`(17550–17553)；状态图标复用 `ChangeRow`(13718) 的 `dig-file-status-*`(13741)；split diff 同步滚动复用 `SplitColumns`(11459/11470)。**均不新造状态、不新增文案键**。不做：储藏变更复选框 / 推送远程单选 / 待提交(N) 计数 / 提交至 master 文案（ugit 提交策略 UI，硬复刻会引入未要求语义并牵动 `confirm:true` 不变量 4）；文件视图/查看修改/监视/UTF-8/LF（编辑器外壳）；新版本升级胶囊/云图标/头像/平台状态栏（平台装饰）；顶栏两个时间下拉（D3 能力缺口）。

**被否决的备选**：*不重拍、只改 README 文字* —— 否决：配图会与新界面不符，等于文档撒谎；req/4「按截图重新实现」要求外观一致。*改 `docs/screenshots/` 文件名或数量* —— 否决：要同步 `screenshots.json` 与两份 README 共 3 处且无收益。

**影响面**：`src/client.js` 词典区、`tests/smoke.mjs`、`scripts/screenshots.mjs`、`docs/screenshots/*.png`、`README*.md`、`CHANGELOG.md`、`AGENTS.md`。

## 持久化 schema

```
LAYOUT_KEY = 'dsh-ide-git.layout.v2'   (localStorage, JSON, 新键无占用)
{
  version: 2,
  activeTab: 'changes',
  tabs: { changes:{order:''}, workspace:{order:''}, history:{order:''} },  // 只记顺序，不记尺寸（§0.4 表态）
  hidden: ['branches', 'history'],
  order: '',
  affixes: { toolbar:true, iconRail:true, commitBox:true, commitBoxPlace:'changesBottom' },
  extraRatios: { branches:0.20, history:0.34 }
}
PANES_KEY='dsh-ide-git.panes.v1' / LINEDIFF_KEY='dsh-ide-git.linediff.v1'（默认值改 split:true）
CHANGES_GROUP_KEY / TREE_KEY / FAV_KEY / REPO_KEY / MANUAL_REPO_KEY 沿用
PAINT_KEY 走 sessionStorage，与本次无关
```

`normalizeLayout` 保证：未知/重复 id 丢弃、缺失 id 用 `UGIT_ZONE_SPECS` 补齐、`activeTab` 非法回退 `'changes'`、`affixes` 逐项布尔化、`commitBoxPlace` 非法回退 `'changesBottom'`、`extraRatios` 夹到规格 min/max。冲突消解见 D2。

## 错误处理、边界与安全（审查第 16–21 条）

- **错误处理**：所有 localStorage 读写 `try/catch` 静默降级；解析失败/旧版 schema/未知字段一律走 `normalizeLayout` 默认值，绝不因坏数据白屏。所有列都被隐藏时 `UgitBody` 渲染「未启用任何功能区」空态 + 「打开布局设置」按钮。窄容器（`<400`）按宽度自动收起 `dirTree` 但 `hidden` 偏好不丢，`changes`+`diff` 优先，`dig-root-narrow` 标记照旧(1706)。无仓库/加载中/无差异/无提交等既有空态(18000–18008)保留。
- **明确不做（§0.3）**：宿主半 `src/index.js`/`src/host/*`、方法表、写队列、撤回、破坏性守卫；新依赖/第二个 client entry/构建；旧三栏「经典模式」开关；新增 `config.js` volatile 字段、动 `RAIL_CONFIG_IDS`；`configForms`/`plugins.bundle.config` 注册面；改 version/发版；`LineDiff` 内部逻辑（除 `readLineDiffPrefs` 默认值）。逐条理由见完整方案 §0.3。
- **易误认但显式排除（§0.4，12 项）**：彻底删除分支/提交记录（应为可隐藏可打开）；把 `branches`/`history` 做成默认可见第 4/5 列；每 Tab 记一套尺寸；二维 dock；跨浏览器同步；重做 LineDiff 高亮/词级 diff；改截图文件名/数量；改底座/两座位/第三座位；复刻储藏变更/待提交/提交至 master；复刻编辑器外壳/平台装饰；新增「三列表/树形」新状态；**顶栏两个时间下拉 / 把历史筛选搬到顶栏**（D3 能力缺口）。
- **安全与权限边界（第 20 条）**：本次**不触及**认证/授权/沙箱/文件访问/凭据处理。逐条保持：不变量 4（破坏性操作 `confirm:true`，「提交并推送」唯一例外 —— `CommitBox` 抽取只搬 JSX 不碰 `submit(push)` 与守卫字符串）；不变量 5（两条信任围栏，宿主半不动）；不变量 13（浮层在 `.dig-root` `position:relative` 内 `absolute`，新顶栏仓库/分支下拉沿用 `openPickerAt`(16324) → `ContextMenu`(11784) → `SearchPicker`(11896)，`dig-root`/`dig-shell` 保留）；不变量 15/16（撤回句柄 / `WRITE_METHODS`，宿主半不动）；不变量 1/2/9/10/11/12/14/17/18/21（见 §0.3、D1、D7）。
- **最坏后果与范围（第 18 条）**：`src/client.js` 渲染期抛错（TDZ / `t is not a function` / 坏 localStorage 未兜底）→ `dsh-better-sidebar` 错误边界吞掉整个面板，`.dig-root` 不出现（AGENTS.md 记录过 v0.1.6 与 2026-09-14 两次真实事故）。范围 = **仅本插件 Tab 与两个原生座位**，不波及其它插件/会话/宿主进程，Git 仓库数据不受影响（无宿主改动）。次生：smoke 断言成片变红（CI 挂）、六个探针失效、README 配图与实物不符，均可检测可修复不丢数据。防线：`ssr-check.mjs` 抓渲染期异常 + `layout-probe.mjs` 带真数据抓面板崩溃 + `npm test` 抓契约。
- **回退路径与不可逆项（第 19 条）**：`LAYOUT_KEY` 全新键 **完全可逆**（删代码或 `localStorage.removeItem('dsh-ide-git.layout.v2')` 回默认，不迁移、不覆盖任何旧键）；`UgitBody`/`UgitTopbar` 等替换 body **可逆**（git revert 本次 client.js 改动，旧 `PANES_KEY`/`LINEDIFF_KEY`/`TREE_KEY` 数据保持可读未改形状）；`readLineDiffPrefs` 默认 `split:false→true` **可逆但属唯一外部可见行为变更**（改回常量即可，仅影响从未操作过 split 的用户，老用户 stored 值优先偏好不丢）；`ChangesPanel` 新增 `showComposer` 默认 `true` **向后兼容**；21 门词典新增键、README 6 张图重拍均**可逆**。**不做**的事：旧 `PANES_KEY` 形状、`RAIL_KEY` 迁移、`config.js` schema、profile、已发布接口语义 —— 全部不碰，因此**没有数据格式迁移、没有已发布接口语义变更、没有跨版本数据格式变更**。
- **本次不解决的遗留风险（第 21 条，不留白）**：①`UgitBody` 保留 `dig-body-stack`/`dig-body-compact` 兼容类名但窄容器列布局语义已变 → `layout-probe.mjs` 注释补「chrome 名仅为兼容标识，实际列集由 `LAYOUT_KEY` 决定」，不改断言；②`screenshots.mjs` 第 2/3/5 张改路径后 Tab 名再改会再失效 → 建议把 Tab 名抽成脚本顶部常量，本次只做最小改动；③目录树点目录只能切「按目录分组」不能真·过滤列表（D4 已表态）→ 若后续要做，给 `ChangesPanel` 加 `dirFilter` prop 并补 `selection-probe.mjs` 断言，本次不做；④`extraRatios` 简化 clamp 没有 pane core 两级 ceiling → 已限定 min/max 且窄容器自动收起附加列，若真机复现再移植 clamp，不在本次范围；⑤`AGENTS.md` 不变量 7 改写后历史 CHANGELOG 里「columns/stack/compact」描述不再对应新代码 → 不回改历史条目（变更记录纪律），以不变量 7 新描述为准；⑥**真机 layout-probe / 六个探针本次未跑通**：隔离实例 3099 起来后页面停在「重新连接中…/连接中断，正在重试」、右侧栏无 guide entries、会话无法真正开始，`layout-probe.mjs` 的 `enterSession()` 与发布版 CLI「选择工作区」初始态不匹配 → 有数据的 `UgitBody` chrome 未经真机渲染验证；但 `node --check` / `smoke.mjs`(77/0) / `ssr-check.mjs`(四座位全 OK) / `npm test`(仅既有 `api.test.mjs:578` 基线失败) 全绿且 Playwright `PAGEERRORS: []`。后续需按 `selection-probe.mjs` 的 `/api/workspace/create` gateway 绑定更新 `enterSession()` 并再跑全套探针；隔离实例已按 AGENTS.md 纪律收尾杀掉，3099 空闲、3080 从未触碰。

## 验证

按依赖顺序：`npm test`（CI 唯一门槛，含词典 21 门、`PANE_*` 数值、D1 更新后的 body 断言、新增 `LAYOUT_KEY`/`split` 断言）→ `node scripts/ssr-check.mjs` → `node scripts/layout-probe.mjs "<url>" [out]` → `node scripts/panes-probe.mjs "<url>" [out]` → `node scripts/dock-probe.mjs "<url>" [out] native|degraded` → `node scripts/selection-probe.mjs "<url>" [out]`（需 `DIG_PROBE_REPO`/`DIG_PROBE_WORKSPACE`）→ `npm run probe:settings-card` → `node scripts/conversation-probe.mjs "<url>" [out]` → `node scripts/screenshots.mjs <web-url> [out]`。

真机纪律（AGENTS.md）：独立 `DSH_HOME` + 端口 **3099** 隔离实例，用发布版 CLI（不用本机 dev checkout），验证完**自己杀掉**（`lsof -tiTCP:3099 -sTCP:LISTEN` 自查）；**绝不碰 3080、绝不替用户重启**。宿主半无改动，不需要用户重启 `dsh web`；client 半改动要硬刷新页面生效，先 `ls -l` 看安装形态是硬链接还是副本。
