# 2026-11-27 四项问题修复设计（审查修订版）

用户通过两张截图反馈四点。完整截图确认错误为：

```
git add -A -- .gitignore scripts/yapi_scene_export/README.md … <约 40 个路径> … failed:
The following paths are ignored by one of your .gitignore files:
scripts/yapi_scene_export/portal/services
hint: Use -f if you really want to add them.
```

即待提交区里混入了被 `.gitignore` 忽略的**目录路径** `scripts/yapi_scene_export/portal/services`，`git add -A -- <显式路径>` 遇到它整条失败（exit 1），提交与推送根本没发生。本文件是**完整方案草稿**；`.dsh/design/<task-id>.md` 是指向本文的摘要，`openspec/changes/update-commit-ai-pending-composer/design.md` 是同一方案的**自足版**（每个决策独立可判断）。三处冲突以本文为准。

## §0 需求基线、对齐结论、歧义与边界

### §0.1 原始需求（objective 的四条编号项）

| 编号 | 内容 |
|---|---|
| req/1 | 点击「提交并推送」会报截图所示错误 |
| req/2 | 「AI 写提交信息」总结结果为英文、期望中文；另外提交输出内容被截断，检查一下提交给 AI 的信息以及获取输出这里可以做什么样的优化 |
| req/3 | 添加到「待提交」区的文件列表，现在不能够执行文件多选然后执行将选中文件移出待提交；同时在「待提交」所在栏在最右边需要增加一个将全部待提交区的文件全部移出待提交区的功能 |
| req/4 | 提交信息输入框的高度有点低，默认高度可以增加一倍，并且信息输入框要支持拉高或拉低 |

### §0.2 对齐结论（分析阶段 + 用户澄清）

| 编号 | 结论 | 来源 |
|---|---|---|
| a/1 | 被 `.gitignore` 忽略的路径选择「**自动跳过忽略文件**」，不强制 `-f`、不弹窗 | 用户三选一回答 |
| a/2 | AI 语言选择「**跟随界面语言**」，中文界面中文、其它语言各自对应 | 用户三选一回答 |
| a/3 | 截断选择「**输入与输出两处都优化**」 | 用户三选一回答 |
| a/4 | 被跳过（忽略）的文件**保留在待提交区**并明确提示 | 由 a/1 推导：若静默清除，用户标记的路径会凭空消失 |
| a/5 | 自定义 prompt 仍是「style only」的附加要求，优先级不变 | 既有行为（不变量：`commitMessagesOf` 的注释明确「cannot replace the rules above」） |
| a/6 | 同步 CHANGELOG、21 门词典键集一致、冒烟/API/SSR 验证 | objective 与 AGENTS.md「变更记录纪律」「不变量 10」 |
| a/7 | 「自动跳过」的语义边界：被 `.gitignore` 忽略、**没进 index** 的路径不进本次提交，但**仍保留在待提交区**（用户标记不丢失）；忽略目录下**已跟踪文件的修改**因整批 `add -A` 已把它暂存，照常进提交 | 由 a/1 + 实测推导：整批 `git add -A` 失败时是「部分成功」——正常路径（含忽略目录下已跟踪子文件）已全部进 index，只有没进 index 的忽略路径需要剔除 |

### §0.3 采用的解释 / 被排除的解释（需求歧义，不静默按自己理解实现）

1. **req/2「期望为中文」到底是固定中文还是跟随界面**：采用「跟随界面语言」（a/2）。被排除的是「无论界面语言一律中文」——用户已明确选择前者，且插件 21 门词典本身就是语言跟随的既有约定（不变量 10）。
2. **req/2「提交输出内容被截断」指哪一处**：采用「两处都优化」（a/3）。三层截断都处理：`read.js` 的 `MAX_DIFF_CHARS`、`commitInputOf` 的硬预算、`collectCommitStream` 的流式收集。被排除的是「只改输入」或「只改输出」——用户已明确两者都要。
3. **req/3「文件多选然后执行将选中文件移出待提交」用什么交互**：采用「复用现有 `changeSelection`（Ctrl/Shift/框选/右键）+ 右键『移出 N 个』+ Delete 对纯待提交选中改为移出」。被排除的是「另建一套待提交专用选择状态」——两套选择语义会让普通行与待提交行的 Shift 范围互相错位（现有 `orderedRowKeys` 注释已点明这个风险）。
4. **req/3「栏最右边」**：采用「待提交分组头 `dig-group-head-pending` 内、`.dig-link` 的 `margin-left:auto` 顶到最右」，与既有「已暂存/更改」分组头右侧的「全部取消暂存 / 全部暂存」按钮同一范式（`client.js:15074-15075`）。被排除的是「放在面板顶栏」——用户明确说是「待提交所在栏」。
5. **req/4「默认高度增加一倍」的基准**：采用非 compact 的 `.dig-textarea` 现 `min-height:50px` → `height:100px`（内容区翻倍）。被排除的是「把 compact 的 `<input>` 也翻倍/改多行」——compact 是窄右栏的一行式布局，改多行会破坏既有 chrome（不变量 7）。
6. **req/4「支持拉高或拉低」**：采用保留并明确 `resize:vertical` + `min-height:50px` 下限 + `max-height:40vh` 上限。被排除的是「用 JS 拖拽把手」——浏览器原生 `resize` 已能拉高/拉低，无需新增代码；现有 CSS 其实已有 `resize:vertical`，本次是**明确并钉住**它、补上下限，而不是从零实现。

### §0.4 本次明确不做（逐条理由）

1. 不强制 `-f` 提交忽略文件（a/1；强制会把用户刻意忽略的生成物写进历史）。
2. 不弹「跳过还是强制」确认框（a/1；用户已选自动跳过）。
3. 不改 `.gitignore` 语义、不改 `gitignoreAdd` 方法（与 req/1 无关）。
4. 不改注册/布局 chrome/写队列/撤回机制/`WRITE_METHODS`/`http.js` 方法表/信任围栏（既有不变式，见 AGENTS.md 不变量 3/4/5/6/15/16）。
5. compact 布局的 `<input class="dig-input dig-input-compact">` 维持单行（§0.3.5）。
6. 不引入第二个 client entry、不新增第三方静态 import、不新增 npm 依赖（不变量 1/2）。
7. 不改 `stage`/`unstage` 的忽略路径处理（见 §0.7 遗留风险 R1；本次只让 `commit` 不再整条失败）。
8. 不把 lock 文件 / 二进制送进模型（既有 `COMMIT_BINARY` / lock 正则语义保留）。
9. 不新增 `maxTokens`（issue #7 的既有结论：写死输出上限会与 reasoning 抢预算，见 `commit-message.js:313-318`）。
10. 不改动 AI 路由逻辑（`commitRouteOf` / `quietOffEffortOf` / 失败码）（与 req/2 无关）。
11. 不重拍 README 效果图、不改 AGENTS.md 不变量条目（本轮无截图/布局契约变化）。
12. 不做真机探针（隔离实例）如受环境限制——如实标注，不假装已验证。

