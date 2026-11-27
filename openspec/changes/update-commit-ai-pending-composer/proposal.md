# 修复提交并推送忽略路径、AI 提交信息、待提交区多选、提交框高度

## Why

用户用截图反馈「提交并推送」整条失败：待提交区里混进了被 `.gitignore` 忽略的路径（`scripts/yapi_scene_export/portal/services`），宿主 `commit()` 无条件 `git add -A -- <所有 paths>`，一条忽略路径令整批 add 失败，提交/推送根本没发生。同一轮还反馈了三个长期存在的体验缺口：AI 写提交信息输出英文且输入 diff / 输出文本都被截断；待提交区不能多选批量移出、栏右没有「全部移出」；提交信息输入框默认太矮。

## What

1. 宿主 `commit()` 改为「先整批 `git add -A`；仅当失败时用一次只读 `git ls-files -z`（全量已跟踪，含本次无变更文件）∪ `git diff --cached -z --name-only`（本次新暂存）求 `paths ∩ 可提交集合`，把没进 index 的忽略路径剔除，再用交集做 pathspec commit」；被跳过的路径返回给客户端，待提交区不清空并提示（用户选择「自动跳过」，不强制 `-f`）。**关键实测**：整批 `add -A` 失败其实是「部分成功」——正常路径（含忽略目录下已跟踪子文件）已全部进 index，故无需逐条重试或 `-u` 救回；且必须用 `ls-files` 覆盖「已跟踪但本次无变更」的文件，否则截图量级(45 路径)下会把几十个 `.json` 误报成被忽略。**不用 `check-ignore` 判定**——八轮实测证明其口径与 `git add` 不一致（截图场景会漏判）、`runGit` 无 stdin 通路、`-z` 不能配 argv、`--no-index` 会误伤已跟踪子文件；也不解析 stderr 文案（中英文 locale 不同），方案本地化无关。
2. `commit-message` 宿主：system 指令按界面语言（客户端传 locale）要求对应语言作答；输入侧抬高并更公平地分配 diff 预算、透传 `diff()` 的上游截断、对超预算文件保留头部摘要；输出侧 `collectCommitStream` 兼容 `block-end` 完整文本块、`max-tokens` 半截文本标 `partial`，`cleanupCommitMessage` 收尾，响应带 `partial`/`finishKind`，客户端诚实提示。
3. 客户端「待提交」行接入同一套 `changeSelection`（点击/Shift/Ctrl/框选/选中高亮/清理 effect），右键给「移出 N 个」、键盘 Delete 对纯待提交选中改为移出、分组头最右新增「全部移出」按钮。
4. 非 compact 的 `.dig-textarea` 默认高度 50px→100px，保留 `resize:vertical`、补 min/max 高度；compact 单行 input 不变。

## Out of scope

注册/布局 chrome/写队列/撤回/gitignore 语义/ `-f` 强制提交/第二个 client entry/新第三方依赖/compact 布局改多行。

## Success

四项各有可判定验收；21 门词典键集一致；`node --check`、smoke、api、SSR 全绿；CHANGELOG 记录。