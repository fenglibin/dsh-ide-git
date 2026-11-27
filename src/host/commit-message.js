/**
 * dsh-ide-git host: AI commit messages (issue #6). The llm + sessions services
 * are injected by the plugin entry; this module never reaches for them itself.
 */
import { PanelError, badRequest, cwdOf } from './core.js'
import { repoRootOf } from './git.js'
import { summary, diff } from './read.js'

/* ============================== ai commit message ============================== */
/* Issue #6: write the commit message with the session's own model route. The
   settings arrive WITH the request (the browser reads them from the same row
   Config document it renders), so a setting change takes effect on the next
   click without the host caching anything. */
const COMMIT_MAX_PROMPT_CHARS = 2000
/* 输入预算放宽（v0.37.9）：原 12KB / 2KB / 80 行 / 30 文件会把一个中等改动
   的后半文件直接丢掉，模型看不到完整变更。提交信息只是读 diff 的格式化任务，
   64KB 对主流模型安全；超预算的文件留头部摘要而不是整文件消失。 */
const COMMIT_TOTAL_BYTES = 64 * 1024
const COMMIT_FILE_BYTES = 8192
const COMMIT_FILE_LINES = 200
const COMMIT_MAX_FILES = 60
const COMMIT_SUMMARY_LINES = 12
const COMMIT_BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|bz2|xz|7z|jar|war|woff2?|ttf|otf|eot|mp[34]|mov|avi|mkv|so|dylib|dll|exe|bin|wasm|class|o|a)$/i

/** One model call's text, plus how it ENDED (a failure arrives as a finish chunk).
    官方 StreamChunk 允许 adapter 只发 block-end 携带完整 TextBlock，故按 index
    兜底一次；同一 index 已有 text-delta 时不重复累加。 */
async function collectCommitStream(stream) {
  let text = ''
  let finish = null
  let sawReasoning = false
  const byIndex = new Map()
  for await (const chunk of stream) {
    if (chunk === null || chunk === undefined) continue
    if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
      const index = Number.isInteger(chunk.index) ? chunk.index : 0
      byIndex.set(index, (byIndex.get(index) === undefined ? '' : byIndex.get(index)) + chunk.text)
    } else if (chunk.type === 'block-end' && chunk.block !== null && typeof chunk.block === 'object' && chunk.block.type === 'text' && typeof chunk.block.text === 'string') {
      const index = Number.isInteger(chunk.index) ? chunk.index : 0
      if (!byIndex.has(index)) byIndex.set(index, chunk.block.text)
    } else if (chunk.type === 'reasoning-delta') sawReasoning = true
    else if (chunk.type === 'finish') finish = chunk.reason
  }
  for (const index of [...byIndex.keys()].sort((a, b) => a - b)) text += byIndex.get(index)
  return { text: text, finish: finish, sawReasoning: sawReasoning }
}

/** The change set, trimmed to a budget the model can actually be asked about.
    第三参数把 diff() 已返回的 truncated 透传进来（此前被丢弃）。超总预算的
    文件不再整文件消失：保留 diff header + 前若干行作摘要并记 omittedFiles。 */
