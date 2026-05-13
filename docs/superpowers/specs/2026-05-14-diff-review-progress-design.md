# Diff / Promotion review 文件查看进度设计

## 背景

当前 `差异` 页和 `设为当前版本评审` 页都能展示 bundle 文件级 diff，但用户看完一个文件后没有地方标记“我已经审过这个文件”。当 Skill bundle 文件变多时，用户只能靠记忆判断哪些文件已经扫过，promotion review 也缺少一个“diff 已看多少”的轻量进度信号。

本轮只做前端会话级 progress，不做服务端持久化，不把 viewed progress 变成 promotion 的硬门禁。

## 外部实践

- [GitHub Docs: Reviewing proposed changes](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request?tool=webui) 建议按文件逐个 review，完成一个文件后 mark as viewed，并在 PR header 显示 viewed progress。
- [GitHub Blog: Mark files as viewed](https://github.blog/news-insights/product-news/mark-files-as-viewed/) 说明 viewed 文件会自动 collapse；如果文件后续变化，viewed 状态会被移除，避免错过新变化。
- [GitLab Docs: Changes in merge requests](https://docs.gitlab.com/user/project/merge_requests/changes/) 在文件 header 提供 Viewed checkbox；文件内容变化或用户清除 checkbox 后，文件会重新出现在待查看集合里。

对 SkillHub 的适配结论：我们的 version diff 是不可变 `VariantVersion -> VariantVersion`，所以“文件变化后取消 viewed”可以通过 diff pair key 自动重置。第一阶段只需要在当前浏览器会话内按 `left_version_id + right_version_id + path` 维护 viewed set。

## 产品设计

新增共享 hook：

- `useFileReviewProgress(files, reviewKey)`：维护当前 diff pair 的 viewed file set。
- 当 `reviewKey` 变化时清空 viewed set，避免把 v1->v2 的查看状态带到 v1->v3。
- 返回 `viewedCount`、`totalCount`、`isViewed(path)`、`toggleViewed(path)`、`markViewed(path, boolean)`。

`差异` 页：

- 在 summary metrics 中新增 `Reviewed x/y`。
- 文件 rail 每行显示状态 chip：未看 / 已查看。
- 详情 header 右侧增加 checkbox：`已查看此文件`。
- 用户勾选后，当前文件行变成已查看，进度增加。

`Promotion review` 页：

- 在 `Bundle diff` header 显示 `x/y reviewed`。
- 文件 rail 每行显示未看 / 已查看。
- 当前文件代码面板顶部增加 `已查看此文件` checkbox。

## 范围

本轮修改：

- `apps/web/components/diff/use-file-review-progress.ts`
- `apps/web/components/diff/workbench-diff-pane.tsx`
- `apps/web/components/promotion-review/promotion-diff-viewer.tsx`
- `apps/web/app/globals.css`
- `apps/web/e2e/skills-workbench.spec.ts`

本轮不做：

- 服务端持久化 viewed progress。
- promotion button 必须全部 reviewed 才能点击。
- 自动 collapse 已查看文件。
- reviewed progress 和具体 eval case / diff hunk 的关联。

## 验收标准

- E2E 证明 `差异` 页初始显示 `Reviewed 0/3`，勾选当前文件后显示 `Reviewed 1/3`，对应文件 rail 显示 `已查看`。
- E2E 证明 `Promotion review` 页初始显示 `0/3 reviewed`，勾选当前文件后显示 `1/3 reviewed`。
- 切换 diff pair 或重新加载 review 时不会沿用旧 pair 的 viewed state。
- 现有 bundle diff、promotion review、风险 promotion、视觉回归不受影响。
- README、产品体验评审、摩擦审计、完成度审计和任务日志同步更新。
