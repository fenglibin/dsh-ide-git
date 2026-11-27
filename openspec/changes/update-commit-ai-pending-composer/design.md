# 技术决策（自足版）

本文件是 `docs/plans/2026-11-27-four-fixes-design.md` 的自足版：每个 `### D<n>` 都独立写清「选了什么 / 为什么 / 被否决备选 / 影响面 / 落点」，不了解上下文的读者可据此判断。冲突时以 `docs/` 完整草稿为准（含 §0 需求基线、歧义、边界、附录 A 符号确证表、附录 B 双向追溯）。

需求编号：req/1「提交并推送」报错、req/2 AI 提交信息英文+截断、req/3 待提交区多选移出+栏右全部移出、req/4 输入框高度翻倍且可拉伸。对齐结论：a/1 自动跳过忽略文件、a/2 语言跟随界面、a/3 输入输出两处都优化、a/4 忽略文件保留在待提交区并提示、a/5 自定义 prompt 仍 style-only、a/6 CHANGELOG/21 门词典/验证、a/7（实测推导的语义边界）没进 index 的忽略路径不进本次提交但保留标记；该目录下已跟踪文件的修改因整批 `add -A` 已暂存，照常进提交。

### D1 忽略路径在宿主写侧统一过滤

**选了什么**：`src/host/write.js` 的 `commit()`（`:197`）在 `paths.length > 0` 时按两段走：
1. **先试整批**（保留今天的行为、零额外开销）：`runGit(root, ['add','-A','--', ...paths])`（`runGit` 非 0 不抛，`git.js:99`）。`code===0` → 沿用现有 `args.push('--', ...paths)`（`write.js:210`），不做任何额外调用。
2. **整批失败才求交集**（截图场景）：实测整批 `add -A` 虽 exit 1，但**正常路径已全部暂存进 index**（含忽略目录下已跟踪子文件、正常新增文件）。故只需一次只读 `git ls-files -z`（全量已跟踪，含本次无变更文件）∪ `git diff --cached -z --name-only`（本次新暂存）求「可提交集合」（NUL 分隔相对路径），求 `ok = paths.filter(p => staged.has(p))`、`ignoredPaths = paths.filter(p => !staged.has(p))`；`ok.length===0` → 不 commit / 不 push，返回 `{ output:'', skipped:true, ignoredPaths, pushed:false }`。

随后 `commit -m … [-- <pathspec>] -- ok`（`pathspec:true` 时只提交 `ok`，保全 `write.js:206-210` 语义；未设 pathspec 时仍按原语义提交整个 index）。结果追加 `ignoredPaths: string[]`、`skipped: boolean`。`src/client.js` 的 `run()`（`:17124`）在 `result.skipped === true` 时**不清空** `pendingPaths` / `PENDING_KEY`（`client.js:11042`），改用 `pushToast`（`:17531`）弹 `toast.commitIgnoredSkipped`（新键，21 门同步）；`skipped===false && ignoredPaths.length>0` 同样提示「有 N 个路径被跳过」。

