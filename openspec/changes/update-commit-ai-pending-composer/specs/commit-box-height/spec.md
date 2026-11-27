## ADDED Requirements

### Requirement: 默认高度翻倍且可拉伸

非 compact 的 `.dig-textarea` SHALL 由 `min-height:50px` 改为 `height:100px`，同时保留 `min-height:50px` 下限、新增 `max-height:40vh` 上限、`resize:vertical` MUST 保留以支持拉高/拉低。compact 布局的 `<input class="dig-input dig-input-compact">` MUST 维持单行。

#### Scenario: 默认高度约翻倍

- WHEN 打开默认 ugit 布局的提交框
- THEN textarea 初始高度约 100px，且冒烟测试钉住 `height:100px`

#### Scenario: 可拖拽拉高拉低

- WHEN 用户拖拽 textarea 右下角把手
- THEN 高度在 `min-height:50px` 与 `max-height:40vh` 之间变化，变更列表不被挤没
