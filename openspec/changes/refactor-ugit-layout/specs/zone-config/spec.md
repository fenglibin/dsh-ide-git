## ADDED Requirements

### Requirement: 功能区显隐双向可配置且自动记忆

插件 MUST 提供逐功能区的双向显隐开关（勾选=显示、取消=隐藏），覆盖列分区 `dirTree/changes/diff/branches/history` 与附属分区 `toolbar/iconRail/commitBox`。显隐 MUST 写入浏览器 `localStorage` 的 `LAYOUT_KEY`，刷新后 MUST 自动恢复。MUST 另提供「恢复默认布局」把全部区复位到规格默认可见集（一次性打开全部默认区）。

#### Scenario: 隐藏后刷新仍隐藏，再打开后刷新仍显示

- **WHEN** 用户在齿轮里取消勾选「目录树」并刷新页面
- **THEN** 目录树列 MUST 不渲染，且 `LAYOUT_KEY.hidden` MUST 含 `dirTree`
- **WHEN** 用户重新勾选「目录树」并刷新
- **THEN** 目录树列 MUST 恢复渲染，`hidden` 中 MUST 不再含 `dirTree`

#### Scenario: 全部隐藏时不留 0 宽容器

- **WHEN** 所有列分区都被隐藏
- **THEN** `UgitBody` MUST 渲染「未启用任何功能区」空态 + 「打开布局设置」按钮
- **AND** 面板 MUST NOT 抛错或白屏

#### Scenario: 恢复默认布局一次性打开全部默认区

- **WHEN** 用户点击「恢复默认布局」
- **THEN** `hidden/order/affixes/activeTab` MUST 复位到 `UGIT_*` 规格默认值
- **AND** 目录树、变更列、diff 列 MUST 全部重新可见

### Requirement: 顺序与位置可调且自动记忆

列分区的左右次序 MUST 可通过上移/下移调整并记忆到 `LAYOUT_KEY`。提交框落点 MUST 支持 `changesBottom`（变更列底部）与 `panelBottom`（面板底部）两个取值并记忆。附加列宽 MUST 可拖拽并记忆到 `LAYOUT_KEY.extraRatios`；tree/changes 列宽 MUST 继续经 `Gutter` + `PANES_KEY` 记忆为 ratio。

#### Scenario: 上移下移改变列次序并跨刷新保持

- **WHEN** 用户把 `diff` 列上移到 `changes` 之前并刷新
- **THEN** 列渲染次序 MUST 与调整后一致，`LAYOUT_KEY.tabs[activeTab].order` MUST 记录该次序

#### Scenario: 拖拽列宽跨刷新保持

- **WHEN** 用户拖动 changes 列的 gutter 改变宽度并刷新
- **THEN** 宽度 MUST 按 `PANES_KEY` 的 `columns:wide|tall` 桶中 ratio 恢复
- **AND** 一次手势 MUST 只写一次 localStorage

#### Scenario: 提交框换落点

- **WHEN** 用户把 `commitBoxPlace` 设为 `panelBottom`
- **THEN** `ChangesPanel` MUST 不渲染内部 `composer`（`showComposer===false`）
- **AND** `UgitBody` MUST 用共享 `CommitBox` 在面板底部渲染同一个提交入口
- **AND** 提交/提交并推送/AI 写信息/amend 行为 MUST 与改动前一致，`confirm: true` MUST 不被绕过

### Requirement: 归一化与坏数据容错

`normalizeLayout` MUST 丢弃未知/重复 id、按 `UGIT_ZONE_SPECS` 补齐缺失 id、非法 `activeTab` 回退 `'changes'`、`affixes` 逐项布尔化、`commitBoxPlace` 非法回退 `'changesBottom'`、`extraRatios` 夹到规格 min/max。所有 localStorage 读写 MUST `try/catch` 静默降级。写路径 MUST NOT 回退到退役键 `RAIL_KEY`。新配置 MUST NOT 写宿主行 Config / profile / `config.js`。

**可选性（null 与缺省的区别）**：`hidden` 字段缺省 / 为 `null` / 非数组 / 空数组 MUST 返回空隐藏集（用户没有显式关闭任何区）；恰好等于 `['branches','history']` 的旧版文档 MUST 迁移为 `[]`；其它非空数组 MUST 丢弃未知/重复 id 后作为当前显式隐藏集。区在某 Tab 是否渲染 MUST 由该 Tab 的候选列集合决定：`changes` = 目录树/变更/diff、`workspace` 额外含分支树、`history` = 提交图谱/详情（diff 不占空列）；`hidden` MUST NOT 再承担「默认可见性」职责，否则切到历史 Tab 时提交图谱会被永久挡住（真机复现并修复）。`affixes` 缺省或 `null` MUST 逐项补 `UGIT_AFFIX_SPECS.visible` 默认值，`affixes[id] = null` MUST 布尔化回退 `true`。`extraRatios` 缺省 / `null` / 字符串 / `NaN` / `Infinity` / `<= 0` / `> 1` MUST 回退到 `UGIT_ZONE_SPECS[].ratio`。序列化 MUST 恒为 `JSON.stringify(normalizeLayout(config))`，读取 MUST 恒为 `JSON.parse` 后再过 `normalizeLayout`，保证生产者与消费者对字段名、枚举取值、可选性的理解一致。

#### Scenario: 坏数据不白屏

- **WHEN** `LAYOUT_KEY` 内容是不可解析的 JSON 或含未知分区 id
- **THEN** 面板 MUST 按规格默认值正常渲染
- **AND** MUST NOT 抛异常、MUST NOT 出现 `cannot read property` 类错误

#### Scenario: 新增分区不被旧文档隐藏

- **WHEN** 代码新增一个列分区而用户 `LAYOUT_KEY` 是旧版文档
- **THEN** 新分区 MUST 按其规格默认可见性渲染，MUST NOT 被旧 `hidden`/`order` 静默隐藏