**为什么**：五轮实测证明**不能**用 `check-ignore` 判定——截图真实场景是「目录被 `.gitignore` 命中、但目录下已有**已跟踪**子文件」，此时 `git check-ignore -- <dir>` **exit 1 无输出**（默认不报已跟踪路径下的目录），而 `git add -A -- <dir>` **仍报该目录被忽略并整条 exit 1**；两个命令口径不一致，用 check-ignore 过滤会漏掉截图里那条路径、照样整条失败。且 `-z` 不能配 argv（exit 128「-z 需要和 --stdin 参数共用」）、`--stdin` 又受限于 `runGit` 无 stdin 通路。唯一可靠依据是 **`ls-files ∪ diff --cached` 的可提交集合**。**整批失败是「部分成功」**（八轮实测最关键发现）：上一版「逐条重试 `-A` + `-u` 救回」因此被推翻——逐条 `add -A -- <已暂存的 tracked child>` 仍会因连带扫描而失败、把本该提交的路径误判为跳过，而 `-u` 救回也多余。改为「只剔除没进 index 的路径」。`--no-index` 会误伤已跟踪子文件、`ls-files --error-unmatch` 对裸目录误判为可提交，故二者都不能算 `ok`。**本地化无关（R8）**：不解析 stderr 文案（完整截图为英文 `The following paths are ignored...` + `hint: git config advice.addIgnoredFile false`，中文环境文案不同），只依据结构化输出；对 `.json/.py/.sh/.md/.html` 等任意扩展名都成立。**交集而非全集（R7）**：`diff --cached` 是全 index，实测 `commit -- <paths∩staged>` 只带本批路径、无关已暂存条目留在 index。**整批成功时不降级**（R6）：正常仓库仍是 1 次 git 调用。在宿主写侧处理而非客户端：忽略状态是仓库当下真实状态，且「提交所有」对话框（`client.js:18258-18263`）与待提交区两条入口都走 `commit()`。全部走 `runGit` 的 argv 数组（不变量 3），不引入 shell / stdin / 字符串拼接；逐条失败不抛 `PanelError`，只有 `ok` 为空才返回 `skipped`。

**被否决备选**：①`git add -f` → a/1 否决（把刻意忽略的生成物写进历史）；②提交前弹窗选 → a/1 否决；③`check-ignore -z --stdin` / `-z -- <argv>` / 默认 `-- <argv>` / `--no-index` → 全部被实测推翻（stdin 不通 / exit 128 / 口径不一致 / 误伤已跟踪子文件）；④**逐条 `add -A` 重试 + `-u` 救回**（上一版方案）→ 整批已把正常路径暂存，逐条重试对已暂存子文件仍失败会误判跳过；⑤把 `-A` 整体换成 `-u` → 未跟踪新文件 exit 128，破坏「新增文件可提交」语义；⑥用 `ls-files --error-unmatch` 判定 → 裸目录因含已跟踪子文件误判为可提交；⑦客户端用 `summary.changes.ignored` 过滤 → 只在开关打开时才有、非权威；⑧退回 `git add -A` 不带 pathspec → 破坏「只提交这批路径、不动 index 其它条目」语义（`write.js:206-210`）；⑨`git add -n` dry-run 预检 → 多一次调用且要解析 stderr 文案；⑩直接用全集 `paths` 做 pathspec commit → 被忽略的新文件没进 index 会 exit 1「路径规格…未匹配任何 Git 已知文件」。

**影响面**：`src/host/write.js`（`commit` 函数体：整批试 + 失败时 `diff --cached` 求交集；返回结构追加字段）、`src/client.js`（`run()` 清空分支 + toast）、21 门词典 +1 键。**不改** `core.js` 守卫、`WRITE_METHODS`（`commit` 已在 `core.js:77`）、`http.js` 方法表、`stage`（R1）、信任围栏。返回结构追加字段向后兼容。`push===true && confirm!==true` 的既有守卫（`write.js:216`）仍优先抛错；`amend`/`signoff` 原样透传；`skipped` 时 `pushed:false` 明示「没提交也没推送」。**性能代价（R6）**：异常路径只多 1 次只读 `diff --cached`；正常路径 1 次。

### D2 AI 语言跟随界面

**选了什么**：`src/client.js` 的 `aiRun()`（`:14963`）在 `request('commit-message', …)` payload 加 `locale: activeLocaleOf(props.ctx)`（模块级函数 `client.js:9823` 已存在、实时读 DSH 语言偏好）。`src/host/commit-message.js` 的 `commitMessage`（`:273`）把 `payload.locale` 传给纯函数 `commitMessagesOf(input, userPrompt, locale)`（`:65`），用白名单把 tag 映射成语言名（`zh*`→简体中文、`zh-hk/tw/mo/hant`→繁體中文、`ja`→日本語、`ko`→한국어、`de/fr/...`→对应、未列出→English），在 system 追加「Write the commit message in <语言>. Use that language for both the subject and the body.」。其余 system 规则（`commit-message.js:66-72`）与 user 消息末尾的 style-only 附加要求（`:78-83`）一字不改。

