# 导入 bundle 字段错误映射第一阶段设计

## 背景

TASK-050 到 TASK-052 已经建立了 `ValidatedForm + WorkbenchField + field_errors` 的基础路径：required、重复 Skill ID、Skill ID 格式和 tag 格式都能回填到用户需要修改的字段。但标准 Skill bundle 导入仍有一个缺口：`SKILL.md` 缺失、frontmatter 不合法、zip 无法读取时，用户只能看到全局失败提示。

这类错误虽然发生在 `SKILL.md` 内部，但当前页面还没有文件树编辑器或 frontmatter 行级编辑器。第一阶段最准确的可操作位置是上传控件本身：folder 导入错误回到 `folder_files`，zip 导入错误回到 `zip_file`。

## 外部依据

- GOV.UK Error Summary 要求错误摘要链接到具体字段，并在字段旁重复同一条错误。
- GOV.UK File Upload 把上传失败作为上传字段的校验错误处理，而不是只给页面级 toast。
- JSON:API error object 和 RFC 9457 都强调人读错误和机器可读定位需要分开；客户端不应该解析 `detail` 文案猜字段。

## 契约

后端继续保留兼容字段：

```json
{
  "detail": "Skill description is required.",
  "field_errors": [
    {
      "field": "folder_files",
      "message": "SKILL.md frontmatter 需要 description。",
      "code": "skill_import.description_required"
    }
  ]
}
```

### 字段映射

- `source.kind = "files"`：所有 bundle 解析错误映射到 `folder_files`。
- `source.kind = "zip"`：所有 bundle 解析错误映射到 `zip_file`。

### 第一阶段错误码

- `skill_import.skill_md_missing`
- `skill_import.skill_md_not_utf8`
- `skill_import.frontmatter_missing`
- `skill_import.frontmatter_empty`
- `skill_import.frontmatter_unclosed`
- `skill_import.name_invalid`
- `skill_import.description_required`
- `skill_import.description_too_long`
- `skill_import.zip_unreadable`
- fallback：`skill_import.invalid_bundle`

## 前端策略

前端不在第一阶段解析 zip 或 frontmatter。它只负责：

1. 继续用现有 preview 做轻量可见反馈。
2. 提交导入时让 `ApiError.fieldErrors` 冒泡给 `ValidatedForm`。
3. `ValidatedForm` 根据字段名把错误摘要、字段旁错误和 `aria-invalid` 交给 `FileField`。

这样可以保持服务端为权威解析器，避免前后端的 `SKILL.md` 规则分叉。

## 暂不覆盖

- `POST /api/variant-versions` 的 bundle 上传字段错误回填。
- `SKILL.md` frontmatter 的行号、列号和 YAML AST 级定位。
- 前端 zip 内容预校验。
- 批量 case 行级错误。
- 完整 problem details content type 迁移。

## 验收

- API 红测先失败于缺少 `field_errors`。
- folder 导入缺少或错误 frontmatter 后，响应包含 `field_errors[0].field = "folder_files"`。
- zip 无法读取后，响应包含 `field_errors[0].field = "zip_file"`。
- E2E 红测先失败于页面没有错误摘要；绿色后，上传不合法 bundle 会聚焦错误摘要，并把 `folder_files` 标记为 `aria-invalid`。
