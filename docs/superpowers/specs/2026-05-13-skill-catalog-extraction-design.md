# Skill Catalog 组件抽离规格

## 背景

`apps/web/components/decision-workbench.tsx` 已超过 2900 行。左侧 Skill Catalog 是稳定的导航区域，当前和主工作区、右侧 Inspector 混在同一个文件里，后续继续做产品化交互时会增加修改风险。

本任务只做结构性拆分，不改变用户看到的界面和行为。

## 用户可见行为

用户仍然在左侧看到同一块目录：

- 顶部显示 `SkillHub` 和 skill 数量。
- 可以点击 `导入` 打开导入 skill 的入口。
- 可以点击 `新建` 打开新建 skill 的入口。
- 可以输入 `skill、owner、tag` 过滤 skill。
- 可以点击任一 skill，主工作区切换到该 skill，右侧上下文回到 skill 信息。
- 当没有任何 skill 时显示“还没有 skill。先导入 bundle 或新建一个。”。
- 当过滤后无匹配时显示“没有匹配的 skill”。

## 组件边界

新增 `SkillCatalog` 作为纯 UI 组件：

- 输入：`skills`、`visibleSkills`、`selectedSkillId`、`catalogQuery`。
- 输出：通过回调通知父组件执行 `onSelectSkill`、`onImportSkill`、`onCreateSkill`、`onCatalogQueryChange`。
- 组件内部只计算展示态，例如 latest accepted eval run 的通过率。
- 组件不直接持有 selected skill、mode、case 选中态，也不直接调用 API。

`DecisionWorkbench` 保持编排职责：

- 维护 `catalogQuery`、`selectedSkillId`、`selectedCaseId`。
- 选择 skill 后继续调用 `chooseAction("skill", { focusInspector: false })`。
- 继续决定导入和新建入口对应的 action mode。

## 非目标

- 不修改视觉系统。
- 不修改现有 CSS class。
- 不新增 catalog 业务能力。
- 不把 `SkillCatalog` 做成数据请求组件。

## 验收标准

- `SkillCatalog` 文件存在并独立导出组件。
- `DecisionWorkbench` 行数减少，左侧目录 JSX 不再内联在主组件里。
- TypeScript 类型检查通过。
- 现有 E2E 回归通过，证明导入、新建、切换 skill、筛选相关入口没有破坏。