**为什么**：模型用英文只因 system 是英文；语言要求放 system 而非 user，避免被 diff 里的英文标识符与 style-only 附加要求稀释。白名单而非把 tag 直接塞给模型：tag 不是自然语言名、且防止任意字符串注入 system。纯函数便于 `tests/smoke.mjs:1420` 的 `new Function` 切片断言「简体中文」进入 system。用 `activeLocaleOf` 而非 `navigator.language`：不变量 10 明确 DSH host-backed 偏好优先。a/5 保证用户自定义 prompt 仍能覆盖语言。

**被否决备选**：①固定中文 → a/2 否决；②语言要求放 user 消息 → 易被稀释；③新增宿主设置项让用户选语言 → 需求没要求、与「跟随界面」冲突、徒增 Config 字段；④客户端自己翻译输出 → 多一次调用、破坏一次性生成。

**影响面**：`src/client.js`（`aiRun` payload 多一字段）、`src/host/commit-message.js`（`commitMessagesOf` 签名 + `commitMessage` 传参）、`tests/smoke.mjs` 切片断言。**不改** `commitRouteOf` / `quietOffEffortOf` / 失败码 / 设置卡 Config 字段 / `t` 查表函数。

### D3 输入与输出双向防截断

**选了什么**：
- *输入*（`commit-message.js`）：`COMMIT_TOTAL_BYTES` 12KB→64KB、`COMMIT_FILE_BYTES` 2KB→8KB、`COMMIT_FILE_LINES` 80→200、`COMMIT_MAX_FILES` 30→60；`commitInputOf(stagedPatch, unstagedPatch, upstreamTruncated)` 新增第三参数，由 `commitMessage` 把两次 `diff()` 已返回的 `truncated`（`read.js:330-331`，现被 `:294-295` 丢弃）用 `||` 合并传入；超总预算的文件不再整文件消失，保留 `diff --git` header + 前 12 行（`COMMIT_SUMMARY_LINES` 新常量）作摘要并记 `omittedFiles`；lock/二进制仍整体跳过（§0.4.8）。响应 `input` 增加 `upstreamTruncated`/`omittedFiles`，客户端 `aiRun`（`client.js:14988-14990`）据 `omittedFiles.length`/`upstreamTruncated` 用新键 `changes.aiNoticeOmitted`、`changes.aiNoticeUpstream`（21 门同步）给精确提示。
- *输出*（`commit-message.js`）：`collectCommitStream()` 兼容 `chunk.type === 'block-end' && chunk.block.type === 'text'`（按 `chunk.index` 记入 `byIndex`，同一 index 已有 `text-delta` 则不重复累加——官方 `assembler.ts:22` 注明 block-end 权威且冻结 partial）；记录 `finish.kind`；`max-tokens` 且已有文本 → `partial: true`，不再当成功或硬错误；`cleanupCommitMessage(text, partial)` 仅在 partial 且句尾不完整时补 `…`；`commitMessage` 响应新增 `partial`/`finishKind`，客户端 `aiRun` 在 `partial===true` 时设 `aiNote = changes.aiPartial`（新键，21 门同步），三态完整/半截/失败。

**为什么**：a/3 要求两处都优化；源码确证三层截断（A-3：`read.js` 的 400KB、`commitInputOf` 的硬预算、`collectCommitStream` 只认 `text-delta`）。`block-end` 兜底是防御性的——并非所有 adapter 都发 `text-delta`（官方 `StreamChunk` 允许 `block-end` 携带完整 `TextBlock`，`types.ts:496-501/144-151`），不能假设能力已具备。`max-tokens` 半截不当成功也不当硬错误：用户至少拿到一段可用文字且被标注。64KB 对提交信息任务安全；提高预算是为让模型看到完整改动，同时用 `omitted`/`upstreamTruncated` 如实告知代价。