### §0.5 容易被误认为在范围内、实际显式排除的事

1. 「提交所有」对话框（`setDialog({kind:'commitMsg', all:true})`，`client.js:18258-18263`）也传 `paths`——本次 D1 的过滤在宿主 `commit()` 生效，对它同样有效，但**不单独改对话框 UI**。
2. `stage` 动作用户右键忽略文件时也会 `git add -A` 失败——**本次不修**（§0.4.7），因为 req/1 只报「提交并推送」。
3. 待提交行的**双击打开 diff** 现状（`onClick` 里 `props.onDiff(..., 'pending')`）保持不变；本次只把单击改成选择（§0.3.3），双击仍走 `onDblClick` → `props.onDiff`。
4. 不新增「全部添加待提交」的对仗按钮位置变更（`moreMenu` 的 `pend-all` 保持）。
5. 不改 `PENDING_KEY='dsh-ide-git.pending.v1'` 的 schema（只增删集合内容，不迁移）。
6. 不改 `pushToast` 的 TTL / 动作机制，只复用它。
7. 不给「忽略路径判定」做持久化缓存（每次提交现算，仓库状态可能刚变）。
8. 不用 `git check-ignore` 作为过滤依据（实测口径与 `git add` 不一致，见 A-1/A-2）。

### §0.6 必备的仓库现状确证（附录 A 给出命令）

设计里出现的每个符号都已逐个在仓库中确认存在（见附录 A）。**八轮实测逐层纠正了 D1 方案**（这是本轮审查最重要的修正，最终形态见 A-4）：

- **A-1（D1 方案被推翻）**：初稿写「`git check-ignore -z --stdin` 喂 stdin」→ 实测 `runGit`（`git.js:99`）**无 stdin 通路**、且 `-z` 必须配 `--stdin`（配 argv 会 exit 128）。改「`check-ignore -z -- <argv>`」也被实测推翻：`-z` 与 argv 组合直接 exit 128「-z 需要和 --stdin 参数共用才有意义」。
- **A-2（更致命：check-ignore 与 git add 口径不一致）**：截图真实场景是「目录被 `.gitignore` 规则命中，但目录下已有**已跟踪**子文件」。实测：此时 `git check-ignore -- <dir>` **返回 exit 1、无输出**（因为默认不报已跟踪路径下的目录；加 `--no-index` 才报），而 `git add -A -- <dir>` **仍报该目录被忽略并整条 exit 1**。也就是说「用 check-ignore 判定并过滤」在截图场景会**漏掉那条路径、照样整条失败**——初稿方案根本修不了 bug。
- **A-3（`-A` 的连带扫描 + 整批失败是「部分成功」）**：实测 `git add -A -- <被忽略目录下某个已跟踪子文件>` **仍然报目录名并失败**（`-A` 会连带扫描整个目录）；但更关键的是：**整批 `git add -A -- <忽略目录> + <若干正常路径>` 虽然 exit 1，正常路径其实已经全部暂存进 `index`**（实测 `git diff --cached --name-only` 列出 README.md / 被忽略目录下的已跟踪子文件 / 正常新增文件）。也就是说整批失败 = 「部分成功 + 一条 ignored 报错」，不是「什么都没做」。
- **A-4（逐条重试方案被推翻，最终形态确定）**：初稿/上一版的「逐条 `add -A` 重试 + `-u` 救回」实测**多余且有害**——逐条 `add -A -- <已暂存的 tracked child>` 仍会失败（连带扫描），会把本该提交的路径误判为「跳过」；而 `-u` 救回也是多余的（整批已把它暂存）。最终方案：整批成功（`code===0`）就沿用今天的行为；整批失败时用 `git diff --cached -z --name-only` 取「实际暂存集合」，求 `ok = paths ∩ 可提交集合`、`ignoredPaths = paths \ staged`（本地化无关、只读、argv 数组），再用 `ok` 做 `commit -- <pathspec>`。实测 `commit -- <ok>` exit 0 且只提交这批，被忽略的新文件/裸目录不在其中；`ok` 为空时返回 `skipped`。
- **A-5（`--no-index` 会误伤、`ls-files` 会误判目录）**：实测 `git check-ignore --no-index -- <dir> <tracked-child>` 把「已跟踪子文件」也报为忽略（误伤）；`git ls-files --error-unmatch -- <裸目录>` 因目录下有已跟踪子文件而返回 0（误判为可提交）。故二者都不能用来算 `ok`；唯一可靠依据是 `diff --cached` 的**实际暂存文件列表**（`--name-only -z` 输出为 NUL 分隔的相对路径，实测）。
- **A-6（D3 能力缺口真实存在）**：`read.js` 的 `diff()` 返回 `{patch, truncated}`（`read.js:330-331`），但 `commit-message.js:294-295` **只取 `.patch`、丢弃 `truncated`**——D3 透传它有意义。官方 `StreamChunk` 确有 `block-end` 且 `block` 可为 `TextBlock`（`types.ts:496-501, 144-151`），`assembler.ts:22` 注明 `block-end` 权威且冻结 partial——「仅当无 text-delta 时用 block-end 兜底」是必要防御。

### §0.7 已知、本次不解决的遗留风险

- **R1**：`stage` 动作（`write.js:27-33`）同样 `git add -A -- <paths>`，若用户主动把忽略文件加进选择集再「暂存」，仍会整条失败（但正常路径仍被部分暂存，同 A-3）。影响：仅该次 stage 失败，不波及 commit；建议后续把 D1 的「整批试 + 交集」抽成 `write.js` 内共享 helper 供 stage/commit 复用。本次按 §0.4.7 不做。
- **R2**：整批 add 与 `diff --cached` 之间存在极小 TOCTOU 窗口（`.gitignore` 在两者之间被改）。影响：最坏某条被多算/少算；写队列已按仓库串行（`withRepoLock`，不变量 16），不做额外锁。
- **R3**：AI 输入预算提高到 64KB 后，某些小上下文模型可能仍吃不下；不改路由，靠 `omitted`/`upstreamTruncated` 如实告知。
- **R4**：`partial` 文本即便收尾也不保证语义完整；客户端明确标「半截」由用户决定重写。
- **R5**：真机探针（隔离 3099 实例）若环境不具备，只能靠 smoke/SSR 覆盖；如实标注，不声称已真机验证。
- **R6**：整批失败时新增一次只读 `git diff --cached -z --name-only`（本地化无关），一次 commit 的 git 子进程数由 1 增到 2。影响可忽略；正常仓库仍是 1 次（整批成功不做交集）。这是 D1 明确接受的代价。
- **R7**：`diff --cached` 是「全 index」而非「本批路径」，故 D1 必须用 `paths ∩ staged` 而不是直接拿全集做 pathspec（实测：index 里预先存在的无关已暂存条目若被带上会误提交）。实测 `commit -- <paths∩staged>` 只带本批路径、无关条目留在 index，既有 `pathspec:true` 语义保住。
- **R8**：截图里 pathspec 混有 `.json` / `.py` / `.sh` / `.md` / `.html` 等**多种扩展名**与 `test_phase2.py` 等正常路径，且错误末尾带 `hint: "git config advice.addIgnoredFile false"`。方案不解析 stderr 文案、不按扩展名区分，只依据「实际暂存集合」，因此对任意扩展名与任意本地化 hint 都成立；`advice.addIgnoredFile` 提示无需处理（不改 git config）。

