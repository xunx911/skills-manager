# Saved View Config Normalizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 saved view 类型校验和 config 规范化从超大的 SQL repository 抽到独立应用层模块，并用直接单元测试锁住契约。

**Architecture:** 新增 `skillhub.application.saved_views`，由纯函数维护 supported view types 和 config allowlist。`SqlSkillRepository` 只调用这些函数，数据库写入和 API 行为保持不变。

**Tech Stack:** Python 3.12、pytest、SQLAlchemy repository、现有 `FieldInvariantError` / `InvariantError`。

---

### Task 1: 建立任务记录

**Files:**
- Create: `.agent/tasks/TASK-077.json`
- Modify: `.agent/tasks.json`
- Create: `docs/superpowers/specs/2026-05-17-saved-view-config-normalizer-design.md`
- Create: `docs/superpowers/plans/2026-05-17-saved-view-config-normalizer.md`

- [ ] **Step 1: 记录任务范围**

TASK-077 说明只抽 saved view config normalizer，不拆整个 repository、不改用户可见行为。

### Task 2: 写红灯测试

**Files:**
- Create: `apps/api/tests/test_saved_views.py`

- [ ] **Step 1: 添加 helper 契约测试**

测试应导入尚未存在的 `normalize_saved_view_config` 和 `validate_saved_view_type`，覆盖：

```python
def test_normalize_saved_view_config_keeps_supported_non_default_strings():
    config = normalize_saved_view_config({
        "variant_version_id": " version-a ",
        "eval_set_version_id": "all",
        "matrix_show_summary": "false",
        "compare_candidate_run_id": "run-candidate",
        "unknown": "kept?",
        "status": "",
        "matrix_show_score": False,
    })

    assert config == {
        "variant_version_id": "version-a",
        "matrix_show_summary": "false",
        "compare_candidate_run_id": "run-candidate",
    }
```

- [ ] **Step 2: 验证红灯**

Run:

```bash
cd apps/api && UV_NO_CACHE=1 uv run pytest tests/test_saved_views.py
```

Expected: FAIL with import/module not found。

### Task 3: 实现 helper 并接入 repository

**Files:**
- Create: `apps/api/skillhub/application/saved_views.py`
- Modify: `apps/api/skillhub/infrastructure/db/repositories.py`

- [ ] **Step 1: 新增纯函数模块**

实现 `SUPPORTED_SAVED_VIEW_TYPES`、`SAVED_VIEW_CONFIG_KEYS`、`validate_saved_view_type` 和 `normalize_saved_view_config`。

- [ ] **Step 2: repository 改为调用 helper**

删除 `_validate_saved_view_type` 和 `_saved_view_config` 方法，`list_saved_views` / `create_saved_view` 改为调用 import 的纯函数。

### Task 4: 验证和提交

**Files:**
- Modify: `.agent/tasks/TASK-077.json`
- Modify: `.agent/logs/LOG.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`

- [ ] **Step 1: 目标验证**

Run:

```bash
cd apps/api && UV_NO_CACHE=1 uv run pytest tests/test_saved_views.py
cd apps/api && UV_NO_CACHE=1 uv run pytest tests/test_sql_repository.py -k saved_run_view
cd apps/api && UV_NO_CACHE=1 uv run pytest tests/test_api_commands.py -k saved_run_view
```

Expected: all passed。

- [ ] **Step 2: 完整验证**

Run:

```bash
cd apps/api && UV_NO_CACHE=1 uv run pytest
cd apps/web && npm run test:unit
cd apps/web && npm run build
cd apps/web && npm audit --omit=dev
cd apps/web && npm run typecheck
cd apps/web && npm run e2e
git diff --check
jq empty .agent/tasks.json .agent/tasks/TASK-077.json
```

Expected: all passed。