function commitInputOf(stagedPatch, unstagedPatch, upstreamTruncated) {
  const patch = (stagedPatch === '' ? '' : stagedPatch) + (unstagedPatch === '' ? '' : (stagedPatch === '' ? '' : '\n') + unstagedPatch)
  const files = []
  const omittedFiles = []
  let bytes = 0
  let dropped = 0
  let truncated = false
  /* 超预算文件不整文件消失：留一条极短标记，让模型至少知道这个文件被改过。
     标记不含 diff 内容、不计入 COMMIT_TOTAL_BYTES；但 files 条目总数仍受
     COMMIT_MAX_FILES 约束（模型上下文里的条目数也应有界）。超出上限的文件
     名追加到 omittedFiles，并在末尾汇总成一条 omitted-list 标记，既不突破
     上限又让模型看到全部路径（真机证据脚本发现「预算占满即整文件消失」后修正）。 */
  const omittedMarker = (name) => 'diff --git a/' + name + ' b/' + name + '\n[diff omitted: budget exceeded]'
  let extraOmitted = []
  const parts = patch.split(/^diff --git /m).slice(1)
  for (const part of parts) {
    const head = /^a\/(.+?) b\//.exec(part)
    const name = head === null ? '(unknown)' : head[1]
    if (COMMIT_BINARY.test(name)) { dropped += 1; continue }
    if (/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|composer\.lock)$/.test(name)) { dropped += 1; continue }
    let body = 'diff --git ' + part
    let trimmed = false
    const lines = body.split('\n')
    if (lines.length > COMMIT_FILE_LINES) { body = lines.slice(0, COMMIT_FILE_LINES).join('\n'); trimmed = true }
    if (body.length > COMMIT_FILE_BYTES) { body = body.slice(0, COMMIT_FILE_BYTES); trimmed = true }
    const overBudget = bytes + body.length > COMMIT_TOTAL_BYTES || files.length >= COMMIT_MAX_FILES
    if (overBudget === true) {
      dropped += 1
      omittedFiles.push(name)
      truncated = true
      if (files.length < COMMIT_MAX_FILES) {
        const summary = 'diff --git ' + part.split('\n').slice(0, COMMIT_SUMMARY_LINES).join('\n')
        files.push({ path: name, body: summary.length <= COMMIT_SUMMARY_LINES * 80 ? summary : omittedMarker(name) })
      } else {
        extraOmitted.push(name)
      }
      continue
    }
    if (trimmed === true) truncated = true
    bytes += body.length
    files.push({ path: name, body: body })
  }
  if (extraOmitted.length > 0 && files.length > 0) {
    files[files.length - 1].body += '\n[other changed files, diff omitted: ' + extraOmitted.join(', ') + ']'
  }
  return { files: files, bytes: bytes, dropped: dropped, truncated: truncated, upstreamTruncated: upstreamTruncated === true, omittedFiles: omittedFiles }
}

/** 界面语言 → 自然语言名，白名单映射（tag 不是自然语言名，且防注入 system）。 */
function commitLanguageOf(locale) {
  const raw = typeof locale === 'string' ? locale.trim().toLowerCase().replace(/_/g, '-') : ''
  const tag = raw.split('-')[0]
  if (raw === 'zh-hk' || raw === 'zh-tw' || raw === 'zh-mo' || raw.indexOf('hant') >= 0) return '繁體中文'
  if (tag === 'zh') return '简体中文'
  if (tag === 'ja') return '日本語'
  if (tag === 'ko') return '한국어'
  if (tag === 'de') return 'Deutsch'
  if (tag === 'fr') return 'Français'
  if (tag === 'ru') return 'Русский'
  if (tag === 'pt') return 'Português'
  if (tag === 'it') return 'Italiano'
  if (tag === 'nl') return 'Nederlands'
  if (tag === 'pl') return 'Polski'
  if (tag === 'sv') return 'Svenska'
  if (tag === 'tr') return 'Türkçe'
  if (tag === 'id') return 'Bahasa Indonesia'
  if (tag === 'vi') return 'Tiếng Việt'
  if (tag === 'ar') return 'العربية'
  if (tag === 'hi') return 'हिन्दी'
  if (tag === 'th') return 'ไทย'
  return 'English'
}

/** Built-in instruction + the change set + the user's own addition, as DATA.
    语言要求放 system 而不是 user：避免被「diff 里全是英文标识符」带偏。
    自定义 prompt 仍是 user 消息末尾的 style-only 附加，优先级不变。 */
