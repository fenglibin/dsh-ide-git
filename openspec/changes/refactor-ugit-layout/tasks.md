## 1. 配置层（纯函数，先绿）

- [ ] 新增 `UGIT_ZONE_SPECS`（5 列分区）/ `UGIT_AFFIX_SPECS`（3 附属）/ `UGIT_TABS`（3 Tab）/ `LAYOUT_KEY='dsh-ide-git.layout.v2'`，**最终安全落点 `writePanes`(10379) 之后、`/* ---- dock action core`(10384) 之前**（9963–10097 非空档且被 smoke.mjs:1268/:1530 两个切片横跨，见 design/D2 二次确证） (covers: zone-config/归一化与坏数据容错, design/D2)
- [ ] 实现 `normalizeLayout`（丢弃未知/重复 id、补齐缺失、activeTab 回退、affixes 布尔化、commitBoxPlace 回退、extraRatios 夹取）、`readLayout`/`writeLayout`（try/catch 静默降级、写路径禁止回退 RAIL_KEY） (covers: zone-config/坏数据不白屏, zone-config/新增分区不被旧文档隐藏, design/D2)
- [ ] 在 `tests/smoke.mjs` 新增 `LAYOUT_KEY` 纯函数切片断言与双向翻转断言 (covers: zone-config/归一化与坏数据容错, diff-focus/21 门键集一致, design/D2, design/D6)

## 2. 词典与 diff 默认值

- [ ] 21 门词典批量新增约 20 个 `layout.*` 键（ZH 107 / EN 537 / 19 门 LOCALES），`npm test` 验证逐门键集一致 (covers: diff-focus/21 门键集一致, design/D7)
- [ ] `readLineDiffPrefs`(11379–11388) 默认值改 `{split:true, wrap:false}`，保留签名/键/形状/useState 播种/useEffect，并新增断言钉住默认值 (covers: diff-focus/首次打开即为并排 diff, diff-focus/老用户偏好不被新默认值覆盖, design/D5)

## 3. 新组件

- [ ] 从 `ChangesPanel`(14090–14160) 抽出共享 `CommitBox`，新增可选 `showComposer` prop（默认 true），提交逻辑与 `confirm:true` 不动 (covers: zone-config/提交框换落点, design/D6)
- [ ] 新增 `DirTree`：复用 `buildDirForest`/`dirName`/`remoteTreeStripOf`/`TREE_KEY`，点文件走 `onDiff`/`onSelectionChange`、点目录走 `groupBy`/`setGroupBy`，不承诺过滤 (covers: ugit-layout/参考截图的既有能力复用, design/D4)
- [ ] 新增 `UgitTopbar`（仓库/分支/Tab/ahead-behind chip/动作/齿轮/窗口控制，**不承载时间范围下拉**，溢出进「⋯ 更多」）与 `UgitIconRail` (covers: ugit-layout/顶栏承载仓库/分支/Tab/动作/窗口控制，不承载时间范围筛选, ugit-layout/顶栏时间筛选生效, design/D3)
- [ ] 新增 `UgitBody`（按 `LAYOUT_KEY` map 列 + Gutter，复用 `fillDiff` 不调 `paneStyle('diff')`，保留兼容类名）与 `UgitLayoutSettings` (covers: ugit-layout/打开面板看到 ugit 三列, ugit-layout/窄容器自动降级但不丢偏好, diff-focus/diff 不被 paneStyle 压半高, design/D1)
- [ ] 新增 `UgitLayoutSettings` 的逐区双向开关、上移/下移、默认 Tab、commitBoxPlace 下拉、恢复默认布局（装配进齿轮 `RailSettings`） (covers: zone-config/隐藏后刷新仍隐藏，再打开后刷新仍显示, zone-config/全部隐藏时不留 0 宽容器, zone-config/恢复默认布局一次性打开全部默认区, zone-config/上移下移改变列次序并跨刷新保持, design/D6)

## 4. 接线

- [ ] 替换 `topBar`(17282–17307) 为 `UgitTopbar`；**不做**时间范围下拉、不改 `HistoryList` props/`rows`，历史筛选（单一 `since` 下拉 + 文本/哈希/分支/作者/路径过滤）仍留在历史 Tab 的 `HistoryList.filterBar`(14814) (covers: ugit-layout/顶栏时间筛选生效, design/D3)
- [ ] 删 17999–18055 三套 body 分支，改为单个 `UgitBody`；`view`/`splitTab` 收敛但不删（保滚动位置）；`renderRail` 动作收进顶栏/iconRail (covers: ugit-layout/打开面板看到 ugit 三列, ugit-layout/切到历史 Tab 查看提交图谱, ugit-layout/在变更 Tab 显式打开分支树, design/D1, design/D3)
- [ ] `activeTab` 写入 `LAYOUT_KEY.activeTab` 并刷新恢复；冲突消解落地（显隐优先于 Tab 候选、Tab 级 order 优先顶层、hidden 优先 treeOpen） (covers: zone-config/隐藏后刷新仍隐藏，再打开后刷新仍显示, design/D2, design/D3)
- [ ] tree/changes 列宽继续经 `Gutter` + `PANES_KEY` 记忆为 ratio，一次手势一次落盘；附加列宽走 `extraRatios` (covers: zone-config/拖拽列宽跨刷新保持, design/D2)

