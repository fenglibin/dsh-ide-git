- [revision 3] 【原始请求】dsh-ide-git 当前界面不习惯：变更文件与文件差异视图没有重点突出，而「分支或标签」「提交记录」等平时不关注的信息被重点突出且无法隐藏；要求按 ugit 布局重新实现插件，能在设置中增加功能区的隐藏/打开，调整位置大小后自动记忆（记录到当前浏览器即可），并提供了 ugit 截图作参考。

【与用户确认的结论】
1. 布局模式：直接替换为 ugit 布局，彻底移除现有「分支树 | 提交图谱 | 变更」三栏，旧布局不再保留开关。
2. 次要视图：分支树/标签、提交图谱走顶部 Tab 切换的独立视图（工作区 / 变更 / 历史），默认「变更」，主视野完全留给变更文件列表与大号 diff。
3. 配置范围（四项全选）：功能区显隐开关；分区拖拽调尺寸 + 自动记忆；功能区位置/顺序调整 + 记忆；默认 Tab 与 diff 模式（split/unified/wrap）记忆。
4. 目录树保留为独立、可隐藏的分区（照截图保留窄列）。
5. 记忆介质：用户明确「记录到当前浏览器中即可」= localStorage，不写宿主行 Config / profile。

【参考截图要点】顶部单行工具条（仓库▾ / 工作区·变更·历史 Tab / 分支▾ / 同步状态 / 更新·推送 / 窗口控制）；最左约 20px 竖排图标 rail；主体三列 = 目录树（窄）| 变更列表（状态分组+计数，列底部内嵌提交信息框与「提交至 <分支>」）| 大号并排 split diff（基础版本 | 本地修改、行号、语法高亮、±统计、split/wrap 工具条），diff 最宽且为视觉主角。

【明确不在范围】不动宿主半（src/index.js、src/host/*）、方法表、写队列、撤回、破坏性守卫；不引入新依赖、不拆第二个 client entry、不加构建；不保留旧三栏切换开关；不新增宿主 config.js 的 volatile 字段（动作条 RAIL_SPECS 保持原样）。

【完成判定】①默认视图为 ugit 三列且 diff 为最宽主角；②分支树/提交图谱默认不在主视野、可经 Tab 或设置唤出；③设置里可逐区显隐、调顺序、拖拽调尺寸，刷新后自动恢复；④默认 Tab 与 diff split/wrap 偏好刷新后恢复；⑤21 门词典键集一致、npm test 全绿、ssr-check 与布局/设置探针通过；⑥README 6 张效果图重拍为 ugit 形态。

【勘察结论（四路只读勘察汇总）】
- 现有 Panel 15146-18467；body 三套硬编码 chrome 分支在 17999-18055；chrome 判定 15352-15354；paneGeometry 核心 10290-10365；Gutter 通用控件 12952-13031；LineDiff/DiffBody 11134/11548 可直接复用；目录树可复用 buildDirForest 10508 / dirName 10493 / remoteTreeStripOf 9241。
- 现有可复用持久化：PANES_KEY 10165（尺寸 ratio，按 chrome:wide|tall 分桶）、LINEDIFF_KEY 11378（split/wrap）、CHANGES_GROUP_KEY 11397（分组）、TREE_KEY 9701（折叠节）。缺的是「分区显隐/顺序」「默认 Tab」记忆。
- 词典 21 门（ZH 107 / EN 537 / LOCALES 19 门自 973 起）；新文案键必须 21 门同步，冒烟逐门 deepEqual。
- 设置面：RailSettingsCard 12075（fold 折叠节）、RailSettings 12653（动作条编辑器）、apply(ctx) 20627。新增功能区设置照 fold 机制加一节，走 localStorage，不动 configForms / config.js。
- 约束：smoke.mjs 把 PANES_KEY / PANE_BUCKETS 六桶 / PANE_CHROME_KEYS / 大量 CSS 类名 / data-action / 词典计数硬编码锁死；探针依赖 .dig-body-* / .dig-pane-* / [data-pane] / .dig-split-tabs。策略：保留关键兼容类名与 PANE_* 常量形态，只在其上叠加 v2 布局配置层，避免连锁改测试。