## §1 四项问题的落点总览

| 需求 | 决策 | 包/文件 | 主要符号/行为 |
|---|---|---|---|
| req/1, a/1, a/4, a/7 | D1 | `src/host/write.js` | `commit()` 改「整批 `-A` 失败时用 `diff --cached -z --name-only` 求 `paths∩staged` 剔除忽略路径」+ `ignoredPaths`/`skipped` 返回 |
| req/1, a/4 | D1 | `src/client.js` | `run()` 不清空待提交区 + `pushToast` 提示 |
| req/2 上半, a/2, a/5 | D2 | `src/client.js` / `src/host/commit-message.js` | `aiRun()` 传 `locale`；`commitMessagesOf(...,locale)` 白名单 + system 指令 |
| req/2 下半, a/3 | D3 | `src/host/commit-message.js` | `COMMIT_*` 常量、`commitInputOf`、`collectCommitStream`、`cleanupCommitMessage`、`commitMessage` 响应 |
| req/2 下半, a/3 | D3 | `src/client.js` / `src/host/read.js` | `aiRun()` 吃 `input.*` / `partial`；`diff()` 的 `truncated` 透传 |
| req/3, §0.3.3/4 | D4 | `src/client.js` | 待提交行、`orderedRowKeys`、`rectsOf`、`changeSelectionGroups`、`changeMenu`、`onChangesKeyDown`、清理 effect、分组头、`onPendingRemoveMany` |
| req/4, §0.3.5/6 | D5 | `src/client.js` CSS | `.dig-textarea` |
| a/6 | D6 | 21 门词典 / `tests/smoke.mjs` / `CHANGELOG.md` | 新增键与断言、倒序条目 |

## §2 决策（每个 `### D<n>` 独立可判断：选了什么 / 为什么 / 被否决备选 / 影响面 / 落点）

### D1 — 忽略路径在宿主写侧统一过滤（req/1、a/1、a/4、a/7；约束：不变量 3/4/5/16）

**选了什么**：`commit()`（`write.js:197`）在 `paths.length > 0` 时按两段走：

1. **先试整批**（保留今天的行为、零额外开销）：`runGit(root, ['add','-A','--', ...paths])`（`runGit` 非 0 不抛，见 `git.js:99`）。`code===0` → 沿用现有 `args.push('--', ...paths)`（`write.js:210`），不做任何额外调用，行为与改动前一致。
2. **整批失败才求交集**（截图场景）：实测 A-3 —— 整批 `add -A` 虽然 exit 1，但**正常路径已经全部暂存进 index**（含忽略目录下已跟踪子文件、正常新增文件）。因此只需一次只读 `git ls-files -z`（全量已跟踪，含本次无变更文件）∪ `git diff --cached -z --name-only`（本次新暂存）求「可提交集合」（NUL 分隔的相对路径），求：
   - `ok = paths.filter(p => staged.has(p))`
   - `ignoredPaths = paths.filter(p => !staged.has(p))`
   - `ok.length === 0` → **不 commit、不 push**，返回 `{ output:'', skipped:true, ignoredPaths, pushed:false }`。

随后 `commit -m … [-- <pathspec>] -- ok`（`pathspec:true` 时只提交 `ok`，`write.js:206-210` 语义保全；`pathspec` 未设时仍按原语义提交整个 index，`args` 不带 `-- ok`）。结果追加 `ignoredPaths: string[]`、`skipped: boolean`。客户端 `run()`（`client.js:17124`）在 `result.skipped === true` 时**不清空** `pendingPaths` / `PENDING_KEY`（a/4），改用 `pushToast`（`client.js:17531`）弹 `toast.commitIgnoredSkipped`（「N 个被 .gitignore 忽略的路径已跳过，仍保留在待提交区」）；`skipped===false && ignoredPaths.length>0` 时同样提示「有 N 个路径被跳过」。

**为什么**：
- 八轮实测（§0.6 A-1~A-5）证明：**不能**用 `check-ignore` 判定——截图里「被忽略目录下已有已跟踪子文件」时 `check-ignore` 默认不报该目录（exit 1），但 `git add -A -- <dir>` 仍整条失败；`-z` 不能配 argv（exit 128），`--stdin` 受限于 `runGit` 无 stdin 通路；`--no-index` 会误伤已跟踪子文件，`ls-files --error-unmatch` 对裸目录误判为可提交（A-5）。唯一可靠依据是 **`ls-files ∪ diff --cached` 的可提交集合**。
- **整批失败是「部分成功」**（A-3）：这是本轮最关键的新发现。上一版「逐条重试 `-A` + `-u` 救回」因此被推翻——逐条 `add -A -- <已暂存的 tracked child>` 仍会因连带扫描而失败，会把本该提交的路径误判为「跳过」；而 `-u` 救回也多余（整批已暂存）。改为「只剔除没进 index 的路径」，语义更准、调用更少。
- **本地化无关**（R8）：不解析 stderr 文案（截图为中文「下列路径根据您的一个 .gitignore 文件而被忽略」+ `hint: git config advice.addIgnoredFile false`，英文环境文案不同），只依据 `diff --cached -z --name-only` 的结构化输出；对任意扩展名（截图混有 `.json/.py/.sh/.md/.html`）、任意 locale 都成立；`advice.addIgnoredFile` 提示无需处理（不改 git config）。
- **交集而非全集**（R7）：`diff --cached` 是「全 index」，若 index 里预先存在无关已暂存条目，直接拿全集做 pathspec 会误提交；实测 `commit -- <paths∩staged>` 只带本批路径、无关条目留在 index，既有 `pathspec:true` 语义保住。
- **整批成功时不降级**（R6）：正常仓库仍是 1 次 git 调用；异常路径只多 1 次只读 `diff --cached`，代价可忽略。
- 在**宿主写侧**处理而非客户端：忽略状态是仓库当下真实状态（`.gitignore` 可能刚被改），且「提交所有」对话框（`client.js:18258-18263`）与待提交区两条入口都走 `commit()`；写侧统一处理是唯一不绕过信任围栏与写队列的位置。
- 全部走 `runGit` 的 argv 数组（不变量 3），不引入 shell / stdin / 字符串拼接；`runGit` 非 0 不抛，正好用来判定「整批失败」。整批失败不抛 `PanelError`，只有「`ok` 为空」才返回 `skipped`，用户看到明确提示而不是错误横幅。