**被否决备选**：①重新加 `maxTokens` → issue #7 已证明会与 reasoning 抢预算（`commit-message.js:313-318`）；②半截自动重试 → 需求没要求且耗双倍额度；③调大 `MAX_DIFF_CHARS` → 那是 diff 预览面板共用的，影响内存与预览；④把 omitted 文件分批多次调用 → 破坏一次性生成、YAGNI。

**影响面**：`src/host/commit-message.js`（4 常量、3 纯函数、路由响应）、`src/client.js`（`aiRun` 提示分支 + 3 新键）、`tests/smoke.mjs:1415-1513` 切片断言。**`src/host/read.js` 零改动**（只是 `commitMessage` 开始读它已返回的 `truncated`）。**不改** `MAX_DIFF_CHARS`、`diff()`、AI 路由、失败码、`busy` 单飞窗口、`no maxTokens` 既有结论。

### D4 待提交行复用 changeSelection + 栏右「全部移出」

**选了什么**（逐个落点）：
1. `client.js:15177-15189` 待提交行：补 `selected`（`selection.has('pending:'+path)` → `dig-row-selected`）、单击改走 `handleRowClick(event, {path}, 'pending')`（`:14910` 用 `group+':'+path` 拼 key 正好 `pending:path`）、双击/右键仍 `onDiff(...,'pending')`/`onChangeMenu(...,'pending')`、原「移出」`dig-mini` 按钮保留。
2. `client.js:14899-14909` `orderedRowKeys()`：删掉 `&& entry.key.indexOf('pending:') !== 0` 排除（让 Shift 范围含待提交行）；`ignored:` 仍排除。
3. `client.js:15064` `rectsOf()`：**实测已只排除 `ignored:`、未排除 `pending:`**，框选天然覆盖待提交行，**不改**（纠正初稿）。
4. `client.js:17863-17879` 清理 effect：`alive` 增加「`pending:` 键且 path 仍在 `pendingPaths` 则保留」，否则 refresh 会清掉刚选中的待提交行。
5. `client.js:17708-17727` `changeSelectionGroups()`：返回对象加 `pending: []`，把 `pending:` 键路径归此组，**不**进 staged/other/tracked/untracked。
6. `client.js:18129-18165` `changeMenu`：`group==='pending'` 给「移出 N 个」（`menu.pendRemoveN` 新键）；多选 >1 混合时追加该项；批量走新 prop `onPendingRemoveMany(paths)`。
7. `Panel`（`client.js:18951` props）新增 `onPendingRemoveMany`：一次性 `setPendingPaths` + 一次 `writePendingMap`（复用 `togglePending` `:17154` 的语义但避免 N 次写入）。
8. `client.js:17883-17913` `onChangesKeyDown` 的 Delete：选中**全为** `pending:` 键时改为移出（不弹 `openDiscardManyDialog` `:17738`），否则维持丢弃确认。
9. `client.js:15173-15176` 分组头 `dig-group-head-pending` 内追加 `.dig-link`（`margin-left:auto`，`client.js:20175` 已存在）「全部移出」（`menu.pendRemoveAll` 新键）→ `onPendingRemoveAll()` 一次性清空并写回 `PENDING_KEY`。
10. `client.js:15199` `changeItems` 的 `useMemo` 依赖数组补 `props.pendingPaths` / `props.onPendingRemoveMany` / `props.onPendingRemoveAll`（不变量 12：依赖数组当帧求值、先声明后引用），否则待提交集合变化不重渲染。

**为什么复用 `changeSelection`**：`changeSelection`（`client.js:16418`）已是 Panel 级、被 `onChangeSelection`（`:16444`）/ `onChangesKeyDown` / `changeMenu` / `changeSelectionGroups` / 清理 effect 共同消费的唯一选择源，待提交行 key 格式与它兼容；另建状态会让 Shift 范围与右键整组语义分叉（§0.3.3）。

