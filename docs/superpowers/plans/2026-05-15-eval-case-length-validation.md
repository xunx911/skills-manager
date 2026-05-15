# Eval case 文本长度校验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 eval case 的标题、输入、期望输出和 notes 增加服务端长度上限，并返回可回填字段的中文错误。

**Architecture:** 通过 FastAPI/Pydantic payload 类型统一校验，不在 Repository 层重复截断。错误仍走现有 `RequestValidationError -> field_errors` 映射，单条路径返回字段名，批量路径返回 `cases[n].field`。

**Tech Stack:** FastAPI、Pydantic v2、pytest、Next.js E2E 回归。

---

### Task 1: API 红绿测试

**Files:**
- Modify: `apps/api/tests/test_api_commands.py`

- [x] **Step 1: 写失败测试**
  - 新增单条 case 标题过长、批量 case input 过长、case version expected output 过长三条断言。

- [x] **Step 2: 跑红灯**
  - Run: `UV_NO_CACHE=1 uv run pytest tests/test_api_commands.py -k "eval_case_rejects_overlong"`
  - Expected: FAIL，因为当前 API 不限制这些字段长度。

### Task 2: 服务端长度规则和文案

**Files:**
- Modify: `apps/api/skillhub/api/main.py`

- [x] **Step 1: 增加 eval case 长度常量和 Pydantic Field**
  - `title=160`
  - `input_text=20000`
  - `expected_output=10000`
  - `notes=2000`

- [x] **Step 2: 扩展字段错误文案**
  - 单条字段返回 `标题最多 160 个字符。`
  - 批量字段返回 `第 1 行 Input 最多 20000 个字符。`

- [x] **Step 3: 跑绿灯**
  - Run: `UV_NO_CACHE=1 uv run pytest tests/test_api_commands.py -k "eval_case_rejects_overlong or batch_eval_cases_endpoint_returns_row_field_errors or request_validation_error_returns_field_errors"`
  - Expected: PASS。

### Task 3: 文档与完整验证

**Files:**
- Modify: `README.md`
- Modify: `docs/api-contract.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-ux-friction-audit-2026-05-14.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Modify: `.agent/logs/LOG.md`
- Modify: `.agent/tasks.json`
- Create: `.agent/tasks/TASK-056.json`

- [x] **Step 1: 更新中文文档和任务记录**
  - 写清字段上限、错误字段和后续不做自动截断。

- [x] **Step 2: 跑完整验证**
  - `cd apps/api && UV_NO_CACHE=1 uv run pytest`
  - `cd apps/web && npm run test:unit`
  - `cd apps/web && npm run typecheck`
  - `cd apps/web && npm run build`
  - `cd apps/web && npm audit --omit=dev`
  - `cd apps/web && npm run e2e`
  - `git diff --check`
  - `jq empty .agent/tasks.json .agent/tasks/TASK-056.json`