**被否决的备选**：
1. `git add -f`（强制提交）→ 被 a/1 否决：会把用户刻意忽略的生成物写进历史。
2. 提交前弹窗让用户选 → 被 a/1 否决：用户已选自动跳过。
3. `git check-ignore -z --stdin` / `-z -- <argv>` / 默认 `-- <argv>` / `--no-index` → 全部被实测推翻（A-1/A-2/A-5）：stdin 不通 / exit 128 / 口径不一致会漏掉截图里那条路径 / 误伤已跟踪子文件。
4. **逐条 `add -A` 重试 + `-u` 救回**（上一版方案）→ 被 A-3/A-4 推翻：整批已把正常路径暂存，逐条重试对已暂存子文件仍失败会误判跳过，`-u` 多余。
5. 把 `-A` 整体换成 `-u` → 被 A-3 推翻：未跟踪新文件会 exit 128「未匹配任何 Git 已知文件」，破坏「新增文件可提交」的既有语义。
6. 用 `git ls-files --error-unmatch` 判定 → 被 A-5 推翻：裸目录因含已跟踪子文件而误判为可提交。
7. 在客户端用 `summary.changes.ignored` 过滤 → 否决：只在「显示忽略文件」开关打开时才有，且不是 `git add` 的权威结果。
8. `git add -A` 不带 `-- <paths>`（退回整库暂存）→ 否决：破坏 `pathspec:true` 的「只提交这批路径、不动 index 其它条目」语义（`write.js:206-210`）。
9. 用 `git add -n`（dry-run）预检 → 否决：多一次 git 调用且仍要解析 stderr 文案（本地化/版本相关），不如直接看真实 add 退出码可靠。
10. 直接用全集 `paths` 做 pathspec commit → 被实测推翻：被忽略的新文件没进 index，`commit -- <全集>` 会 exit 1「路径规格 … 未匹配任何 Git 已知文件」。

**影响面**：`src/host/write.js`（`commit` 函数体：整批试 + 失败时 `diff --cached` 求交集；返回结构追加 `ignoredPaths`/`skipped`）；`src/client.js`（`run()` 清空分支 + toast）；21 门词典 +1 键。**不改** `core.js` 守卫、`WRITE_METHODS`（`commit` 已在 `core.js:77`）、`http.js` 方法表、`stage`（R1）、信任围栏、`diff()` 本身。返回结构新增字段向后兼容（既有消费方只读 `output`/`pushed`/`pushError`）。`skipped` 时 `push` 不执行——没有提交自然不该推送，`pushed:false` 明示。

**冲突消解**：若 `payload.push===true` 且 `confirm!==true`，既有守卫（`write.js:216`）仍优先抛 `bad-request`；整批 add 与交集发生在守卫之后、commit 之前。`amend` / `signoff` 原样透传。**性能代价（R6）**：异常路径只多 1 次只读 `git diff --cached -z --name-only`；正常路径保持 1 次调用。

### D2 — AI 语言跟随界面（req/2 上半、a/2、a/5；约束：不变量 10）

**选了什么**：客户端 `aiRun()`（`client.js:14963`）在 `request('commit-message', …)` 的 payload 里加 `locale: activeLocaleOf(props.ctx)`（模块级函数，`client.js:9823`，实时读 DSH 语言偏好，已存在）。宿主 `commitMessage`（`commit-message.js:273`）把 `payload.locale` 传给纯函数 `commitMessagesOf(input, userPrompt, locale)`；该函数用**白名单表**把 tag 映射成语言名（`zh`/`zh-cn`/`zh-sg`→简体中文，`zh-hk`/`zh-tw`/`zh-mo`/`zh-hant`→繁體中文，`ja`→日本語、`ko`→한국어、`de`→Deutsch、`fr`→Français … 未列出的→English），拼进 system 指令：

```
Write the commit message in <语言>. Use that language for both the subject and the body.
```

其余 system 规则（只输出提交信息、首行 ≤72 字符、不编造文件等，`commit-message.js:66-72`）一字不改。自定义 prompt 仍按原样附加在 **user 消息末尾**的「Additional requirements … (style only)」（`commit-message.js:78-83`），优先级与 a/5 一致：system 是语言基线，用户显式写的语言要求照旧能覆盖。

**为什么**：模型用英文作答只是因为 system 指令是英文；把语言要求放进 system 而不是 user，能避免被「diff 里全是英文标识符」带偏。白名单映射而非「把 tag 直接塞给模型」：tag 形如 `zh-Hant-TW` 不是自然语言名，且防止任意字符串注入 system。纯函数便于 `tests/smoke.mjs:1420` 的 `new Function` 切片直接断言「简体中文」进入 system。用 `activeLocaleOf` 而非 `navigator.language`：既有约定（不变量 10）明确 DSH 的 host-backed 语言偏好优先于浏览器，且该函数已订阅式实时读取。

**被否决的备选**：
1. 固定中文 → 被 a/2 否决。
2. 把语言要求放进 user 消息 → 否决：会被 diff 内容与 style-only 附加要求稀释。
3. 新增一个宿主设置项让用户选语言 → 否决：需求没要求，且与「跟随界面」冲突，徒增 Config 字段（AGENTS.md 单代基线纪律）。
4. 让客户端自己翻译模型输出 → 否决：多一次模型调用、破坏「一次性生成」语义。

**影响面**：`src/client.js`（`aiRun` 的 payload 多一个字段）、`src/host/commit-message.js`（`commitMessagesOf` 签名 + `commitMessage` 传参）。**不改** `commitRouteOf` / `quietOffEffortOf` / 失败码 / 设置卡 Config 字段。纯函数签名变更由 smoke 切片同步（新增第三参数断言）。

### D3 — 输入与输出双向防截断（req/2 下半、a/3；约束：issue #7 的既有结论）

**选了什么**（三处缺口一起补）：

*输入侧*（`commit-message.js`）：
- 常量 `COMMIT_TOTAL_BYTES` 12KB→64KB、`COMMIT_FILE_BYTES` 2KB→8KB、`COMMIT_FILE_LINES` 80→200、`COMMIT_MAX_FILES` 30→60。理由：提交信息任务只需读 diff，64KB 对主流模型安全；原 12KB 会让一个中等改动就直接丢弃后半文件（`commitInputOf:56` 的 `dropped++`）。
- `commitInputOf(stagedPatch, unstagedPatch, upstreamTruncated)` 新增第三参数：`commitMessage` 把两次 `diff()` 的 `truncated`（`read.js:330-331`，A-3 确认被丢弃）用 `||` 合并后传入，纳入 `incomplete`。
- 超过总预算的文件**不再整文件消失**：保留 `diff --git` header + 前 `COMMIT_SUMMARY_LINES`（新增常量，取 12）行作摘要，记入 `omittedFiles`，仍计入 `dropped`。理由：模型至少知道这些文件被改过，不会凭空漏掉主要改动。lock 文件 / 二进制仍整体跳过（§0.4.8）。
- 返回 `input` 增加 `upstreamTruncated` / `omittedFiles`（数组，路径列表）/ `truncated` / `dropped` / `bytes` / `files`，客户端 `aiNotice`（`client.js:14988-14990`）据 `omittedFiles.length` 与 `upstreamTruncated` 生成精确文案（新增 `changes.aiNoticeOmitted`、`changes.aiNoticeUpstream` 两键，21 门同步），取代原来笼统的一句。

