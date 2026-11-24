- [revision 4] 完整设计见 docs/plans/2026-11-24-ugit-layout-design.md（已提交）。摘要：

【信息架构】按 ugit 截图重构为单行顶栏 + 竖排图标 rail + 三列主体（目录树窄列 | 变更列表+列底提交框 | 大号并排 split diff，diff 用 flex:1 占满为主角）。分支树/标签、提交图谱降级为顶部 Tab 切换的独立视图（工作区 / 变更 / 历史），默认「变更」。

【决策 D1】换血不换骨架：原样复用 pane sizing core 纯函数(10155-10366)、Gutter 控件(12952-13031)、LineDiff/DiffBody 偏好链、buildDirForest、ResizeObserver 测量骨架与一次手势一次落盘；ugit 三列复用既有 pane key（dirTree→tree 默认200px、changes→changes 默认290px、diff 不设 data-pane 靠 flex:1）；只删 17999-18055 三套 chrome body 分支换成按配置 map 的 UgitBody；保留兼容类名(dig-body-columns/.dig-pane-tree/.dig-pane-changes/.dig-pane-main/[data-pane]/dig-topbar)与既有探针/smoke 契约，少数旧 JSX 文本断言诚实改为针对 UgitBody。

【决策 D2】新增 UGIT_ZONE_SPECS / UGIT_AFFIX_SPECS / UGIT_TABS 权威表与 LAYOUT_KEY='dsh-ide-git.layout.v2'（localStorage）；normalizeLayout 丢弃未知/重复 id、按规格补齐、代码顺序写空串；沿 RAIL_SPECS 范式但独立存储后端。PANES_KEY 继续承载 tree/changes 列宽 ratio，LINEDIFF_KEY 继续承载 split/wrap。

【决策 D3】UgitTopbar 取代旧双搜索框 topBar，新增工作区/变更/历史 分段 Tab；activeTab 写入 LAYOUT_KEY 并刷新恢复；view/splitTab 旧状态机收敛进 Tab 语义。

【决策 D4】新 DirTree 复用 dirName(10493)/buildDirForest(10508)/remoteTreeStripOf(9241) 与 TREE_KEY 折叠态，不另造数据层。

【决策 D5】大 diff 复用 fillDiff/DiffBody/LineDiff，默认 split:true，split/wrap 工具条与 onActiveFile 链一行不改。

【决策 D6】RailSettingsCard 新增 fold('layout.settings.title') 一节（逐区显隐、上移下移调顺序、默认 Tab、提交框位置、恢复默认）+ 面板内齿轮快捷开关；新设置项用独立命名的 layoutToggle/layoutSelect（不用 textRow/selectRow），走 localStorage 而非 configForms，同时新增 smoke 断言验证其读写；config.js / RAIL_CONFIG_IDS 不动。

【决策 D7】新增约 20 个 layout.* 文案键必须 21 门词典同步；t 保持查表函数、hooks 先声明后引用；CHANGELOG 补条目、重拍 6 张 README 效果图、AGENTS.md 不变量 7 改为 ugit 分区模型描述。

【持久化 schema】LAYOUT_KEY = {version:2, activeTab, tabs{changes/workspace/history:{order}}, hidden[], order, affixes{toolbar,iconRail,commitBox,commitBoxPlace}, extraRatios{branches,history}}。

【测试】npm test（含词典 21 门、PANE_* 数值、新 localStorage 断言）、ssr-check、layout-probe、panes-probe、settings-card-probe、conversation-probe、screenshots；隔离实例 DSH_HOME + 3099，绝不碰 3080。

【分 8 阶段】配置层 → 词典 → 新组件 → 接线 → CSS → 设置面 → 测试探针 → 收尾。
- [revision 5] 完整设计见 docs/plans/2026-11-24-ugit-layout-design.md（审查修订版，已提交 2165128；本文为摘要，冲突时以完整方案为准）。当前任务为 l1，无 openspec/ 目录，故无第二份设计文档。

【需求基线】原始需求编号 req/1–8，对齐结论 a/1–6，见完整方案 §0.1/§0.2；§0.3 逐条列出不做的事与理由，§0.4 列出「易误认为在范围但显式排除」的 12 项，§0.5 列出 6 处歧义及采用/排除的解释。附录 B 是需求↔决策双向追溯表，无无来源决策。7 个决策均为 `### D<n>` 一节，各含「选了什么/为什么/被否决备选/影响面」。