## 5. CSS

- [ ] `CSS`(18498–19208) 新增 ugit 单行顶栏、三列主体、`.dig-pane-main{flex:1}` 大 diff、提交框两处落点；保留 11 个 border-l2 选择器与全部兼容类名 (covers: ugit-layout/打开面板看到 ugit 三列, diff-focus/兼容类名与既有验证契约不回归, design/D1, design/D7)

## 6. 设置面

- [ ] 齿轮 `RailSettings`(12653) 装配布局开关（`layoutToggle`/`layoutSelect`，不用 `textRow`/`selectRow`/`const field`）；插件页 `RailSettingsCard`(12075) 只加只读说明 + 「打开布局设置」入口按钮，不加 checkbox (covers: zone-config/隐藏后刷新仍隐藏，再打开后刷新仍显示, diff-focus/兼容类名与既有验证契约不回归, design/D6)

## 7. 测试与探针

- [ ] 按 D1 完整清单诚实更新 `tests/smoke.mjs` 文本断言（918–940 / 2351–2372 / 1704–1708 / 1849–1860 等），不留死字符串 (covers: diff-focus/兼容类名与既有验证契约不回归, design/D1)
- [ ] `scripts/screenshots.mjs` 第 2/3/5 张改「先切 Tab」路径、第 126 行注释改 ugit 三列；`settings-card-probe.mjs` 零改动 (covers: ugit-layout/参考截图的既有能力复用, design/D3, design/D6, design/D7)
- [ ] 按顺序跑 `npm test` → ssr-check → layout-probe → panes-probe → dock-probe → selection-probe → settings-card-probe → conversation-probe → screenshots；隔离 `DSH_HOME`+3099，绝不碰 3080、不替用户重启 (covers: diff-focus/SSR 自检与布局探针通过, diff-focus/全套验证通过, design/D7)

## 8. 收尾

- [ ] `CHANGELOG.md` 补 `## Unreleased`；`AGENTS.md` 不变量 7 改写为 ugit 分区模型；两份 README 效果段文字改 ugit 形态 (covers: diff-focus/词典与文档同步, design/D7)
- [ ] 重拍 `docs/screenshots/` 6 张为 ugit 形态（图名/数量/`screenshots.json` 不变） (covers: ugit-layout/打开面板看到 ugit 三列, diff-focus/词典与文档同步, design/D7)
- [ ] 记录 `record_change` 并推进交付任务到 implemented / verified / accepted (covers: diff-focus/全套验证通过, design/D1, design/D2, design/D3, design/D4, design/D5, design/D6, design/D7)

## 9. 进度索引（与阶段清单镜像，非独立任务）

- [x] 补齐 OpenSpec 变更（proposal/design/tasks/spec）并推进到 specified (covers: req/1, req/2, req/3, req/4, req/5, req/6, req/7, req/8, design/D1, design/D2, design/D3, design/D4, design/D5, design/D6, design/D7)
- [ ] 阶段1 配置层 = §1 (covers: req/5, req/6, req/7, design/D2)
- [ ] 阶段2 词典 = §2 (covers: req/2, req/4, design/D5, design/D7)
- [ ] 阶段3 新组件 = §3 (covers: req/2, req/3, req/4, design/D3, design/D4, design/D6)
- [ ] 阶段4 接线 = §4（**不含 time 筛选落顶栏**，见 §4 第 1 条与 D3 能力缺口） (covers: req/1, req/2, req/3, req/4, design/D1, design/D3)
- [ ] 阶段5 CSS = §5 (covers: req/2, req/4, design/D1, design/D7)
- [ ] 阶段6 设置面 = §6 (covers: req/5, req/6, req/7, design/D6)
- [ ] 阶段7 测试探针 = §7 (covers: req/1, req/2, req/3, req/4, req/5, req/6, req/7, req/8, design/D1, design/D7)
- [ ] 阶段8 收尾 = §8 (covers: req/4, req/8, design/D7)
