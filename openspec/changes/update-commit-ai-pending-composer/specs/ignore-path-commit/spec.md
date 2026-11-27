## ADDED Requirements

### Requirement: 整批 add 失败时按实际暂存集合求交集

`commit()` SHALL 在 `paths.length > 0` 时先执行一次整批 `git add -A -- <paths>`；`code===0` 时 MUST 沿用现有 pathspec 行为、不额外调用。仅当非零时 MUST 执行一次只读 `git ls-files -z` ∪ `git diff --cached -z --name-only` 求「可提交集合」，并求 `ok = paths ∩ 可提交集合`、`ignoredPaths = paths \ staged`。实现 MUST NOT 逐条重试 `git add -A`（实测整批失败是「部分成功」，逐条会把已暂存的 tracked child 误判为跳过），也 MUST NOT 用 `check-ignore` / `ls-files --error-unmatch` / 解析 stderr 文案来判定。

#### Scenario: 正常仓库保持一次调用

- WHEN 待提交区所有路径都未被 `.gitignore` 忽略
- THEN 宿主只执行一次 `git add -A -- <paths>`，提交结果与改动前一致

#### Scenario: 整批失败才求交集

- WHEN pathspec 含一个被忽略的裸目录与若干正常路径
- THEN 整批 add 返回非零但正常路径已暂存，宿主用 `diff --cached` 求交集，正常路径（含忽略目录下已跟踪子文件）进入可提交集合、被忽略路径不进入

### Requirement: 已跟踪修改自然进提交

整批 `add -A` 已把「忽略目录下的已跟踪子文件修改」暂存进 index，`ok = paths ∩ staged` SHALL 自然包含它，MUST NOT 额外执行 `git add -u`（实测多余）。`-u` MUST NOT 整体替换 `-A`（未跟踪新文件会 exit 128）。

#### Scenario: 忽略目录下的已跟踪文件修改仍进提交

- WHEN 被忽略目录下存在已跟踪的 `.json` 文件且有未暂存修改
- THEN 整批 `add -A` 已暂存它，`paths∩staged` 包含该路径，其修改进入本次提交

#### Scenario: 未跟踪新增文件仍可提交

- WHEN 待提交区含一个未被忽略的未跟踪新文件
- THEN 逐条 `add -A` 成功，该文件进入可提交集合

### Requirement: 跳过结果如实返回且不误推

可提交集合为空时 `commit()` MUST NOT 执行 `commit` 或 `push`，SHALL 返回 `skipped: true`、`ignoredPaths`、`pushed: false`；非空时 SHALL 用可提交集合作为 `commit -- <pathspec>` 的 pathspec，并把 `ignoredPaths` 一并返回。客户端 `run()` 在 `skipped===true` 时 MUST NOT 清空待提交区，SHALL 提示被跳过路径保留在待提交区。

#### Scenario: 全部被忽略时不提交不推送

- WHEN 待提交区全部路径都被 `.gitignore` 忽略
- THEN 返回 `skipped:true` / `pushed:false`，不产生提交，待提交区仍保留这些路径

#### Scenario: 部分跳过时其余正常提交

- WHEN 待提交区混有忽略目录与正常文件
- THEN 正常文件被提交、忽略路径列在 `ignoredPaths`，前端提示「有 N 个路径被跳过」

### Requirement: 不使用 check-ignore / 不解析 stderr / 不按扩展名区分

实现 MUST NOT 用 `git check-ignore`（含 `--stdin` / `-z` / `--no-index`）作为过滤依据，MUST NOT 用 `ls-files --error-unmatch` 判定裸目录，MUST NOT 解析 `git add` 的 stderr 文案（中英文 locale 不同），MUST NOT 按文件扩展名区分。判定 SHALL 只依据 `diff --cached -z --name-only` 的结构化输出。

#### Scenario: 截图场景可修复

- WHEN 忽略目录下已有已跟踪子文件、pathspec 同时含该裸目录与几十个子文件
- THEN 提交不再整条失败（check-ignore 在此场景默认不报该目录，不能作为依据）

#### Scenario: 本地化与扩展名无关

#### Scenario: 截图量级只点名一个被忽略的裸目录

- **WHEN** 待提交区含约 45 个 pathspec（含一个被 `.gitignore` 忽略的裸目录、该目录下几十个已跟踪但本次无变更的 `.json`、以及 `.html/.md/.py/.sh` 等正常路径）
- **THEN** `ignoredPaths` MUST 精确等于那一个裸目录，MUST NOT 把「已跟踪但本次无变更」的文件误报为被忽略
- **AND** 有变更的正常路径 MUST 正常提交，裸目录 MUST NOT 作为 pathspec 进入提交

- WHEN 报错文案为中文「下列路径根据您的一个 .gitignore 文件而被忽略」或英文 `The following paths are ignored...`，且 pathspec 混有 `.json/.py/.sh/.md/.html`
- THEN 方案不解析文案、不按扩展名区分，交集结果一致