function commitMessagesOf(input, userPrompt, locale) {
  const language = commitLanguageOf(locale)
  const system = [
    'You write git commit messages.',
    'Reply with the commit message ONLY: no prose, no code fences, no quotes, no explanation.',
    'First line: a concise subject, at most 72 characters, no trailing period.',
    'Then one blank line and a short body explaining what changed and why, when it adds value.',
    'Describe only what the diff shows. Never invent files, features or issue numbers.',
    'Write the commit message in ' + language + '. Use that language for both the subject and the body.',
  ].join('\n')
  const user = [
    'Write the commit message for these changes.',
    '',
    input.files.map((file) => file.body).join('\n'),
  ].join('\n')
  /* The user's text is DATA in the same message, never a system instruction: it
     steers style (format, language, length) but cannot replace the rules above. */
  const addition = typeof userPrompt === 'string' && userPrompt.trim() !== ''
    ? '\n\nAdditional requirements from the user (style only; the rules above still apply):\n' + userPrompt.trim()
    : ''
  return { system: system, user: user + addition }
}

/** Strip what a model habitually wraps a message in; keep the text itself.
    partial（输出被长度上限截断）且句尾不完整时补省略号，明确这是半截。 */
function cleanupCommitMessage(text, partial) {
  let out = String(text === null || text === undefined ? '' : text).trim()
  const fence = /^```[a-zA-Z]*\n([\s\S]*?)\n?```$/.exec(out)
  if (fence !== null) out = fence[1].trim()
  if (out.length > 1 && ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith('“') && out.endsWith('”')))) out = out.slice(1, -1).trim()
  if (partial === true && out !== '' && !/[.!?。！？…\n]$/.test(out)) out += '…'
  return out
}

/* ---- ai commit message: the route handler ---- */
let commitServices = null
let commitBusy = false

function gatewayError(code, message) {
  return new PanelError(code, message, 502)
}

function failureTextOf(failure) {
  if (failure === null || failure === undefined) return ''
  if (typeof failure.message === 'string' && failure.message !== '') return failure.message
  return String(failure.code === undefined ? failure : failure.code)
}

/** Which route the failed call actually used (issue #36).
    The panel's model capsule writes the SESSION route, while a fixed
    commitModel in the settings card bypasses it entirely (see commitRouteOf).
    A bare provider error ("invalid_api_key") then reads as "the model I picked
    is broken" when the call never went to that model at all, so every failure
    below names the route and where it came from. */
function routeTextOf(route) {
  if (route === null || route === undefined) return ''
  return route.provider + '/' + route.model + ' (' + route.source + ')'
}

/** A gateway failure that names the route, keeping the provider text intact
    (that text is the part a search engine can answer). */
function routeError(route, code, message) {
  return gatewayError(code, '[' + routeTextOf(route) + '] ' + message)
}

/** The no-route fallback: the first provider this host serves that lists at
    least one model, and that provider's first model. Issue #19 — a fresh
    session (no model picked yet) used to fail the panel button with 'no-route'
    before the user ever saw a message; a commit message is too small a task to
    lecture anyone about routing. Errors per provider stay silent on purpose:
    a provider that fails its catalog simply is not a fallback candidate. */
async function fallbackRouteOf() {
  const llm = commitServices.llm
  for (const row of llm.listProviders()) {
    try {
      const models = await llm.listModels(row.id)
      const model = models[0]
      if (model !== undefined && model !== null && typeof model.id === 'string' && model.id !== '') {
        return { provider: row.id, model: model.id }
      }
    } catch (error) {
      void error
    }
  }
  return null
}

