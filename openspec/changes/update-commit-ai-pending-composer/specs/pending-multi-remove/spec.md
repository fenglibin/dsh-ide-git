## ADDED Requirements

### Requirement: 待提交行复用同一选择源

待提交行 SHALL 用 `changeSelection` 的 `pending:<path>` 键参与选中、Shift/Ctrl/框选与 `dig-row-selected` 高亮；`orderedRowKeys()` MUST 停止排除 `pending:` 键；`rectsOf()` 保持只排除 `ignored:`；选中清理 effect MUST 保留仍在 `pendingPaths` 中的 `pending:` 键；`changeSelectionGroups()` SHALL 新增 `pending: []` 且不把它算进 staged/other/tracked/untracked。`changeItems` 的 `useMemo` MUST 补齐新增 props 依赖。

#### Scenario: Shift 范围跨待提交行

- WHEN 用户在普通行与待提交行之间 Shift 点击
- THEN 两端都进入同一选择集，右键出现整组动作

#### Scenario: 刷新后选中不丢

- WHEN 选中若干待提交行后发生 refresh
- THEN 仍存在于待提交区的行保持选中

### Requirement: 批量移出与栏右全部移出

右键菜单对 `group === 'pending'` SHALL 提供「移出 N 个」并调 `onPendingRemoveMany(paths)`；`onChangesKeyDown` 的 Delete 在选中全为 `pending:` 键时 MUST 改为移出而非弹出丢弃确认；待提交分组头最右 SHALL 有「全部移出」`.dig-link`，一次性清空该仓库待提交集合并写回 `PENDING_KEY`。单行「移出」`dig-mini` 与双击 diff 保持不变。

#### Scenario: 多选后右键整组移出

- WHEN 选中 3 个待提交文件并右键
- THEN 菜单显示「移出 3 个」，点击后 3 个路径一起从待提交区消失

#### Scenario: 栏右按钮清空全部

- WHEN 点击待提交分组头最右「全部移出」
- THEN 该仓库待提交集合清空、`PENDING_KEY` 同步写回空数组

#### Scenario: Delete 不误删文件

- WHEN 选中集全是 `pending:` 键并按 Delete
- THEN 只移出待提交标记，不弹丢弃确认、不改动工作区文件