**被否决备选**：①待提交专用选择状态 → 见上；②「全部移出」放面板顶栏 → §0.3.4 否决（用户说「待提交所在栏最右边」）；③每行加 checkbox → 改变 `ITEM_HEIGHTS.row` 窗口化模型；④Delete 一律改移出 → 普通行的 Delete 是丢弃确认，语义不能混。

**影响面**：`src/client.js` 上述 8 处符号 + `useMemo` 依赖 + 21 门词典 +2 键。**不改** `ITEM_HEIGHTS`、`useRubberBand`、`PENDING_KEY` schema、提交成功清空逻辑（仅 D1 的 `skipped` 分支除外）、`togglePending` 语义。

### D5 textarea 高度与拖拽

**选了什么**：`client.js:20193` 的 `.dig-textarea`：`min-height:50px` → `height:100px`，保留 `min-height:50px`（拖拽下限）、新增 `max-height:40vh`、`resize:vertical` 原样保留。compact 的 `<input class="dig-input dig-input-compact">`（`:15240`）维持单行。`tests/smoke.mjs` 新增断言钉住这四个值。

**为什么**：`min-height` 只保证下限、实际高度由内容决定；改成 `height` 才是「默认翻倍」的确定性实现。`resize:vertical` 已存在（A 确证），本次是明确并补上下限/上限，而非新造拖拽机制；`max-height` 防御无限拉高压掉 `.dig-changes-list`（`flex:1`）。

**被否决备选**：①JS 拖拽/ResizeObserver → 原生 resize 已满足；②`rows`/`em` → 受 `font:inherit` 影响、不好钉断言；③compact 也换 textarea → §0.3.5 否决（窄栏一行式布局）；④持久化拖拽高度 → 需求没要求、新增 localStorage 键（YAGNI）。

**影响面**：`src/client.js` 一行 CSS + `tests/smoke.mjs` 一条断言。**不改** compact 布局、`.dig-commit-box`、其它 `dig-input`。

### D6 词典、验证与变更记录

**选了什么**：21 门词典（ZH `client.js:106` / EN `:567` / `LOCALES` `:1034` 的 19 门 `/* locale: <tag> */`）新增 6 键：`toast.commitIgnoredSkipped`、`menu.pendRemoveN`、`menu.pendRemoveAll`、`changes.aiPartial`、`changes.aiNoticeOmitted`、`changes.aiNoticeUpstream`；`tests/smoke.mjs:962` 的「每门键集 == zh」强制逐门一致；`t` 仍是查表函数（`:9844`）。`CHANGELOG.md` `## Unreleased` 新增倒序条目（fix + feat，含四项要点与验证记录）。验证顺序：`node --check src/client.js` + `node --check src/host/*.js` → `node tests/smoke.mjs` → `node --test tests/api.test.mjs`（既有基线失败 `api.test.mjs:578 pull defaults to merge` 与本次无关，如实标注）→ `node scripts/ssr-check.mjs`（D4 改了依赖数组，SSR 真渲染抓 TDZ）→ 真机探针（若环境允许则隔离 3099、绝不碰 3080）。

**为什么**：不变量 10 要求加键时 ZH/EN 一起加并给每门 LOCALES 都加；AGENTS.md「变更记录纪律」要求所有修复写进 CHANGELOG。验证顺序沿用既有纪律。

**被否决备选**：复用 `menu.pendAddN` 的模板 → 「添加」与「移出」反向语义，且 `smoke.mjs:2853-2854` 的 21 次键计数断言会失效。

**影响面**：`src/client.js` 词典区（约 21×6 行）、`tests/smoke.mjs`、`CHANGELOG.md`。**不改** `LOCALE_NS` / `ctx.locale.register` / `dictionaryFor`。

## 边界与风险（自足摘要）