【D1 兼容性叠加（含二次修订）】原样复用 pane sizing core 纯函数(10155–10366)、Gutter(12952)、measureGate、ResizeObserver 骨架、readPanes/writePanes、commitPanes/endPaneDrag。ugit 三列复用既有 pane key：dirTree→tree(200px)、changes→changes(290px)、diff→直接复用 fillDiff(17960)。**关键更正**：fillDiff 自带 `data-pane="diff"` 且 inline style 为 null(17407)；`paneStyle('diff')` 返回高度(15505)，绝不能调用，否则主 diff 被压成 55% 半高。`.dig-pane-main`(18627 flex:1) + `.dig-diff-pane-fill`(18941) 撑满宽高，measurePanes 照常量到 diff 高度，paneGeometry clamp 语义一字不改。删 17999–18055 三套 body 分支换成 UgitBody；保留 dig-root/dig-topbar/dig-shell/dig-empty、dig-body-columns/stack/compact、.dig-pane-*、[data-pane]、dig-root-narrow、RAIL_VIEW_IDS、splitTabs/tabPane、fillDiff/diffPaneOf 签名以守住 ssr-check 与六个探针。smoke 需诚实更新的文本断言已列完整清单（918–940、2351–2372 等）。

【D2 分区模型】UGIT_ZONE_SPECS / UGIT_AFFIX_SPECS / UGIT_TABS 权威表 + LAYOUT_KEY='dsh-ide-git.layout.v2'（新键无占用）。normalizeLayout 丢弃未知/重复 id、按规格补齐、代码顺序写空串（照 RAIL_SPECS 范式）；PANES_KEY 继续承载 tree/changes 列宽，branches/history 附加列宽存 extraRatios。落点修正：新代码插在 rail config core 结束(9963) 之后、migrateRailConfig(10097) 之前（原稿「pane core 之后、rail core 之前」行号不成立）。

【D3】UgitTopbar 取代双搜索框 topBar，新增工作区/变更/历史 Tab，activeTab 写入 LAYOUT_KEY；view(15184)/splitTab(15213) 收敛但不删（保滚动位置）；窄容器仍按宽度选 stack/compact 类名（不变量 7）。

【D4】DirTree 复用 dirName(10493)/buildDirForest(10508)/remoteTreeStripOf(9241)/TREE_KEY(9701)。**能力缺口已修正**：ChangesPanel 无 pathFilter（pathFilter 属 HistoryList 14574），目录树点文件只能走 onDiff(13862)/onSelectionChange(17705)、点目录走 groupBy(15682)/setGroupBy(15684)，不承诺过滤列表。

【D5】大 diff 复用 fillDiff→DiffBody→LineDiff，split/wrap 工具条与 onActiveFile 链一行不改。**默认值冲突已修正**：readLineDiffPrefs(11379) 现默认 {split:false}，改为 {split:true} 并保留签名/键/形状/useState 播种/useEffect 持久化；仅影响从未操作过 split 的用户，老用户 stored 值优先（本次唯一外部可见行为变更，可逆）。

【D6 设置面（落点经探针确证后修正）】布局开关**只放面板内齿轮 RailSettings(12653)**：逐区双向 checkbox（req/5 隐藏及打开）、上移下移调顺序、默认 Tab、commitBoxPlace 两值下拉、恢复默认（一次性打开全部）。插件页 RailSettingsCard(12075) **只加只读说明+「打开布局设置」按钮，不加任何 checkbox** —— 因 settings-card-probe.mjs 的 visuals() 扫全部 checkbox 并拿 ids[] 比对 profile patch 的 railXxx 字段，放卡里必挂；放齿轮则该探针零改动。同时避开 smoke.mjs:1659 的 textRow/selectRow/const field 扫描（新项用 layoutToggle/layoutSelect，并新增 LAYOUT_KEY 纯函数与双向翻转断言）。提交框换位置：ChangesPanel 新增可选 showComposer（默认 true）+ 抽出共享 CommitBox（14090–14160），commitBoxPlace==='panelBottom' 时由 UgitBody 在底部渲染；提交逻辑与 confirm:true 不动。

【D7】21 门词典新增约 20 个 layout.* 键（当前 0 占用）；CHANGELOG 补 Unreleased、AGENTS.md 不变量 7 改写、README 效果段文字、重拍 6 张图。screenshots.mjs 第 2/3/5 张改「先切 Tab」路径、第 126 行注释改 ugit 三列；图名/数量/screenshots.json 不变。§1.3 按清晰参考截图逐元素表态做/不做（三列表/树形复用既有 groupBy 不新造状态；储藏变更/推送远程/待提交计数/编辑器外壳/平台装饰均不做）。

【持久化 schema】LAYOUT_KEY={version:2, activeTab, tabs{3×{order}}, hidden[], order, affixes{toolbar,iconRail,commitBox,commitBoxPlace}, extraRatios{branches,history}}；冲突消解：显隐优先于 Tab 候选、Tab 级 order 优先于顶层、hidden 优先于 treeOpen。

