# 后端字段错误映射设计

## 背景

TASK-050 已经让高频表单有客户端 required 错误摘要、字段旁错误、`aria-invalid` 和摘要链接聚焦。但服务端仍只返回人读的 `detail`，前端只能显示全局 notice，不能把唯一性、格式或请求体校验错误放回具体字段。

## 外部依据

- RFC 9457 的 Problem Details 建议把人读说明和机器可读扩展字段分开，客户端不应该解析 `detail` 来推断结构化信息。
- JSON:API error object 使用 `source.pointer` 定位请求内容中的错误来源。
- FastAPI 支持全局自定义 exception handler，可覆盖默认请求校验错误响应。
- GOV.UK / MOJ 表单错误实践要求 summary 和字段旁错误同时出现，且能从 summary 回到字段。

## 决策

- 本阶段不切换到完整 `application/problem+json`，保持现有 JSON 响应兼容。
- 失败响应继续保留 `detail`，新增 `field_errors`：

```json
{
  "detail": "Skill ID 已存在：code-reviewer",
  "field_errors": [
    {
      "field": "slug",
      "message": "Skill ID 已存在：code-reviewer",
      "code": "skill.slug_conflict"
    }
  ]
}
```

- `field` 使用前端表单控件的 `name`，第一阶段优先支持顶层字段。后续如果要覆盖嵌套 JSON，可增加 `pointer`，但前端仍优先用 `field` 回填表单。
- 领域唯一性错误用 `FieldInvariantError` 表示，repository 不关心 HTTP 格式。
- FastAPI `RequestValidationError` 统一映射为 `field_errors`，用于缺失字段、基础格式错误和 tags 数组长度错误。
- 前端 `apiSend` 抛出 `ApiError`，携带 `status` 和 `fieldErrors`。
- `ValidatedForm` 只捕获带 `fieldErrors` 的 `ApiError`，把它映射到当前 form 内同名控件；普通命令失败仍交给全局 notice。

## 范围

本阶段覆盖：

- `POST /api/skills` 的重复 `slug`。
- `PATCH /api/skills/{skill_id}` 的重复 `slug`。
- FastAPI 请求体校验错误。
- 新建 skill / 编辑 skill 表单的服务端字段错误摘要。

暂不覆盖：

- 导入 bundle 的 frontmatter 逐字段错误。
- 批量 case 的逐行错误。
- 所有领域错误到字段的完整映射。
- 全面 problem details 媒体类型迁移。

## 验收

- API 红测先失败于缺少 `field_errors` 和更新 skill slug 冲突 500。
- E2E 红测先失败于重复 Skill ID 后表单没有错误摘要。
- 绿色后，重复 Skill ID 会在 inspector 表单显示错误摘要、聚焦摘要、标记 `slug` 为 `aria-invalid`，摘要链接可回到 `Skill ID` 字段。