/** Route the call exactly like the session does when it talks to the model. */
async function commitRouteOf(payload) {
  const wanted = typeof payload.model === 'string' ? payload.model.trim() : ''
  if (wanted === '') {
    const id = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : ''
    if (id === '') throw new PanelError('no-session', 'no session id: cannot follow the session model route', 502)
    const list = commitServices.sessions.list()
    const session = list.filter((row) => String(row.id) === id)[0]
    if (session === undefined) throw new PanelError('no-session', 'unknown session "' + id + '"', 502)
    let header = null
    try { header = session.requestHeader() } catch (error) { header = null; void error }
    const config = header === null || header === undefined || header.config === undefined || header.config === null ? {} : header.config
    if (typeof config.provider !== 'string' || typeof config.model !== 'string') {
      /* Issue #19: 'no-route' is the failure every blank session hit. The
         served fallback below keeps the button useful on a brand-new session;
         the panel's model picker (this release) is the user's visible way to
         steer it, and it drives the SAME session route once a model is picked. */
      const fallback = await fallbackRouteOf()
      if (fallback !== null) return { provider: fallback.provider, model: fallback.model, source: 'fallback' }
      throw new PanelError('no-models', 'no model route and no served models to fall back to; pick a model in the session first', 502)
    }
    return { provider: config.provider, model: config.model, source: 'session' }
  }
  const slash = wanted.indexOf('/')
  if (slash <= 0 || slash === wanted.length - 1 || wanted.indexOf('/', slash + 1) >= 0) {
    throw badRequest('model must look like "provider/model"')
  }
  const provider = wanted.slice(0, slash)
  const model = wanted.slice(slash + 1)
  const known = commitServices.llm.listProviders().map((row) => row.id)
  if (known.indexOf(provider) < 0) {
    throw new PanelError('unknown-provider', 'unknown provider "' + provider + '"; this host serves: ' + known.join(', '))
  }
  /* The catalog is advisory (routing accepts unlisted ids), so an empty catalog
     cannot prove a model wrong — only a non-empty one without this id can. */
  const models = await commitServices.llm.listModels(provider)
  if (models.length > 0 && !models.some((row) => row.id === model)) {
    throw new PanelError('unknown-model', 'unknown model "' + model + '" for ' + provider + '; try: ' + models.map((row) => row.id).slice(0, 8).join(', '))
  }
  return { provider: provider, model: model, source: 'setting' }
}

/** The unset reasoning default: 'off' when this route offers it, '' otherwise.
    Failures stay silent on purpose — this is a preference, not a contract: an
    unreachable capability lookup must not turn a working model call into an
    error; it just leaves the effort to the adapter's own default. */
async function quietOffEffortOf(route) {
  try {
    const llm = commitServices.llm
    if (typeof llm.resolveModelInfo !== 'function') return ''
    const info = await llm.resolveModelInfo(route.provider, route.model)
    const reasoning = info !== null && typeof info === 'object' && info.reasoning !== null && typeof info.reasoning === 'object' ? info.reasoning : null
    const efforts = reasoning !== null && Array.isArray(reasoning.efforts) ? reasoning.efforts : []
    return efforts.some((row) => row !== null && typeof row === 'object' && row.id === 'off') ? 'off' : ''
  } catch (error) {
    void error
    return ''
  }
}

/** The settings card's model picker: every provider route this host serves and
    the models each one lists. The catalog is advisory (routing accepts
    unlisted ids, see commitRouteOf), so a stored hand-typed value stays valid
    even when it is not in this list. */
async function commitModels() {
  if (commitServices === null) {
    throw new PanelError('no-host-service', 'this host does not serve llm + sessions, so there is no model catalog here', 501)
  }
  const providers = []
  for (const row of commitServices.llm.listProviders()) {
    /* One provider's discovery failing must not hide the others: its entry
       ships with an empty model list and the picker still works. */
    let models = []
    try { models = await commitServices.llm.listModels(row.id) } catch (error) { models = []; void error }
    providers.push({
      id: row.id,
      name: typeof row.name === 'string' && row.name !== '' ? row.name : row.id,
      models: models
        .filter((model) => model !== null && typeof model === 'object' && typeof model.id === 'string' && model.id !== '')
        .map((model) => ({ id: model.id, name: typeof model.name === 'string' && model.name !== '' ? model.name : model.id })),
    })
  }
  return { providers: providers }
}

/** The settings card's reasoning picker: the efforts one exact provider/model
    route accepts. An unreachable capability lookup answers with an EMPTY list
    (the browser falls back to its text field) instead of an error — the picker
    is a convenience, not a gate. */
