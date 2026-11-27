## ADDED Requirements

### Requirement: 界面语言进入 system 指令

`aiRun()` SHALL 把 `activeLocaleOf(props.ctx)` 得到的当前语言 tag 放进 `commit-message` 请求的 `locale` 字段；宿主 `commitMessagesOf(input, userPrompt, locale)` MUST 用白名单把 tag 映射成自然语言名，并在 system 指令中要求「用该语言写 subject 与 body」。白名单外的 tag SHALL 回退 English。

#### Scenario: 中文界面得到中文要求

- WHEN 界面语言为 `zh` / `zh-CN` 等简体 tag
- THEN system 指令含「简体中文」，模型被要求用中文写提交信息

#### Scenario: 繁体与其它语言各自对应

- WHEN 界面语言为 `zh-HK` / `zh-TW` / `ja` / `de` 等
- THEN system 指令分别要求繁體中文 / 日本語 / Deutsch；未列出的 tag 回退 English

### Requirement: 自定义要求仍是 style-only

用户自定义 prompt MUST 继续附加在 user 消息末尾、标注「style only」，SHALL NOT 进入 system 指令或改写语言基线规则。

#### Scenario: 自定义 prompt 不污染 system

- WHEN 设置卡填了「Use Conventional Commits」之类自定义要求
- THEN 该文本只出现在 user 消息末尾，system 规则与语言要求不变