【边界与风险】§6.2 逐条保持不变量 1/2/4/5/6/7/9/10/11/12/13/14/15/16/17/18/21（安全/权限不变）；§6.3 最坏后果=better-sidebar 错误边界吞掉本插件面板、范围仅限本 Tab；§6.4 回退路径：LAYOUT_KEY 新键完全可逆、无数据迁移、无已发布接口语义变更，唯一外部可见变更是 split 默认值且可逆；§6.5 列 5 项本次不解决的遗留风险。

【验证】npm test → ssr-check → layout-probe → panes-probe → dock-probe → selection-probe → settings-card-probe → conversation-probe → screenshots；隔离 DSH_HOME + 3099，绝不碰 3080、不替用户重启。分 8 阶段实施（§7.2）。
- [revision 16] 【层级说明（本轮更正）】任务已因补齐 OpenSpec 工件抬升为 **l2**（`get_delivery_task` 返回 `level:"l2"`），因此存在**第二份设计文档** `openspec/changes/refactor-ugit-layout/design.md`（`record_spec(kind:'design')` 写入），已从「纯索引」改写为**自足版**：7 个 `### D<n>` 决策每个都独立写清「选了什么/为什么/被否决备选/影响面」，并补齐错误处理、明确不做/易误认排除、安全边界、最坏后果、回退路径、5 项遗留风险、验证顺序。上一版摘要里「当前任务为 l1，无 openspec/ 目录，故无第二份设计文档」已作废。完整方案草稿仍以 `docs/plans/2026-11-24-ugit-layout-design.md` 为准（含 §0 需求基线/歧义、§1.3 逐元素对照、附录 A 符号确证命令、附录 B 双向追溯表）；三处冲突以该草稿为准。

【本轮审查抓到并就地修正的 3 处实质缺口】
1. **D2 落点错误（与仓库现状不符）**：`sed -n '9963,10100p' src/client.js` 显示「rail config core 结束(9963) 之后、migrateRailConfig(10097) 之前」**并非空档**，实际有 readCommitSettings(9968)/readDateFormat/railFormReady/conversationImmersiveEnabled/readRailConfig(10007)/writeRailConfig(10019)/writeRailFields(10063)/writeRailField(10089) 共 8 个函数；且 `tests/smoke.mjs:1268` 的 `writeRailFields → /* One-shot move…*/` 切片与 `:1530` 的 `migrateRailConfig → subscribeRailConfig` 切片都横跨该段。`grep -oE "client\.indexOf\('[^']+'\)" tests/smoke.mjs | sort -u` 确证**最终安全落点 = `writePanes`(10379) 之后、`/* ---- dock action core`(10384) 之前**（只有空行与注释，不在任何切片内部）。原稿两版落点均作废。
2. **D3 假设能力不存在**：清晰截图顶栏 `2月前 ▾`/`4天前 ▾` 两个时间下拉被写成「复用 FilterSelect/sinceThreshold 搬到顶栏」。确证 `grep -n "props\.(since|until)" src/client.js` 零命中；`HistoryList`(14532) 只有**单一** `since` 内部 state(14571) + 单一日期下拉(14847，选项 today/week/month/year，`sinceThreshold` 14518)，**无 `until`、无第二下拉、无 props 入参**。按 §0.4 边界**不做**这两个下拉、不新增 until 能力、不把历史筛选搬到顶栏；历史筛选仍留历史 Tab 的 `HistoryList.filterBar`(14814)。已同步改 §1 骨架图、§1.3 逐元素表、§0.4 排除项、§0.5 歧义、附录 A/B、openspec design.md、`specs/ugit-layout/spec.md`（那条假 scenario「顶栏时间筛选生效」改为「顶栏 MUST NOT 渲染时间下拉、HistoryList props/rows 不得改」）、tasks.md 与 record_tasks 清单。
3. **openspec design.md 不合格**：原为纯索引（第 3 行把论证全推给 docs 草稿），7 个 D 节无「为什么/被否决备选/影响面」，违反审查第 6/7/8 条与「每个决策能让不了解上下文的读者独立判断」。已整体重写为自足版。

【需求覆盖不变】req/1–8 与 a/1–6 在两份设计文档均有具体落点（§0.1/§0.2 编号表、附录 B 双向追溯表、每个 D 节标题带需求/约束来源）；无无来源决策；§0.4 逐条表态 12+ 项「易误认但排除」；§0.5 6 处歧义写明采用/排除解释；§6 覆盖第 16–21 条边界与风险。

【交付状态】OpenSpec 六件齐全（proposal/design/tasks + ugit-layout/zone-config/diff-focus 三个 spec delta），tasks.md 与 record_tasks 已同步为同一份（含 10379–10384 落点与「不承载时间下拉」修正）。9 项 l2 清单全部 pending 实现阶段；本轮只改设计文档与工件，未动 src/client.js。