async function commitEfforts(payload) {
  if (commitServices === null) {
    throw new PanelError('no-host-service', 'this host does not serve llm + sessions, so there are no reasoning efforts here', 501)
  }
  const wanted = typeof payload.model === 'string' ? payload.model.trim() : ''
  const slash = wanted.indexOf('/')
  if (slash <= 0 || slash === wanted.length - 1 || wanted.indexOf('/', slash + 1) >= 0) {
    throw badRequest('model must look like "provider/model"')
  }
  const provider = wanted.slice(0, slash)
  const model = wanted.slice(slash + 1)
  const known = commitServices.llm.listProviders().map((row) => row.id)
  if (known.indexOf(provider) < 0) {
    throw new PanelError('unknown-provider', 'unknown provider "' + provider + '"; this host serves: ' + known.join(', '))
  }
  if (typeof commitServices.llm.resolveModelInfo !== 'function') {
    return { provider: provider, model: model, efforts: [], defaultEffort: null }
  }
  try {
    const info = await commitServices.llm.resolveModelInfo(provider, model)
    const reasoning = info !== null && typeof info === 'object' && info.reasoning !== null && typeof info.reasoning === 'object' ? info.reasoning : null
    const efforts = reasoning !== null && Array.isArray(reasoning.efforts) ? reasoning.efforts : []
    return {
      provider: provider,
      model: model,
      efforts: efforts
        .filter((row) => row !== null && typeof row === 'object' && typeof row.id === 'string' && row.id !== '')
        .map((row) => ({ id: row.id, name: typeof row.name === 'string' && row.name !== '' ? row.name : row.id })),
      defaultEffort: reasoning !== null && typeof reasoning.defaultEffort === 'string' ? reasoning.defaultEffort : null,
    }
  } catch (error) {
    void error
    return { provider: provider, model: model, efforts: [], defaultEffort: null }
  }
}