*输出侧*（`commit-message.js`）：
- `collectCommitStream()` 兼容 `block-end`：`chunk.type === 'block-end' && chunk.block.type === 'text'` 时，把 `block.text` 记入 `byIndex`（按 `chunk.index`）；若**同一 index 已累计过 `text-delta`**则不重复累加（A-3：官方 `assembler.ts:22` 明确 `block-end` 权威且会冻结 partial）。记录 `finish.kind`。
- `finish.kind === 'max-tokens'` 且 `text.trim() !== ''` → 返回 `partial: true`，`commitMessage` 不再当硬错误（现 `commit-message.js:339-346` 只在「无文本且 sawReasoning」时报错，有半截文本时会被当成功返回）。`finish.kind` 为 `error`/`aborted`/其它非 stop 的既有分支一律保留。
- `cleanupCommitMessage(text, partial)` 第二参数：partial 且文本不以句末标点/换行收尾时补 `…`；**不**强行截断完整文本。
- `commitMessage` 响应新增 `partial: boolean`、`finishKind: string|null`；客户端 `aiRun` 在 `data.partial === true` 时把 `aiNote` 设为 `changes.aiPartial`（新键，21 门同步），提示「模型输出被长度上限截断，本次是半截结果，可重写」。三态：完整 / 半截 / 失败（`catch` 分支不变）。

**为什么**：a/3 要求两处都优化，实测/源码确证三层截断（A-3 与 `commitMessagesOf` 的预算、`collectCommitStream` 只认 `text-delta`）。`block-end` 兜底是防御性的：并非所有 adapter 都发 `text-delta`（官方协议允许 `block-end` 携带完整块），不能假设「能力已具备」。`max-tokens` 半截不当成功也不当硬错误：用户至少拿到一段可用文字，且被明确标注。`partial` 收尾只在「不完整句尾」补省略号，避免污染完整输出。

**被否决的备选**：
1. 重新加 `maxTokens` 硬上限 → 否决：issue #7 已证明写死输出上限会与 reasoning 抢预算（`commit-message.js:313-318` 注释），且 `quietOffEffortOf` 已把未设 effort 压到 `off`。
2. 流式输出截断时自动重试一次 → 否决：需求没要求，且会消耗双倍额度（`changes.aiQuota` 明示「会消耗你的额度」）。
3. 把 400KB 的 `MAX_DIFF_CHARS` 也调大 → 否决：`read.js` 的 diff 是**预览面板共用**的，调大会影响 diff 预览与内存；本次只在 commit-message 侧透传 `truncated` 并如实报告。
4. 把 `omitted` 文件的完整 diff 分批发多次模型调用 → 否决：破坏一次性生成、增加额度与复杂度（YAGNI）。

**影响面**：`src/host/commit-message.js`（4 个常量、3 个纯函数、路由响应）、`src/host/read.js`（**零改动**，只是 `commitMessage` 开始读它已返回的 `truncated`）、`src/client.js`（`aiRun` 的提示分支 + 2 个新键）、21 门词典 +3 键、`tests/smoke.mjs:1415-1513` 的 `new Function` 切片（新增第三参数与 `block-end` 断言）。**不改** `MAX_DIFF_CHARS`、`diff()` 本身、AI 路由、失败码、`busy` 单飞窗口。

### D4 — 待提交行复用 `changeSelection` 并加「全部移出」（req/3、§0.3.3/4）

**选了什么**（落点逐个列名）：

1. `client.js:15177-15189` 待提交行 JSX：外层补 `selected` 类（`selection.has('pending:'+path)` → `dig-row-selected`）、单击改走 `handleRowClick(event, {path}, 'pending')`（`client.js:14910`，它用 `group + ':' + item.path` 拼 key，正好 `pending:path`）、`onDoubleClick` 与 `onContextMenu` 仍调 `props.onDiff(..., 'pending')` / `props.onChangeMenu(..., 'pending')`；原有「移出」`dig-mini` 按钮保留（`stopPropagation` 已在）。
2. `client.js:14899-14909` `orderedRowKeys()`：删掉 `&& entry.key.indexOf('pending:') !== 0` 的排除，让 Shift 范围包含待提交行；`ignored:` 仍排除。
3. `client.js:15064` `rectsOf()`：**现状已只排除 `ignored:`、并未排除 `pending:`**（实测确证）——因此框选天然覆盖待提交行，**不改**。初稿写「也去掉 pending 排除」是错的，已纠正。
4. `client.js:17863-17879` 选中清理 effect：`alive` 增加「对每个 `pending:` 键，若 `path` 仍在 `pendingPaths` 集合里则保留」。理由：否则一次 refresh 就把刚选中的待提交行清掉。
5. `client.js:17708-17727` `changeSelectionGroups()`：返回对象增加 `pending: []`，`for (const key of changeSelection)` 里把 `key.indexOf('pending:')===0` 的路径推入 `groups.pending`，且**不**加入 `staged`/`other`/`tracked`/`untracked`（避免被 stage/discard 误处理）。
6. `client.js:18129-18165` `changeMenu`：`group === 'pending'` 时返回「移出待提交（N）」菜单（复用 `menu.pendRemoveN` 新键，选中 >1 时用 `groups.pending.length`）；选中 >1 且混合普通行时，在多选菜单里追加「移出 N 个待提交」项。批量移出走新 prop `onPendingRemoveMany(paths)`。
7. `Panel` 新增 `onPendingRemoveMany`（`client.js:18951` 的 props 处）：`for (const path of paths) togglePending(path,false)`（`togglePending` 已在 `client.js:17154`，每次写回 `PENDING_KEY`；为减少写入，改为一次性 `setPendingPaths` + 一次 `writePendingMap`）。
8. `client.js:17883-17913` `onChangesKeyDown` 的 Delete：若 `changeSelection.size > 0` **且所有键都以 `pending:` 开头** → `event.preventDefault()` + 移出这些路径（不弹 `openDiscardManyDialog`）；否则维持原丢弃确认。理由：Delete 在「待提交」标签上的直觉是移出标签，不是删文件。
9. `client.js:15173-15176` 分组头：在 `dig-group-head-pending` 内追加 `.dig-link`（`margin-left:auto`，`client.js:20175` 已存在）「全部移出」按钮（`menu.pendRemoveAll` 新键），点击调 `onPendingRemoveAll()` → 一次性 `setPendingPaths(new Set())` + `writePendingMap({...[repoRoot]: []})`。与 `menu.pendAddN` 的「全部添加」对仗。
10. `client.js:18957` `onPendingRemove` 保留（单行按钮）。

**为什么复用 `changeSelection`**：初稿曾想另建状态，实测 `changeSelection`（`client.js:16418`）已是 Panel 级、被 `onChangeSelection`（`16444`）、`onChangesKeyDown`、`changeMenu`、`changeSelectionGroups`、清理 effect 共同消费的**唯一**选择源；待提交行 key 格式与它完全兼容。另建状态会让 Shift 范围（§0.3.3）与右键整组语义分叉。