- **最坏后果**：D1 交集误剔除最坏把本该提交的路径跳过或 `skipped` 不提交（但 toast 明示 + `ignoredPaths` 列出、待提交区保留、可重试、不丢数据——被忽略路径的字节从未被移动）；D2 最坏语言错（可编辑）；D3 最坏浪费一次额度或半截输出（不写仓库）；D4 最坏只改 UI 标记不删文件，Delete 误触也有确认框；D5 纯 CSS 有 `max-height` 兜底。均不触碰 push --force / reset --hard / clean。
- **回退**：全部是就地代码/词典/CSS/测试，无数据迁移、无已发布接口语义变更（返回字段均为追加）、无不可逆部分；`git revert` 即可，`PENDING_KEY` schema 未变。`skipped` 只在整批 `-A` 失败且 `ok` 为空时出现，回退后回到原行为（整条失败），不留下半状态；整批 `add -A` 已暂存的条目在回退后仍留在 index（git 既有部分成功语义，非本次引入）。唯一外部可见行为变化 = 修复目标本身，可逆。
- **安全/权限**：整批 add 的每条 pathspec 都经 `requireRelativePath()`（`core.js:90-96`）校验、`cwd=root`、`spawn` argv 数组、`--` 防选项注入（不变量 3），不引入 shell / stdin / 字符串拼接；失败时的 `diff --cached -z --name-only` 只读、只取已暂存路径，不会像 `-f` 那样把忽略目录里的生成物纳入版本控制。不改 `gitEnv()` / 凭据 / 网络出口；`commit` 仍在 `http.js` METHODS 表、仍先 `isTrusted(req)` 再 POST（不变量 5）；push 仍 `confirm:true`（不变量 4 的「提交并推送」例外不变）；`add -A` 与 `diff --cached` 经 `runGit` 自动登记 `args[0]`（`add`/`diff`），不泄露路径或提交信息，符合不变量 21。
- **遗留风险（本轮不解决）**：R1 `stage`（`write.js:27-33`）同样会因忽略路径整条失败（建议后续把「整批试 + 交集」抽成共享 helper）；R2 整批 add 与 `diff --cached` 间极小 TOCTOU 窗口（写队列已按仓库串行）；R3 64KB 对小上下文模型仍可能过大（靠 omitted 告知）；R4 partial 收尾不保证语义完整（客户端标半截）；R5 真机探针若环境不允许只能靠 smoke/SSR 覆盖（如实标注）；R6 异常路径多 1 次只读 `diff --cached`（可忽略）；R7 `diff --cached` 是全 index，必须用 `paths∩staged` 而非全集；R8 截图 pathspec 混多种扩展名、报错随 locale 变化，方案不解析 stderr/不按扩展名区分（完整英文截图已核对）。
- **明确不做**：`-f` 强制提交、跳过/强制弹窗、用 `check-ignore` 判定、逐条重试 add、`-u` 救回、改 `advice.addIgnoredFile`、改 `.gitignore` 语义、改注册/布局/写队列/撤回/`WRITE_METHODS`/方法表/信任围栏、compact 改多行、第二个 client entry、新第三方依赖、把 lock/二进制送进模型、新增 `maxTokens`、改 AI 路由/失败码、重拍 README 图、改 AGENTS.md 不变量条目。逐条理由见 `docs/` 草稿 §0.4。
- **易误认但排除**：「提交所有」对话框不单独改 UI（宿主过滤自动覆盖）、`stage` 忽略路径不修、待提交行双击 diff 不变、「全部添加待提交」位置不变、`PENDING_KEY` schema 不迁移、忽略判定不缓存、不用 dry-run 预检。见 §0.5。

## 需求 ↔ 决策双向追溯

req/1 → D1；a/1 → D1；a/4 → D1；a/7 → D1；req/2 上半 → D2；a/2 → D2；a/5 → D2；req/2 下半 → D3；a/3 → D3；req/3 → D4；req/4 → D5；a/6 → D6。无无来源决策（D6 挂 a/6 与既有纪律；D3 的 block-end 兜底挂「官方 StreamChunk 允许该形态」这一已确证约束；D1 的「整批试 + `diff --cached` 交集」挂八轮实测与 a/7）。完整表见 `docs/` 草稿 §3。
