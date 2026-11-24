## ADDED Requirements

### Requirement: 默认变更视图为 ugit 三列

面板默认 MUST 渲染单行顶栏 + 最左竖排图标 rail + 三列主体：目录树（窄、可隐藏）、变更文件列表（列底内嵌提交框）、大号并排 split diff。diff 列 MUST 用 `flex:1` 占满剩余宽度，面积大于变更列与目录树列，成为视觉主角。旧「分支树｜提交图谱｜变更列表」三栏 MUST 不再渲染，也不提供切换回旧布局的开关。

#### Scenario: 打开面板看到 ugit 三列

- **WHEN** 用户在已绑定仓库的会话中打开 Git 面板且 `LAYOUT_KEY` 为空（首次使用）
- **THEN** 面板 MUST 渲染 `工作区|变更|历史` Tab（默认选中「变更」）、目录树列、变更列、大号 diff 列
- **AND** diff 列宽度 MUST 大于变更列宽度
- **AND** 页面 MUST 不出现「分支或标签」「文本或哈希」两条大搜索框或常驻分支树/提交图谱

#### Scenario: 窄容器自动降级但不丢偏好

- **WHEN** 面板容器宽度小于 400px（原生右栏）
- **THEN** 面板 MUST 优先保留变更列与 diff 列，目录树自动收起
- **AND** `LAYOUT_KEY` 里的目录树显隐偏好 MUST 不被修改
- **AND** 容器 MUST 继续带 `dig-body-stack`/`dig-body-compact` 兼容类名，零 pageerror

### Requirement: 次要信息降级为 Tab 独立视图并可唤出

分支树/标签与提交图谱 MUST NOT 出现在默认「变更」Tab 的主视野。它们 MUST 通过顶部 Tab（工作区 / 变更 / 历史）或设置里的显隐开关唤出。顶部工具条 MUST 只保留仓库下拉、当前分支下拉、ahead/behind chip、Tab、动作图标、齿轮与窗口控制；MUST NOT 承载历史时间范围筛选（见「顶栏不承载时间范围筛选」）。

#### Scenario: 切到历史 Tab 查看提交图谱

- **WHEN** 用户点击顶部「历史」Tab
- **THEN** 面板 MUST 渲染提交图谱列表（`HistoryList`）与选中提交的文件差异/详情
- **AND** 分支树 MUST 仍不在主视野，除非用户显式打开

#### Scenario: 在变更 Tab 显式打开分支树

- **WHEN** 用户在齿轮布局设置里勾选「分支/标签」区
- **THEN** 分支树 MUST 作为附加列追加到当前 Tab 的列集合尾部
- **AND** 切换 Tab 后该「打开」状态 MUST 不被撤销（显隐优先于 Tab 候选列集合）

## ADDED Requirements

### Requirement: 顶栏承载仓库/分支/Tab/动作/窗口控制，不承载时间范围筛选

`UgitTopbar` MUST 取代旧双搜索框顶栏，包含：仓库下拉、当前分支下拉、upstream ahead/behind chip、工作区/变更/历史 Tab、检查更新/更新/推送动作图标、设置齿轮、窗口控制。溢出时 MUST 收进「⋯ 更多」而非横向溢出。顶栏 MUST NOT 出现参考截图里 `2月前 ▾` / `4天前 ▾` 两个时间下拉；历史筛选 MUST 保持仓库现状 —— `HistoryList.filterBar`(14814) 的单一 `since` 下拉（选项 `today/week/month/year`，`sinceThreshold` 14518）与文本/哈希/分支/作者/路径过滤，全部留在「历史」Tab 的过滤条，MUST NOT 搬到顶栏。

> 能力缺口（设计文档 D3 已显式列出）：`HistoryList`(14532) 只有一个 `since` 内部 state(14571) 与一个日期下拉(14847)，**无 `until`、无第二个时间下拉、无 `props.since`/`props.until` 入参**（`grep -n "props\.(since|until)" src/client.js` 零命中）。截图那两个下拉是 ugit 对最近两次提交时间的展示性标签，不是可复用过滤控件。实现它们需给 `HistoryList` 新增 props、改 `rows` 派生(14617)、给宿主 `log` 方法表加参数，超出视觉重构范围且会碰 `tests/api.test.mjs` 的 log 断言，故本次不做。

#### Scenario: 顶栏时间筛选生效

- **WHEN** 用户打开面板并查看顶栏
- **THEN** 顶栏 MUST NOT 渲染任何时间范围下拉（`2月前`/`4天前` 或等价 `until` 控件）
- **AND** 历史 Tab 的过滤条 MUST 仍渲染既有的单一 `since` 日期下拉（`today/week/month/year`）与文本/哈希/分支/作者/路径过滤
- **AND** `HistoryList` 的 props 契约与 `rows` 派生 MUST NOT 被改动（不新增 `until` 能力、不新增假控件）

#### Scenario: 参考截图的既有能力复用

- **WHEN** 渲染变更列头与 diff 主体
- **THEN** 「三列表/树形」MUST 复用既有 `groupBy`，「Default ▾」MUST 复用既有 `sortKey`，状态图标 MUST 复用 `dig-file-status-*`，split diff 左右同步滚动 MUST 复用 `SplitColumns`
- **AND** 上述四项 MUST NOT 引入新状态或新文案键
- **AND** 「储藏变更」「待提交(N)」「文件视图/查看修改」「UTF-8/LF」「平台装饰」「顶栏两个时间下拉」MUST NOT 被复刻
