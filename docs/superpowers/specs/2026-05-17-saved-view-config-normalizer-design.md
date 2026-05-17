# Saved View Config Normalizer 设计

## 背景

`SqlSkillRepository` 目前同时负责数据库读写、权限相关查询、实验矩阵读模型、saved view 写入和 saved view config 规范化。`matrix_show_impact`、`matrix_show_score`、`matrix_show_summary` 和 run comparison 指针近期多次修改，继续把 allowlist 埋在 2000+ 行 repository 里，会让后续产品配置扩展更容易漏同步。

## 目标

- 把 saved view 类型校验和 config 规范化抽到小模块，形成单一契约入口。
- 保持 API、DB schema、返回结构和用户行为不变。
- 给新模块补直接单元测试，覆盖 trim、空值、`all`、非字符串值、未知 key 和支持的 run history keys。
- `SqlSkillRepository` 只调用新模块，不再内联维护 allowlist。

## 非目标

- 不拆整个 repository。
- 不新增 saved view 类型。
- 不改变前端 saved view 行为。
- 不改 README，因为没有用户可见变化。

## 设计

新增 `apps/api/skillhub/application/saved_views.py`：

- `validate_saved_view_type(view_type: str) -> None`
- `normalize_saved_view_config(config: Mapping[str, object]) -> dict[str, str]`

repository 保持对 `InvariantError` 的现有错误语义，只替换内部调用点。后续如果新增多维表格 view 或自定义指标列，只需要在这个模块调整契约和测试。

## 验收

- 新单元测试先红后绿。
- `tests/test_sql_repository.py -k saved_run_view` 和 `tests/test_api_commands.py -k saved_run_view` 通过。
- 完整 API、Web unit、build、typecheck、audit、E2E、diff check 和任务 JSON 检查通过。