**被否决的备选**：
1. 待提交区专用选择状态 → 见上，否决。
2. 把「全部移出」放到面板顶栏 → 被 §0.3.4 否决（用户说「待提交所在栏最右边」）。
3. 用复选框列（每行一个 checkbox）→ 否决：改变行高与 `ITEM_HEIGHTS.row` 窗口化模型，代价大且需求只说「多选」。
4. Delete 一律改为移出（不分是否纯待提交）→ 否决：普通变更行的 Delete 是「丢弃文件」确认，语义不能混。

**影响面**：`src/client.js` 的 8 处符号（上述）+ 21 门词典 +2 键（`menu.pendRemoveN`、`menu.pendRemoveAll`）。**不改** `ITEM_HEIGHTS`、`useRubberBand`、`PENDING_KEY` schema、提交成功清空逻辑（仅 D1 的 `skipped` 分支除外）、`togglePending` 的语义。`changeItems` 的 `useMemo` 依赖数组（`client.js:15199`）需补 `props.pendingPaths` / `props.onPendingRemoveMany` / `props.onPendingRemoveAll` / `props.selection` 已在列表内，避免待提交集合变化后不重渲染（不变量 12：依赖数组当帧求值，先声明后引用）。

### D5 — textarea 默认高度翻倍并明确可拉伸（req/4、§0.3.5/6）

**选了什么**：`client.js:20193` 的 `.dig-textarea`：`min-height:50px` → `height:100px`，同时保留 `min-height:50px`（拖拽下限）、新增 `max-height:40vh`（防止挤没变更列表），`resize:vertical` **原样保留**（浏览器原生把手可拉高/拉低）。compact 分支的 `<input class="dig-input dig-input-compact">`（`client.js:15240`）维持单行，不改。`tests/smoke.mjs` 新增断言钉住 `height:100px`、`min-height:50px`、`max-height:40vh`、`resize:vertical`。

**为什么**：`min-height` 只保证下限、实际高度由内容决定，用户看到的「输入框有点低」就是它；改成 `height` 才是「默认高度增加一倍」的确定性实现。`resize:vertical` 已存在（A 确证），本次是明确并补上下限/上限，而非新造拖拽机制；`max-height` 是必要的副作用防御——提交框在 `.dig-commit-box`（`flex:none`）里，无限拉高会压掉 `.dig-changes-list`（`flex:1`）。

**被否决的备选**：
1. JS 拖拽把手 / ResizeObserver → 否决：原生 `resize` 已满足，新增代码无收益。
2. 用 `rows` 属性或 `em` 高度 → 否决：受 `font:inherit` 影响不确定，且不好钉断言。
3. compact 也换 textarea → 被 §0.3.5 否决。
4. 持久化用户拖拽后的高度 → 否决：需求没要求，且会新增一个 localStorage 键（YAGNI）。

**影响面**：`src/client.js` 一行 CSS + `tests/smoke.mjs` 一条断言。**不改** compact 布局、`.dig-commit-box` / `.dig-commit-box-docked`、其它 `dig-input`。

### D6 — 词典、验证与变更记录（a/6；约束：不变量 10、AGENTS.md 变更记录纪律）

**选了什么**：21 门词典（ZH/EN/`LOCALES` 19 门，标记 `/* locale: <tag> */`）新增键：`toast.commitIgnoredSkipped`、`menu.pendRemoveN`、`menu.pendRemoveAll`、`changes.aiPartial`、`changes.aiNoticeOmitted`、`changes.aiNoticeUpstream`，逐门键集一致（`tests/smoke.mjs:962` 的 `every shipped dictionary carries the same key set as zh` 强制）。`t` 仍是查表函数（`client.js:9844`），不改。`CHANGELOG.md` 的 `## Unreleased` 段新增倒序条目（类型 fix + feat，含四项要点、验证记录、相关链接按既有格式）。验证顺序：`node --check src/client.js` + `node --check src/host/*.js` → `node tests/smoke.mjs` → `node --test tests/api.test.mjs`（注意：既有基线失败 `api.test.mjs:578 pull defaults to merge` 与本次无关，按历史纪律如实标注）→ `node scripts/ssr-check.mjs` → 真机探针（若环境允许则隔离 3099、绝不碰 3080）。

**为什么**：不变量 10 要求「加文案键时 ZH/EN 一起加、再给 LOCALES 每一门都加，冒烟测试逐门比对键集」；AGENTS.md「变更记录纪律」要求所有修复写进 CHANGELOG 而非 AGENTS.md。验证顺序沿用既有纪律（先语法、再 smoke、再 API、再 SSR）。

**被否决的备选**：把新键塞进已有键的模板变量里复用 → 否决：`menu.pendAddN` 是「添加」语义，移出是反向动作，复用会让文案歧义且键集计数断言（`smoke.mjs:2853-2854` 的 21 次匹配）失效。

**影响面**：`src/client.js` 词典区（约 21×6=126 行）、`tests/smoke.mjs`（新增断言）、`CHANGELOG.md`。**不改** `LOCALE_NS` / `ctx.locale.register` / `dictionaryFor`。

## §3 决策 ↔ 需求双向追溯表

| 决策 | 追溯来源 | 反向：需求被哪个决策覆盖 |
|---|---|---|
| D1 | req/1 + a/1 + a/4 + a/7 + 不变量 3/4/5/16 + 实测 A-1~A-4 | req/1 → D1；a/1 → D1；a/4 → D1；a/7 → D1 |
| D2 | req/2 上半 + a/2 + a/5 + 不变量 10 | req/2 上半 → D2；a/2 → D2；a/5 → D2 |
| D3 | req/2 下半 + a/3 + issue #7 既有结论 + 实测 A-5 | req/2 下半 → D3；a/3 → D3 |
| D4 | req/3 + §0.3.3/4 + 不变量 12 | req/3 → D4 |
| D5 | req/4 + §0.3.5/6 | req/4 → D5 |
| D6 | a/6 + 不变量 10 + AGENTS.md 变更记录纪律 | a/6 → D6 |

无「无来源决策」：D6 的每个动作都挂在 a/6 与既有纪律上；D3 的 `block-end` 兜底挂在「官方 `StreamChunk` 允许该形态」这一已确证约束上（A-6）；D1 的「整批试 + `diff --cached` 交集」挂在八轮实测（A-1~A-5）与 a/7 语义边界上。

## §4 边界与风险

### §4.1 最坏后果与影响范围

