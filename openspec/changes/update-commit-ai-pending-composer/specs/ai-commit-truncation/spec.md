## ADDED Requirements

### Requirement: 输入预算放宽且如实报告

`COMMIT_TOTAL_BYTES` / `COMMIT_FILE_BYTES` / `COMMIT_FILE_LINES` / `COMMIT_MAX_FILES` SHALL 上调到设计值；`commitInputOf(staged, unstaged, upstreamTruncated)` MUST 接收 `diff()` 已返回的 `truncated`（`read.js` 零改动）；超出总预算的文件 MUST NOT 整文件消失，SHALL 保留 `diff --git` 头与若干行摘要并计入 `omittedFiles`。lock / 二进制文件仍整体跳过。

#### Scenario: 上游 diff 截断被透传

- WHEN `diff()` 返回 `truncated: true`
- THEN `commitMessage` 响应的 `input.upstreamTruncated` 为 true，客户端给出对应提示

#### Scenario: 超预算文件保留头部摘要

- WHEN 变更文件数或体积超出总预算
- THEN 该文件的 diff header 与前若干行仍出现在发给模型的内容里，`omittedFiles` 列出其路径

### Requirement: 输出收集兼容 block-end 并标注半截

`collectCommitStream()` MUST 兼容 `block-end` 的 `TextBlock`（同一 index 已有 `text-delta` 时不得重复累加）；`finish.kind === 'max-tokens'` 且已有文本时 SHALL 返回 `partial: true`，MUST NOT 当成功或硬错误；`commitMessage` 响应 SHALL 带 `partial` / `finishKind`，客户端据此区分完整 / 半截 / 失败三态。

#### Scenario: 只有 block-end 也能拿到文本

- WHEN 模型流只发 `block-end` 而不发 `text-delta`
- THEN 收集到的文本等于该 TextBlock 的文本，提交信息不为空

#### Scenario: max-tokens 半截被明确标注

- WHEN 流以 `max-tokens` 结束且已产出部分文本
- THEN 返回 `partial:true`，客户端提示「本次是半截结果」，不显示为完整成功

#### Scenario: 错误与中止仍是失败

- WHEN finish 为 `error` / `aborted` / 无 finish
- THEN 沿用既有失败码与提示，不被 partial 逻辑吞掉
