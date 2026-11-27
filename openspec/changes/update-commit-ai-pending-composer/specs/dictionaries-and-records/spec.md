## ADDED Requirements

### Requirement: 21 门词典键集一致

ZH / EN / `LOCALES` 19 门 SHALL 同步新增 `toast.commitIgnoredSkipped`、`menu.pendRemoveN`、`menu.pendRemoveAll`、`changes.aiPartial`、`changes.aiNoticeOmitted`、`changes.aiNoticeUpstream`；`t` MUST 保持查表函数；`tests/smoke.mjs` 的「每门键集 == zh」SHALL 继续通过。

#### Scenario: 六键逐门齐全

- WHEN 运行 `node tests/smoke.mjs`
- THEN 21 门词典键集相等，新键每门各出现一次

### Requirement: 变更记录与验证

`CHANGELOG.md` 的 `## Unreleased` SHALL 新增倒序条目（fix + feat，含四项要点与验证记录）；验证 MUST 覆盖 `node --check`、`tests/smoke.mjs`、`tests/api.test.mjs`（新增忽略路径集成用例；既有基线失败 `:578` 如实标注）、`scripts/ssr-check.mjs`，真机探针若环境不允许 MUST 如实标注而非声称已验证。

#### Scenario: 忽略路径集成用例通过

- WHEN 在临时真实仓库构造「忽略目录 + 已跟踪子文件 + 正常新增文件」并直驱 commit 路由
- THEN `commit` 不整条失败、`ignoredPaths` 正确、已跟踪修改与正常新增进入提交

#### Scenario: SSR 不因依赖数组报错

- WHEN 运行 `scripts/ssr-check.mjs`
- THEN 四座位真渲染无 TDZ / pageerror（D4 改了 `changeItems` 依赖）