- **D1 若出错**（交集误剔除）：最坏把一条本该提交的路径跳过，或 `ok` 为空导致「提交并推送」不提交（但 `skipped:true` + toast 明示，待提交区保留，用户可重试；`ignoredPaths` 列出被跳过的路径）。影响范围仅限**该仓库的一次 commit 请求**；不会破坏 git index 其它已暂存条目（`paths∩staged` 语义保留），不会误推（`pushed:false`），不会丢数据——被忽略路径的字节从未被移动或删除。整批 `add -A` 的部分暂存是 git 既有行为，与改动前一致。
- **D2 若出错**（语言映射错）：最坏提交信息用了错误语言，用户可编辑或重写；不影响仓库状态。
- **D3 若出错**（预算过大/半截误判）：最坏一次模型调用浪费额度或输出半截；不写仓库。
- **D4 若出错**（选择串组）：最坏多选时把普通行也当成待提交移出标签（只改 UI 标记、不删文件），或 Delete 误触发丢弃确认（有确认框，不会直接删）。
- **D5 若出错**：纯 CSS，最坏布局挤压，`max-height:40vh` 兜底。
- 总体：不触碰 `push --force`、`reset --hard`、`clean` 等破坏性操作；不改信任围栏（不变量 5）与写队列（不变量 16）。

### §4.2 回退路径

- 全部改动是**就地代码 + 词典 + CSS + 测试**，无数据格式迁移、无已发布接口语义变更（`commit` 返回新增字段是追加、`commit-message` 响应新增字段是追加）、无外部可见的破坏性行为变化。
- 回退 = `git revert <本轮提交>` 即可；`PENDING_KEY` schema 未变，回退后旧代码照常读。`skipped` 分支只在整批 `-A` 失败且 `ok` 为空时出现，回退后回到原行为（整条失败），不会留下半状态；整批 `add -A` 已暂存的条目在回退后仍留在 index（与今天整批 add 部分成功时的状态一致，git 自身语义，非本次引入）。
- **不可逆部分**：无。唯一「外部可见行为变化」是「待提交区含忽略路径时不再整条失败」，这本身就是修复目标，且可逆。

### §4.3 安全与权限边界

- **文件访问**：整批 add 的每条 pathspec 都是 `requireRelativePath()`（`core.js:90-96`）校验过的相对路径，`cwd=root`，`spawn` argv 数组（不变量 3），不引入 shell、不拼接命令、不写 stdin；`--` 防止以 `-` 开头的路径被当选项。失败时的 `git diff --cached -z --name-only` 是只读、只取已暂存路径，不会像 `-f` 那样把忽略目录里的生成物纳入版本控制。
- **凭据**：不改 `gitEnv()`（`GIT_TERMINAL_PROMPT=0`）、不碰 AI 路由凭据、不新增任何网络出口。
- **信任围栏**：`commit` 仍在 `METHODS` 表（`http.js:37-…`）里、仍先 `isTrusted(req)` 再 POST（不变量 5）；新增的 `diff --cached` 是同一请求内的只读子进程，不开新路由。
- **破坏性确认**：`push` 仍要求 `confirm:true`（`write.js:216`）；「提交并推送」按钮按既有例外（`AGENTS.md` 不变量 4）点击即视为确认，本次不改。
- **诊断旁路**：不变量 21 要求 `diagnostics` 只存子命令、不存完整 argv；整批 `add -A` 与 `diff --cached` 经由 `runGit` 自动登记 `args[0]`（`add` / `diff`），不泄露路径或提交信息，符合该约束（异常路径最多 2 条活动调用，均在 30s 超时内 settle 清理）。

### §4.4 遗留风险

见 §0.7 R1–R8（逐条含影响与建议），本轮不解决，已显式列出不留白。

## §5 验证清单（可据以实现与验收）

1. `node --check src/client.js` 与 `node --check src/host/*.js` 全绿。
2. `node tests/smoke.mjs`：既有断言 + 新增（D1 的「整批 `-A` 失败→`diff --cached` 求交集」与 `skipped`/`ignoredPaths` 分支、D2 中文进 system、D3 常量/第三参数/`block-end`/`partial`、D4 待提交行接入 `handleRowClick` / `changeSelectionGroups` 的 `pending` / 分组头按钮 / `onChangesKeyDown` 分支、D5 CSS、`21 门键集`）。
3. `node --test tests/api.test.mjs`：新增集成用例（临时真实仓库 + 伪造 ctx）覆盖截图精确场景——「目录被 `.gitignore` 忽略但目录下有已跟踪子文件」时 `commit` 不整条失败、`ignoredPaths` 正确返回、`skipped` 时 push 不执行、已跟踪子文件修改因整批已暂存仍进提交、正常新增文件仍可提交；既有基线失败如实标注。
4. `node scripts/ssr-check.mjs` 四座位全 OK（D4 改了 `changeItems` 依赖数组，SSR 真渲染能抓 TDZ/依赖问题，不变量 12）。
5. 词典 21 门键集一致（`smoke.mjs:962`）。
6. `CHANGELOG.md` Unreleased 条目。
7. 真机（若环境允许）：隔离 `DSH_HOME` + 3099，验证四项；否则如实标注未跑。

## 附录 A — 符号确证命令与结果（逐个，不凭记忆）

