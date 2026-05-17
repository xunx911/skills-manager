# Run matrix CSV 导出设计

## 背景

Run matrix 已经能在 History mode 中展示当前筛选下的 `case x eval run` 结果，也支持 impact 过滤、分组、隐藏分数、隐藏 `Impact` 列和保存视图。下一步需要让用户把当前矩阵证据带出系统，用于复盘、评审、周报或外部表格分析。

## 用户目标

用户在历史页调整好矩阵视图后，可以点一次 `Export CSV` 下载当前视图对应的数据。导出的内容应该和用户正在看的矩阵一致，而不是重新导出一份未过滤、未按列配置处理的原始数据。

## 范围

- 在 `RunMatrixPanel` 控件区增加 `Export CSV` 按钮。
- 导出当前可见 rows。
- 导出当前可见 columns。
- `Impact column` 关闭时，CSV 也不包含 `Impact` 列。
- run 列使用和表头一致的语义：`variant label + variant version / eval set + eval set version`。
- 单元格结果使用中文业务值：`通过`、`不通过`、`未覆盖`。
- 文件名包含 skill slug，方便用户在下载目录里识别来源。

## 非范围

- 不新增后端导出接口。
- 不做 Excel、多 sheet、JSON 或 Parquet 导出。
- 不做异步导出任务。
- 不做跨 skill 聚合导出。
- 不做任意列拖拽或自定义指标列。

## 行为规则

1. 没有 matrix、没有 runs 或当前筛选后没有 rows 时，导出按钮禁用。
2. CSV 第一行为 header。
3. `Case` 列展示 case title。
4. `Versions` 列展示当前 matrix row 涉及的 case version number，如 `v1, v2`。
5. `Impact` 列只在当前视图显示 impact 时导出。
6. 每个 run 形成一列；没有覆盖该 case 的单元格导出 `未覆盖`。
7. CSV escaping 遵循标准规则：包含逗号、双引号或换行时用双引号包裹，内部双引号转义为两个双引号。

## 验收

- 单元测试覆盖 CSV escaping、隐藏 Impact 列、未覆盖单元格。
- E2E 覆盖真实浏览器下载，并检查文件名和 CSV 内容。
- 完整回归继续覆盖 API、unit、build、typecheck、audit、E2E 和 diff check。