async function commitMessage(payload) {
  if (commitServices === null) {
    throw new PanelError('no-host-service', 'this host does not serve llm + sessions, so the message cannot be written here', 501)
  }
  /* The single-flight window opens BEFORE the first await and covers the route
     lookup, the git reads and the model call. Claiming it only around the stream
     let four simultaneous clicks all pass the check and spend four model calls
     (measured: 4x200 on one click burst), which is four times the user's quota. */
  if (commitBusy) throw new PanelError('busy', 'a commit message is already being written', 409)
  commitBusy = true
  try {
    const cwd = cwdOf(payload)
    /* The picked repository travels as `repoRoot`, and every other git call
       threads it through `repoRootOf`. Resolving the root from `cwd` alone made
       this the one route that answered not-a-repo in a workspace whose own root
       is not a repository — a workspace holding several sibling repos, which is
       exactly what the repo picker exists for. */
    const repoRoot = await repoRootOf(cwd, payload)
    const scope = { cwd: cwd, repoRoot: repoRoot }
    const route = await commitRouteOf(payload)
    const sums = await summary(scope)
    const stagedResult = sums.changes.staged.length > 0 ? await diff(Object.assign({}, scope, { staged: true })) : { patch: '', truncated: false }
    const unstagedResult = await diff(scope)
    /* diff() 早已返回 truncated（read.js:330-331），此前只取 .patch 丢弃了它。
       合并两路透传给 commitInputOf，客户端才能如实说「上游 diff 被截断」。 */
    const input = commitInputOf(stagedResult.patch, unstagedResult.patch, stagedResult.truncated === true || unstagedResult.truncated === true)
    if (input.files.length === 0) {
      if (input.dropped > 0) {
        throw new PanelError('only-ignored-changes', 'the only changes are lock files or binary files, which are not sent to the model; stage a source change first')
      }
      throw badRequest('nothing to describe: stage or edit something first')
    }
    const asked = typeof payload.prompt === 'string' ? payload.prompt : ''
    const prompt = asked.slice(0, COMMIT_MAX_PROMPT_CHARS)
    const reasoning = typeof payload.reasoningEffort === 'string' ? payload.reasoningEffort.trim() : ''
    const spoken = commitMessagesOf(input, prompt, payload.locale)
    const options = {
      provider: route.provider,
      model: route.model,
      system: spoken.system,
      messages: [{ role: 'user', content: [{ type: 'text', text: spoken.user }] }],
      temperature: 0.2,
    }
    /* No maxTokens on purpose: omitted, the runtime materializes the selected
       model's own configured output cap (resolveModelInfo().defaultMaxTokens) —
       exactly what a session call gets. The hardcoded 512 here was half of
       issue #7: with thinking enabled, max_tokens is the budget for reasoning
       AND message together, so 512 died inside the reasoning phase before one
       word of the message existed. */
    /* The other half of issue #7: an UNSET effort is not a neutral "model
       default" — the DeepSeek adapter resolves "unspecified" to reasoning ON at
       "high". A commit message is a formatting task, so the unset default now
       asks for "off" whenever the route offers it. The id is read from the
       route's own efforts table (resolveModelInfo), never assumed: the runtime
       rejects an effort the route does not list, so a blind 'off' would trade
       one loud failure for another. The user's explicit choice always wins. */
    const effectiveReasoning = reasoning !== '' ? reasoning : await quietOffEffortOf(route)
    if (effectiveReasoning !== '') options.reasoningEffort = effectiveReasoning
    if (typeof payload.sessionId === 'string' && payload.sessionId !== '') options.sessionId = payload.sessionId
    const started = Date.now()
    const collected = await collectCommitStream(commitServices.llm.stream(options))
    /* An adapter failure is a terminal finish, not a throw: a missing check here
       would turn "the call failed" into "the model said nothing" (假成功). */
    const finish = collected.finish
    if (finish === null || finish === undefined) {
      throw routeError(route, 'llm-no-finish', 'the model stream ended without a finish reason; treat the result as unknown, not as success')
    }
    if (finish.kind === 'error') throw routeError(route, 'llm-error', failureTextOf(finish.failure))
    if (finish.kind === 'aborted') throw routeError(route, 'llm-aborted', 'the call was aborted: ' + failureTextOf(finish.failure))
    /* max-tokens 且已有文本 = 输出被长度上限截成半截：不当成功、也不当硬
       错误，返回 partial 让客户端明确标注「半截结果」（用户可重写）。 */
    const partial = finish.kind === 'max-tokens' && collected.text.trim() !== ''
    if (finish.kind !== 'stop' && partial === false) {
      /* The max-tokens + no-text + reasoning-delta shape is the exact signature
         of issue #7: the budget (reasoning included) ran out mid-thought. Say
         what happened and what to do, instead of a bare finish kind. */
      if (finish.kind === 'max-tokens' && collected.text.trim() === '' && collected.sawReasoning === true) {
        throw routeError(route, 'llm-unfinished', 'the model stopped with "max-tokens" before writing the message: its reasoning spent the whole output budget; lower the reasoning effort in the plugin settings or pick a lighter model')
      }
      throw routeError(route, 'llm-unfinished', 'the model stopped with "' + String(finish.kind) + '"; the message may be incomplete')
    }
    const message = cleanupCommitMessage(collected.text, partial)
    if (message === '') throw routeError(route, 'empty-output', 'the model returned no text')
    return {
      message: message,
      provider: route.provider,
      model: route.model,
      routeSource: route.source,
      reasoningEffort: effectiveReasoning === '' ? null : effectiveReasoning,
      elapsedMs: Date.now() - started,
      partial: partial,
      finishKind: finish === null || finish === undefined ? null : String(finish.kind),
      input: {
        files: input.files.length, bytes: input.bytes, dropped: input.dropped, truncated: input.truncated,
        upstreamTruncated: input.upstreamTruncated, omittedFiles: input.omittedFiles,
      },
      promptTruncated: asked.length > COMMIT_MAX_PROMPT_CHARS,
    }
  } finally {
    commitBusy = false
  }
}

export function setCommitServices(services) {

  commitServices = services

}

export { commitMessage, commitModels, commitEfforts }