| 符号 / 事实 | 命令 | 结果 |
|---|---|---|
| `commit()` 与 `git add -A -- …paths` | `sed -n '197,222p' src/host/write.js` | 确证，含 `pathspec`/`push`/`confirm` 分支 |
| `runGit` 无 stdin、非 0 不抛 | `grep -n "stdin\|input:" src/host/git.js` + `sed -n '99,160p'` | 零命中；`spawn(gitBinary(), args, {cwd, windowsHide:true, env})` 无 stdio；`resolve({code,…})` 不抛 |
| `git()` 非 0 即抛 | `sed -n '163,170p' src/host/git.js` | `if (result.code !== 0) throw PanelError('git-failed', …)`（故整批判定必须用 `runGit`） |
| `-z` 必须配 `--stdin` | 实测 `git check-ignore -z -- a b c` | exit 128「-z 需要和 --stdin 参数共用」→ argv 形态不可用 |
| `check-ignore` 与 `add` 口径不一致（截图场景） | 实测：目录规则 + 目录下已有 tracked 子文件后 `git check-ignore -- <dir>` vs `git add -A -- <dir>` | 前者 exit 1 无输出，后者仍报目录 ignored 并 exit 1 → **不能用 check-ignore 过滤** |
| `-A` 连带扫描忽略目录 | 实测 `git add -A -- <ignored-dir>/<tracked-child>` 与 `git add -- <child>` | 两者都 exit 1 报目录名；`git add -u -- <child>` exit 0 且能暂存修改 |
| `-u` 对未跟踪新文件 | 实测 `git add -u -- <brand-new.txt>` | exit 128「未匹配任何 Git 已知文件」→ 不能整体替换 `-A` |
| 整批失败是「部分成功」 | 实测 `git add -A -- <ignored dir> + <good paths>` exit 1 后 `git diff --cached --name-only` | 正常路径（含忽略目录下已跟踪子文件、正常新增）**已全部暂存**；只有被忽略的新文件/裸目录不在 index |
| 交集方案闭环（最终方案） | 实测「整批失败 → `diff --cached -z --name-only` → `ok = paths ∩ staged` → `commit -- <ok>`」 | commit exit 0 且只提交这批；被忽略路径不在其中；`ok` 为空返回 skipped |
| 逐条重试被推翻 | 实测「整批失败后再逐条 `git add -A -- <已暂存的 tracked child>`」 | 仍 exit 1（连带扫描），会误判为跳过；故不采用 |
| `--no-index` 误伤 / `ls-files` 误判 | 实测 `check-ignore --no-index -- <dir> <child>` 与 `ls-files --error-unmatch -- <dir>` | 前者把已跟踪子文件也报忽略；后者对裸目录返回 0；均不能用来算 ok |
| 整批成功路径无额外开销 | 实测 `git add -A -- <全正常路径>` | exit 0，一次调用即可（R6 代价只在异常路径） |
| `MAX_DIFF_CHARS` / `diff().truncated` | `grep -n MAX_DIFF_CHARS src/host/*.js` + `sed -n '328,331p' src/host/read.js` | 400KB；返回 `{patch, truncated}` |
| `commitMessage` 丢弃 truncated | `sed -n '292,296p' src/host/commit-message.js` | 只用 `.patch` |
| `StreamChunk` 有 `block-end`/`TextBlock` | `sed -n '488,508p' …/types.ts` + `sed -n '144,157p'` | 确证；`assembler.ts:22` 注明 block-end 权威 |
| `FinishReason` 有 `max-tokens` | `grep -n "max-tokens" …/types.ts` | `types.ts:166` |
| `activeLocaleOf` | `grep -n "function activeLocaleOf" src/client.js` | `9823` |
| `changeSelection` / `onChangeSelection` / 清理 effect | `grep -n "changeSelection" src/client.js` | `16418/16444/17863-17879` |
| `rectsOf` 未排除 pending | `sed -n '15060,15070p' src/client.js` | 只排除 `ignored:`（**纠正初稿**） |
| `orderedRowKeys` 排除 pending | `sed -n '14897,14910p' src/client.js` | 确有 `&& entry.key.indexOf('pending:') !== 0` |
| 待提交行 JSX / 分组头 | `sed -n '15170,15192p' src/client.js` | 单击只 `onDiff`，无 selected |
| `dig-link` / `dig-mini` / `.dig-textarea` CSS | `grep -n "dig-link{\|dig-mini{\|dig-textarea{" src/client.js` | `20175/20188/20193` |
| `changeMenu` / `onChangesKeyDown` / `changeSelectionGroups` | `grep -n` | `18129/17883/17708` |
| `pushToast` / `togglePending` / `run()` 清空 | `grep -n` | `17531/17154/17124-17144` |
| 新键未占用 | `grep -cn "pendRemoveAll\|pendRemoveN\|aiPartial\|commitIgnoredSkipped" src/client.js` | `0` |
| 21 门词典结构 | `grep -n "locale:" src/client.js` + `grep -n "const ZH\|const EN\|const LOCALES"` | `106/567/1034` + 19 门标记 |
| smoke 键集强制 | `sed -n '962,992p' tests/smoke.mjs` | `every shipped dictionary carries the same key set as zh` |
| `http.js` 方法表 | `sed -n '30,75p' src/host/http.js` | `commit` / `commit-message` 均已登记，无需新增 |

## 附录 B — 本轮审查抓到并就地修正的缺口

1. **`.dsh/design/<task-id>.md` 缺失**：`get_delivery_task` 返回 `designCount:0`，该文档从未生成（初稿只写了 `docs/` 草稿与 openspec design）。已用 `record_design` 补写指向本文的摘要。
2. **D1 过滤方案经八轮实测两次推翻、最终定稿**（最关键修正）：初稿 `check-ignore --stdin` → `runGit` 无 stdin；改 `-z -- <argv>` → exit 128；再查发现截图场景下 `check-ignore` 默认不报该目录而 `git add` 仍整条失败 → 第一版改为「逐条 `-A` + `-u` 救回」；**本轮追加实测发现整批 `add -A` 失败其实是「部分成功」**（正常路径已全部进 index），逐条重试反而会把已暂存的 tracked child 误判为跳过 → 最终定稿为「整批试 → 失败时用 `diff --cached -z --name-only` 求 `paths∩staged` → 用交集做 pathspec commit」。同时确证 `--no-index` 误伤已跟踪子文件、`ls-files` 对裸目录误判，故二者都不能算 ok。
3. **D1 的「部分成功」语义边界**（A-3/A-4）：补 a/7——整批 `add -A` 失败时正常路径（含忽略目录下已跟踪子文件）已暂存，无需 `-u` 救回；`-u` 对未跟踪新文件 exit 128 故不能整体替换 `-A`。新增 R6（异常路径仅多 1 次只读 `diff --cached`）、R7（`diff --cached` 是全 index，必须 `paths∩staged` 而非全集）、R8（pathspec 混多种扩展名、中英文 locale 的 hint 文案都需本地化无关处理）。
4. **D4 的 `rectsOf` 初稿写错**：实测它**本来就没排除 `pending:`**，改成「不改」，并把 `orderedRowKeys` 的排除保留为唯一要删的特例。
5. **D3 的 `read.js` 落点写错**：初稿说「改 `read.js`」，实际 `read.js` 零改动——只是 `commitMessage` 开始读它**已返回**的 `truncated`。已改。
6. **D4 的 `changeItems` 依赖数组**（不变量 12）：初稿漏了「新增 props 要补进 `useMemo` 依赖」，已补。
7. **openspec design.md 原为纯索引/无「为什么/被否决备选/影响面」**：已整体重写为自足版。
8. **初稿缺 §0 需求基线/歧义/不做/易误认排除、§4 风险/回退/安全、附录确证表**：已补齐（对应审查 3/4/5/6/7/8/9/10/11/16/17/18/19/20/21）。
9. **D1 的「保留在待提交区」来源**：初稿当成自发决定，已标为 a/4（由 a/1 推导）。
10. **D3 新增 `changes.aiNoticeOmitted` / `changes.aiNoticeUpstream`**：初稿只说「精确文案」没给键名与落点，已补；`changes.aiUpstreamTruncated`（如采用）这种不确定表述已删除。
11. **行号错误**：`commit` 在 `WRITE_METHODS` 的 `core.js:77`（初稿写 `:78`），已改；附录 A 逐条复核了 `write.js:197/206-210/216`、`git.js:99/163-170`、`read.js:330-331`、`commit-message.js:294-295`、`client.js:20193/15064/14910` 等引用。
12. **§4.3 安全段、§4.1/§4.2、§5 验证、附录 A、附录 B**：随 D1 两次重写全部同步，避免文档自相矛盾；`§0.4.8` 补「不用 check-ignore 作为过滤依据」，`§0.7` 补 R7/R8。
13. **本轮追加的完整截图（英文 locale）核对**：报错为 `The following paths are ignored by one of your .gitignore files: scripts/yapi_scene_export/portal/services` + `hint: "git config advice.addIgnoredFile false"`，pathspec 混有 `.json/.html/.md/.py/.sh` 多种扩展名与 `test_phase2.py` 等正常路径，且只有**裸目录**被点名、其下几十个 `.json` 未报——与 A-3「整批部分成功」实测完全一致；方案不解析 stderr、不按扩展名区分，故 R8 成立，设计无需再改。
