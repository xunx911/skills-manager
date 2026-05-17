# URL State 第二阶段设计

## 背景

TASK-042 已让 `/skills?skill=<slug-or-id>&mode=<mode>` 支持直达、刷新恢复和 Back/Forward。但成熟产品里，用户真正想分享的往往不是“历史页”这个粗粒度位置，而是某个具体证据上下文：一组 bundle diff、一次候选版本 promotion review、某组 run history filters、某条 selected run、或一次 run comparison。

当前这些状态仍只存在于 React 内存里，刷新后会丢；复制 URL 给同事也无法复现同一个证据视图。

## 外部实践

- [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines) 明确建议把 filters、tabs、pagination、expanded panels 等状态持久化在 URL，让分享、刷新和 Back/Forward 工作。
- [Next.js App Router useSearchParams](https://nextjs.org/docs/app/api-reference/functions/use-search-params) 和 [Adding Search and Pagination](https://nextjs.org/learn/dashboard-app/adding-search-and-pagination) 推荐用 URL search params 表示搜索、筛选和分页状态，并用客户端路由平滑更新。
- [MDN History API](https://developer.mozilla.org/docs/Web/API/History_API/Working_with_the_History_API) 说明 `pushState`、`replaceState` 和 `popstate` 正是为“页面不整页刷新但浏览器历史仍可恢复状态”服务。

对 SkillHub 的适配结论：URL 是“证据上下文指针”，不是本地草稿存储。只同步能被后端不可变对象或稳定筛选条件还原的状态；表单草稿、未提交 pass/fail 草稿和 viewed progress 不进 URL。

## 参数契约

保留第一阶段参数：

- `skill=<slug-or-id>`
- `mode=overview|variants|evals|diff|history|audit|promotion`

新增第二阶段参数：

- Diff：`diff_left=<variant_version_id>`、`diff_right=<variant_version_id>`、`diff_file=<bundle path>`、`diff_filter=all|changed|added|removed|binary`
- Evals：`eval_target=<variant_version_id>`、`case=<eval_case_id>`
- History：`run_variant=<variant_version_id>`、`run_eval_set=<eval_set_version_id>`、`run_strategy=<strategy>`、`run_status=<status>`、`run=<eval_run_id>`、`compare_base=<eval_run_id>`、`compare_candidate=<eval_run_id>`
- Run matrix：`matrix_group=none|impact`、`matrix_impact=all|waiting|fixed|regressed|stable_pass|stable_fail|missing`、`matrix_score=true|false`、`matrix_impact_column=true|false`
- Promotion：`promotion_variant=<variant_id>`、`promotion_candidate=<variant_version_id>`、`promotion_eval_set=<eval_set_version_id>`
- Audit：`audit_actor=<actor>`、`audit_action=<action>`、`audit_resource=all|skill|variant|eval_run`

参数清理规则：

- 值等于默认值时不写 URL，例如 `mode=overview`、`diff_filter=all`、`run_status=all`。
- 只写当前 mode 相关的深层参数，避免用户从 `history` 切到 `evals` 后 URL 仍携带旧 run comparison。
- 参数非法或指向当前 skill 不存在的对象时，不报错阻塞页面；UI 回退到该视图的默认选择。

## 架构

新增纯工具 `apps/web/lib/workbench-url-state.ts`：

- 定义 `SHAREABLE_MODES`，供 server page 和 client workbench 复用，避免两处白名单漂移。
- `parseWorkbenchUrlState(search)`：把 query string 解析成受控状态对象，并过滤枚举值。
- `workbenchUrlForState(input)`：从当前 workbench state 生成 canonical URL。

`DecisionWorkbench` 保留业务状态，但不再手写 URL 参数细节：

- 新增 `apps/web/components/url-state/use-workbench-url-state.ts` 封装 hydrate、sync 和 `popstate` 副作用，避免主工作台组件继续膨胀。
- 初始 mount 先从 URL hydrate 深层状态，再开始同步 URL，避免一进页面就把深链参数删掉。
- `popstate` 复用同一个 apply 函数，浏览器 Back/Forward 会恢复深层状态。
- Diff pair 由一个 effect 统一加载，`openDiffMode/updateDiffPair/URL hydrate` 只负责设置 pair state。
- Promotion review 通过 `promotionTarget` 描述 URL 可还原上下文，加载逻辑由 effect 执行。

## 范围

本轮修改：

- `apps/web/lib/workbench-url-state.ts`
- `apps/web/components/url-state/use-workbench-url-state.ts`
- `apps/web/app/skills/page.tsx`
- `apps/web/components/decision-workbench.tsx`
- `apps/web/e2e/url-state.spec.ts`
- 产品文档、任务日志和完成度审计

本轮不做：

- 把手工测评草稿、批量 case 输入草稿、表单草稿写入 URL。
- 服务端持久化 viewed progress。
- Saved view URL 短链或分享权限。
- 组织级 audit URL 设计。

## 验收标准

- 复制或刷新 diff URL 后，仍停在同一个 skill、`diff` mode、同一组 `diff_left/diff_right`，并恢复 `diff_filter` 和 `diff_file`。
- 复制或刷新 history URL 后，run filters、matrix controls、selected run、baseline/candidate comparison 都恢复。
- 复制或刷新 evals URL 后，`eval_target` 和 selected case 恢复。
- 复制或刷新 promotion URL 后，加载同一个 candidate promotion review。
- 浏览器 Back/Forward 能在这些深层状态之间移动。
- 非目标视图的深层参数会从 URL 中清理，避免链接长期携带误导上下文。
