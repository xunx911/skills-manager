import unittest
from base64 import b64encode
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi.testclient import TestClient

from skillhub.api.main import create_app, create_local_sqlite_engine


class ApiCommandTest(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(create_app(create_local_sqlite_engine()), headers={"X-SkillHub-Actor": "tester"})

    def test_create_skill_duplicate_slug_returns_slug_field_error(self):
        self.create_skill("duplicate-slug-api")

        response = self.client.post(
            "/api/skills",
            json=self.skill_payload("duplicate-slug-api", digest="digest-duplicate"),
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["field_errors"],
            [
                {
                    "field": "slug",
                    "message": "Skill ID 已存在：duplicate-slug-api",
                    "code": "skill.slug_conflict",
                }
            ],
        )

    def test_update_skill_duplicate_slug_returns_slug_field_error(self):
        first = self.create_skill("editable-slug-api")
        self.create_skill("taken-slug-api", digest="digest-taken")

        response = self.client.patch(
            f"/api/skills/{first['skill_id']}",
            json={
                "slug": "taken-slug-api",
                "owner_ref": "skillhub-lab",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["field_errors"][0]["field"], "slug")
        self.assertEqual(response.json()["field_errors"][0]["code"], "skill.slug_conflict")

    def test_request_validation_error_returns_field_errors(self):
        response = self.client.post(
            "/api/skills",
            json={
                "owner_ref": "skillhub-lab",
                "variant_name": "Variant A",
                "variant_label": "Baseline",
                "variant_summary": "Baseline maintained answer.",
                "tags": ["codex"],
                "content_ref": {
                    "kind": "skill_bundle",
                    "locator": "memory:missing-slug",
                    "digest": "digest-missing-slug",
                },
                "change_summary": "Initial version.",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["field_errors"][0]["field"], "slug")

    def test_create_skill_rejects_invalid_slug_format(self):
        response = self.client.post(
            "/api/skills",
            json=self.skill_payload("Bad Skill"),
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json()["field_errors"][0],
            {
                "field": "slug",
                "message": "Skill ID 只能使用小写字母、数字和连字符，且必须以字母或数字开头，最多 64 个字符。",
                "code": "request.string_pattern_mismatch",
            },
        )

    def test_create_skill_rejects_invalid_tag_format(self):
        payload = self.skill_payload("invalid-tag-format")
        payload["tags"] = ["codex", "bad tag"]

        response = self.client.post("/api/skills", json=payload)

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["field_errors"][0]["field"], "tags")
        self.assertEqual(
            response.json()["field_errors"][0]["message"],
            "约束标签只能使用字母、数字、点、下划线和连字符，每个最多 64 个字符。",
        )

    def test_identity_ref_fields_reject_invalid_values(self):
        create_payload = self.skill_payload("identity-ref-create")
        create_payload["owner_ref"] = "team name"

        created = self.client.post("/api/skills", json=create_payload)

        self.assertEqual(created.status_code, 422)
        self.assertEqual(created.json()["field_errors"][0]["field"], "owner_ref")
        self.assertIn("归属只能使用", created.json()["field_errors"][0]["message"])

        skill = self.create_skill("identity-ref-fields")
        updated = self.client.patch(
            f"/api/skills/{skill['skill_id']}",
            json={"slug": "identity-ref-fields", "owner_ref": "platform team"},
        )

        self.assertEqual(updated.status_code, 422)
        self.assertEqual(updated.json()["field_errors"][0]["field"], "owner_ref")
        self.assertIn("归属只能使用", updated.json()["field_errors"][0]["message"])

        assigned = self.client.post(
            f"/api/skills/{skill['skill_id']}/role-assignments",
            json={"subject_id": "qa reviewer", "role": "evaluator"},
        )

        self.assertEqual(assigned.status_code, 422)
        self.assertEqual(assigned.json()["field_errors"][0]["field"], "subject_id")
        self.assertIn("成员只能使用", assigned.json()["field_errors"][0]["message"])

    def test_create_skill_rejects_empty_tags_with_tags_field_error(self):
        payload = self.skill_payload("empty-tags-format")
        payload["tags"] = []

        response = self.client.post("/api/skills", json=payload)

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["field_errors"][0]["field"], "tags")
        self.assertEqual(response.json()["field_errors"][0]["message"], "至少填写一个约束标签。")

    def test_variant_write_fields_return_field_errors(self):
        skill = self.create_skill("variant-field-limits")

        overlong_label = self.client.post(
            "/api/variants",
            json={
                "skill_id": skill["skill_id"],
                "name": "Strict",
                "label": "x" * 81,
                "summary": "Strict reviewer.",
                "tags": ["codex", "strict"],
                "content_ref": {
                    "kind": "skill_bundle",
                    "locator": "memory:strict",
                    "digest": "digest-strict",
                },
                "change_summary": "Add strict variant.",
            },
        )

        self.assertEqual(overlong_label.status_code, 422)
        self.assertEqual(
            overlong_label.json()["field_errors"][0],
            {
                "field": "label",
                "message": "变体名称最多 80 个字符。",
                "code": "request.string_too_long",
            },
        )

        overlong_summary = self.client.post(
            "/api/variants",
            json={
                "skill_id": skill["skill_id"],
                "name": "Strict",
                "label": "Strict",
                "summary": "x" * 1001,
                "tags": ["codex", "strict"],
                "content_ref": {
                    "kind": "skill_bundle",
                    "locator": "memory:strict-summary",
                    "digest": "digest-strict-summary",
                },
                "change_summary": "Add strict variant.",
            },
        )

        self.assertEqual(overlong_summary.status_code, 422)
        self.assertEqual(
            overlong_summary.json()["field_errors"][0],
            {
                "field": "summary",
                "message": "说明最多 1000 个字符。",
                "code": "request.string_too_long",
            },
        )

        overlong_change_summary = self.client.post(
            "/api/variant-versions",
            json={
                "variant_id": skill["variant_id"],
                "content_ref": {
                    "kind": "skill_bundle",
                    "locator": "memory:candidate",
                    "digest": "digest-candidate",
                },
                "change_summary": "x" * 1001,
            },
        )

        self.assertEqual(overlong_change_summary.status_code, 422)
        self.assertEqual(
            overlong_change_summary.json()["field_errors"][0],
            {
                "field": "change_summary",
                "message": "版本说明最多 1000 个字符。",
                "code": "request.string_too_long",
            },
        )

    def test_command_flow_records_eval_run(self):
        skill = self.create_skill("code-reviewer")
        candidate = self.client.post(
            "/api/variant-versions",
            json={
                "variant_id": skill["variant_id"],
                "content_ref": {
                    "kind": "skill_bundle",
                    "locator": "memory:candidate",
                    "digest": "digest-candidate",
                },
                "change_summary": "Candidate version.",
                "make_current": False,
                "actor": "tester",
            },
        ).json()
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: missing owner check",
                "input_text": "diff --git a/api.ts b/api.ts",
                "expected_output": "Should flag missing ownerId filter.",
                "actor": "tester",
            },
        ).json()

        run_response = self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": candidate["variant_version_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: True},
                "actor": "tester",
            },
        )

        self.assertEqual(run_response.status_code, 200)
        self.assertEqual(run_response.json()["passed"], 1)
        self.assertEqual(run_response.json()["failed"], 0)

    def test_batch_eval_cases_endpoint_creates_one_snapshot(self):
        skill = self.create_skill("batch-case-reviewer")

        response = self.client.post(
            "/api/eval-cases/batch",
            json={
                "skill_id": skill["skill_id"],
                "actor": "tester",
                "cases": [
                    {
                        "title": "PR: missing tenant scope",
                        "input_text": "Project.all()",
                        "expected_output": "Flag missing tenant scope.",
                        "notes": "Imported from review backlog.",
                    },
                    {
                        "title": "PR: token logging",
                        "input_text": "console.log(token)",
                        "expected_output": "Flag token logging.",
                    },
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["created"]), 2)
        detail = self.client.get(f"/api/eval-set-versions/{body['eval_set_version_id']}").json()
        skill_detail = self.client.get(f"/api/skills/{skill['skill_id']}").json()

        self.assertEqual([item["case"]["title"] for item in detail["cases"]], ["PR: missing tenant scope", "PR: token logging"])
        self.assertEqual(skill_detail["eval_sets"][0]["current_version"]["id"], body["eval_set_version_id"])
        self.assertEqual(len(skill_detail["eval_sets"][0]["versions"]), 2)

    def test_batch_eval_cases_endpoint_returns_row_field_errors(self):
        skill = self.create_skill("batch-case-errors")

        response = self.client.post(
            "/api/eval-cases/batch",
            json={
                "skill_id": skill["skill_id"],
                "cases": [
                    {
                        "title": "",
                        "input_text": "Project.all()",
                        "expected_output": "Flag missing tenant scope.",
                    },
                    {
                        "title": "PR: token logging",
                        "input_text": "console.log(token)",
                    },
                ],
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json()["field_errors"],
            [
                {
                    "field": "cases[0].title",
                    "message": "第 1 行填写标题。",
                    "code": "request.string_too_short",
                },
                {
                    "field": "cases[1].expected_output",
                    "message": "第 2 行填写 Expected output。",
                    "code": "request.missing",
                },
            ],
        )

    def test_eval_case_rejects_overlong_title(self):
        skill = self.create_skill("case-title-too-long")

        response = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "x" * 161,
                "input_text": "diff --git a/api.ts b/api.ts",
                "expected_output": "Flag missing tenant scope.",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json()["field_errors"][0],
            {
                "field": "title",
                "message": "标题最多 160 个字符。",
                "code": "request.string_too_long",
            },
        )

    def test_eval_case_rejects_overlong_batch_input_with_row_field_error(self):
        skill = self.create_skill("case-batch-input-too-long")

        response = self.client.post(
            "/api/eval-cases/batch",
            json={
                "skill_id": skill["skill_id"],
                "cases": [
                    {
                        "title": "PR: pasted huge diff",
                        "input_text": "x" * 20001,
                        "expected_output": "Flag missing tenant scope.",
                    }
                ],
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json()["field_errors"][0],
            {
                "field": "cases[0].input_text",
                "message": "第 1 行 Input 最多 20000 个字符。",
                "code": "request.string_too_long",
            },
        )

    def test_eval_case_rejects_overlong_expected_output_when_updating_version(self):
        skill = self.create_skill("case-update-expected-too-long")
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: missing tenant scope",
                "input_text": "Project.all()",
                "expected_output": "Flag missing tenant scope.",
            },
        ).json()

        response = self.client.patch(
            f"/api/eval-cases/{case['eval_case_id']}",
            json={
                "case_id": case["eval_case_id"],
                "title": "PR: missing tenant scope",
                "input_text": "Project.all()",
                "expected_output": "x" * 10001,
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json()["field_errors"][0],
            {
                "field": "expected_output",
                "message": "Expected output 最多 10000 个字符。",
                "code": "request.string_too_long",
            },
        )

    def test_read_flow_returns_hub_skill_eval_set_and_eval_run_details(self):
        skill = self.create_skill("security-reviewer", digest="digest-security")
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: token leak",
                "input_text": "diff --git a/auth.ts b/auth.ts",
                "expected_output": "Should flag token logging.",
                "actor": "tester",
            },
        ).json()
        run = self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": skill["variant_version_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: True},
                "actor": "tester",
            },
        ).json()

        hub = self.client.get("/api/skills")
        detail = self.client.get(f"/api/skills/{skill['skill_id']}")
        eval_set = self.client.get(f"/api/eval-set-versions/{case['eval_set_version_id']}")
        eval_run = self.client.get(f"/api/eval-runs/{run['eval_run_id']}")

        self.assertEqual(hub.status_code, 200)
        self.assertEqual(hub.json()[0]["skill"]["slug"], "security-reviewer")
        self.assertEqual(hub.json()[0]["latest_accepted_eval_run"]["id"], run["eval_run_id"])
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["variants"][0]["versions"][0]["version_number"], 1)
        self.assertEqual(eval_set.status_code, 200)
        self.assertEqual(eval_set.json()["cases"][0]["case"]["title"], "PR: token leak")
        self.assertEqual(eval_run.status_code, 200)
        self.assertTrue(eval_run.json()["case_results"][0]["result"]["passed"])

    def test_eval_run_history_filters_by_variant_eval_set_strategy_status(self):
        skill = self.create_skill("history-reviewer")
        first_case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: missing tenant filter",
                "input_text": "return Project.all()",
                "expected_output": "Flag missing tenant scope.",
                "actor": "tester",
            },
        ).json()
        second_version = self.client.post(
            "/api/variant-versions",
            json={
                "variant_id": skill["variant_id"],
                "content_ref": {"kind": "skill_bundle", "locator": "memory:v2", "digest": "digest-v2"},
                "change_summary": "Add stricter review rules.",
                "make_current": True,
                "actor": "tester",
            },
        ).json()
        first_run = self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": skill["variant_version_id"],
                "eval_set_version_id": first_case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {first_case["eval_case_version_id"]: True},
                "actor": "tester",
            },
        ).json()
        second_run = self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": second_version["variant_version_id"],
                "eval_set_version_id": first_case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {first_case["eval_case_version_id"]: False},
                "actor": "tester",
            },
        ).json()

        history = self.client.get(
            f"/api/skills/{skill['skill_id']}/eval-runs",
            params={
                "variant_version_id": second_version["variant_version_id"],
                "eval_set_version_id": first_case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "status": "finished",
            },
        )

        self.assertEqual(history.status_code, 200)
        self.assertEqual([row["eval_run"]["id"] for row in history.json()["runs"]], [second_run["eval_run_id"]])
        row = history.json()["runs"][0]
        self.assertEqual(row["variant_version"]["version_number"], 2)
        self.assertEqual(row["eval_set_version"]["id"], first_case["eval_set_version_id"])
        self.assertEqual(row["variant"]["label"], "Baseline")
        self.assertEqual(row["eval_run"]["summary"], {"passed": 0, "failed": 1, "total": 1})
        self.assertNotEqual(first_run["eval_run_id"], second_run["eval_run_id"])

    def test_eval_run_history_orders_newest_first_and_limits_results(self):
        skill = self.create_skill("history-limit-reviewer")
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: missing owner check",
                "input_text": "Project.query.all()",
                "expected_output": "Flag missing owner check.",
                "actor": "tester",
            },
        ).json()
        run_ids = []
        for _ in range(3):
            run = self.client.post(
                "/api/eval-runs",
                json={
                    "variant_version_id": skill["variant_version_id"],
                    "eval_set_version_id": case["eval_set_version_id"],
                    "strategy": "manual_pass_fail",
                    "results": {case["eval_case_version_id"]: True},
                    "actor": "tester",
                },
            ).json()
            run_ids.append(run["eval_run_id"])

        history = self.client.get(f"/api/skills/{skill['skill_id']}/eval-runs", params={"limit": 2})

        self.assertEqual(history.status_code, 200)
        self.assertEqual([row["eval_run"]["id"] for row in history.json()["runs"]], list(reversed(run_ids[-2:])))

    def test_saved_run_view_endpoints_create_list_and_delete_view(self):
        skill = self.create_skill("saved-view-reviewer")

        created = self.client.post(
            "/api/saved-views",
            json={
                "skill_id": skill["skill_id"],
                "name": "Candidate runs",
                "view_type": "run_history",
                "config": {
                    "variant_version_id": skill["variant_version_id"],
                    "eval_set_version_id": "all",
                    "strategy": "manual_pass_fail",
                    "status": "",
                    "matrix_group_by": "impact",
                    "matrix_impact": "fixed",
                    "matrix_show_score": "false",
                    "unknown": "ignored",
                },
                "actor": "tester",
            },
        )

        self.assertEqual(created.status_code, 200)
        view = created.json()
        self.assertEqual(view["name"], "Candidate runs")
        self.assertEqual(
            view["config"],
            {
                "variant_version_id": skill["variant_version_id"],
                "strategy": "manual_pass_fail",
                "matrix_group_by": "impact",
                "matrix_impact": "fixed",
                "matrix_show_score": "false",
            },
        )

        duplicate = self.client.post(
            "/api/saved-views",
            json={
                "skill_id": skill["skill_id"],
                "name": "Candidate runs",
                "view_type": "run_history",
                "config": {},
                "actor": "tester",
            },
        )
        listed = self.client.get(f"/api/skills/{skill['skill_id']}/saved-views", params={"view_type": "run_history"})
        deleted = self.client.delete(f"/api/saved-views/{view['id']}")
        listed_after_delete = self.client.get(f"/api/skills/{skill['skill_id']}/saved-views", params={"view_type": "run_history"})

        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(listed.status_code, 200)
        self.assertEqual([item["id"] for item in listed.json()], [view["id"]])
        self.assertEqual(listed.json()[0]["config"], view["config"])
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(deleted.json(), {"ok": True})
        self.assertEqual(listed_after_delete.json(), [])
        self.assertEqual(
            duplicate.json()["field_errors"][0],
            {
                "field": "name",
                "message": "保存视图名称已存在。",
                "code": "saved_view.name_conflict",
            },
        )

    def test_saved_run_view_rejects_overlong_name(self):
        skill = self.create_skill("saved-view-name-too-long")

        response = self.client.post(
            "/api/saved-views",
            json={
                "skill_id": skill["skill_id"],
                "name": "x" * 81,
                "view_type": "run_history",
                "config": {},
                "actor": "tester",
            },
        )
        blank = self.client.post(
            "/api/saved-views",
            json={
                "skill_id": skill["skill_id"],
                "name": "   ",
                "view_type": "run_history",
                "config": {},
                "actor": "tester",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json()["field_errors"][0],
            {
                "field": "name",
                "message": "保存视图名称最多 80 个字符。",
                "code": "request.string_too_long",
            },
        )
        self.assertEqual(blank.status_code, 400)
        self.assertEqual(
            blank.json()["field_errors"][0],
            {
                "field": "name",
                "message": "填写保存视图名称。",
                "code": "saved_view.name_required",
            },
        )

    def test_eval_case_history_returns_versions_and_eval_set_membership(self):
        skill = self.create_skill("case-history-reviewer")
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: stale title",
                "input_text": "return Project.find_many()",
                "expected_output": "Flag missing tenant scope.",
                "notes": "Original customer regression.",
                "actor": "tester",
            },
        ).json()
        revised = self.client.patch(
            f"/api/eval-cases/{case['eval_case_id']}",
            json={
                "case_id": case["eval_case_id"],
                "title": "PR: edited owner filter",
                "input_text": "return Project.find_many({})",
                "expected_output": "Must flag missing owner or tenant scope.",
                "notes": "Clarified expected finding.",
                "actor": "tester",
                "make_current": True,
            },
        ).json()

        history = self.client.get(f"/api/eval-cases/{case['eval_case_id']}/versions")

        self.assertEqual(history.status_code, 200)
        payload = history.json()
        self.assertEqual(payload["case"]["title"], "PR: edited owner filter")
        self.assertEqual([item["case_version"]["version_number"] for item in payload["versions"]], [2, 1])
        self.assertEqual(payload["versions"][0]["case_version"]["notes"], "Clarified expected finding.")
        self.assertIn("missing owner", payload["versions"][0]["case_version"]["expected_output_artifact"]["content_text"])
        self.assertEqual(payload["versions"][0]["included_in_eval_set_versions"][0]["id"], revised["eval_set_version_id"])
        self.assertEqual(payload["versions"][1]["included_in_eval_set_versions"][0]["id"], case["eval_set_version_id"])

    def test_eval_case_history_reads_archived_case(self):
        skill = self.create_skill("archived-case-history-reviewer")
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: archive me",
                "input_text": "rename only",
                "expected_output": "No finding",
                "actor": "tester",
            },
        ).json()
        self.client.delete(f"/api/eval-cases/{case['eval_case_id']}")

        history = self.client.get(f"/api/eval-cases/{case['eval_case_id']}/versions")

        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.json()["case"]["lifecycle_status"], "archived")
        self.assertEqual(history.json()["versions"][0]["case_version"]["version_number"], 1)

    def test_eval_run_matrix_endpoint_respects_variant_filter(self):
        skill = self.create_skill("run-matrix-reviewer")
        first_case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: missing tenant scope",
                "input_text": "Project.all()",
                "expected_output": "Flag missing tenant scope.",
                "actor": "tester",
            },
        ).json()
        second_case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: token logging",
                "input_text": "console.log(token)",
                "expected_output": "Flag token logging.",
                "actor": "tester",
            },
        ).json()
        candidate = self.client.post(
            "/api/variant-versions",
            json={
                "variant_id": skill["variant_id"],
                "content_ref": {
                    "kind": "skill_bundle",
                    "locator": "memory:candidate",
                    "digest": "digest-candidate",
                },
                "change_summary": "Candidate version.",
                "make_current": False,
                "actor": "tester",
            },
        ).json()
        self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": skill["variant_version_id"],
                "eval_set_version_id": second_case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {
                    first_case["eval_case_version_id"]: False,
                    second_case["eval_case_version_id"]: True,
                },
                "actor": "tester",
            },
        )
        candidate_run = self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": candidate["variant_version_id"],
                "eval_set_version_id": second_case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {
                    first_case["eval_case_version_id"]: True,
                    second_case["eval_case_version_id"]: True,
                },
                "actor": "tester",
            },
        ).json()

        matrix = self.client.get(
            f"/api/skills/{skill['skill_id']}/eval-run-matrix",
            params={"variant_version_id": candidate["variant_version_id"]},
        )

        self.assertEqual(matrix.status_code, 200)
        body = matrix.json()
        self.assertEqual([row["eval_run"]["id"] for row in body["runs"]], [candidate_run["eval_run_id"]])
        self.assertEqual([row["case"]["title"] for row in body["cases"]], ["PR: missing tenant scope", "PR: token logging"])
        self.assertEqual(len(body["cells"]), 2)
        self.assertTrue(all(cell["passed"] for cell in body["cells"]))

    def test_restore_eval_case_version_from_history(self):
        skill = self.create_skill("restore-case-history-reviewer")
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: restore old wording",
                "input_text": "old input",
                "expected_output": "old expectation",
                "notes": "Original regression.",
                "actor": "tester",
            },
        ).json()
        self.client.patch(
            f"/api/eval-cases/{case['eval_case_id']}",
            json={
                "case_id": case["eval_case_id"],
                "input_text": "new input",
                "expected_output": "new expectation",
                "notes": "Bad edit.",
                "actor": "tester",
                "make_current": True,
            },
        )

        restored = self.client.post(
            f"/api/eval-cases/{case['eval_case_id']}/restores",
            json={
                "source_case_version_id": case["eval_case_version_id"],
                "notes": "Restore old expectation.",
                "actor": "tester",
            },
        )

        self.assertEqual(restored.status_code, 200)
        payload = restored.json()
        self.assertNotEqual(payload["eval_case_version_id"], case["eval_case_version_id"])
        history = self.client.get(f"/api/eval-cases/{case['eval_case_id']}/versions").json()
        self.assertEqual([item["case_version"]["version_number"] for item in history["versions"]], [3, 2, 1])
        self.assertEqual(history["versions"][0]["case_version"]["expected_output_artifact"]["content_text"], "old expectation")
        current_eval_set = self.client.get(f"/api/eval-set-versions/{payload['eval_set_version_id']}").json()
        self.assertEqual(current_eval_set["cases"][0]["case_version"]["id"], payload["eval_case_version_id"])
        self.assertEqual(current_eval_set["cases"][0]["case_version"]["expected_output_artifact"]["content_text"], "old expectation")

    def test_restore_eval_case_version_rejects_cross_case_source(self):
        skill = self.create_skill("restore-cross-case-reviewer")
        first = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "First",
                "input_text": "first input",
                "expected_output": "first expectation",
                "actor": "tester",
            },
        ).json()
        second = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "Second",
                "input_text": "second input",
                "expected_output": "second expectation",
                "actor": "tester",
            },
        ).json()

        restored = self.client.post(
            f"/api/eval-cases/{first['eval_case_id']}/restores",
            json={
                "source_case_version_id": second["eval_case_version_id"],
                "actor": "tester",
            },
        )

        self.assertEqual(restored.status_code, 404)
        self.assertIn("EvalCaseVersion not found", restored.json()["detail"])

    def test_restore_eval_case_version_rejects_archived_case(self):
        skill = self.create_skill("restore-archived-case-reviewer")
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "Archived",
                "input_text": "input",
                "expected_output": "expected",
                "actor": "tester",
            },
        ).json()
        self.client.delete(f"/api/eval-cases/{case['eval_case_id']}")

        restored = self.client.post(
            f"/api/eval-cases/{case['eval_case_id']}/restores",
            json={
                "source_case_version_id": case["eval_case_version_id"],
                "actor": "tester",
            },
        )

        self.assertEqual(restored.status_code, 400)
        self.assertIn("Archived eval cases cannot be restored", restored.json()["detail"])

    def test_promote_rejects_other_variant_version(self):
        first = self.create_skill("code-reviewer")
        second = self.create_skill("security-reviewer", digest="digest-security")

        response = self.client.post(
            "/api/variants/promotions",
            json={
                "variant_id": first["variant_id"],
                "version_id": second["variant_version_id"],
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("own version", response.json()["detail"])

    def test_promotion_review_endpoint_returns_case_impact(self):
        imported = self.import_standard_skill_bundle("promotion-api-review")
        detail = self.client.get(f"/api/skills/{imported['skill_id']}").json()
        variant = detail["summary"]["default_variant"]
        current_version = variant["current_version"]
        candidate = self.client.post(
            "/api/variant-versions",
            json={
                "variant_id": variant["id"],
                "source": {
                    "kind": "files",
                    "name": "promotion-api-review",
                    "files": [
                        {
                            "path": "promotion-api-review/SKILL.md",
                            "content_text": (
                                "---\n"
                                "name: promotion-api-review\n"
                                "description: Review pull requests for auth and data access regressions.\n"
                                "---\n"
                                "# Security Reviewing\n"
                                "Flag auth regressions and tenant leaks first.\n"
                            ),
                        },
                        {
                            "path": "promotion-api-review/references/checklist.md",
                            "content_text": "Check owner filters and tenant filters.\n",
                        },
                    ],
                },
                "change_summary": "Add tenant leak guidance.",
                "make_current": False,
                "actor": "tester",
            },
        ).json()
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": imported["skill_id"],
                "title": "PR: missing tenant filter",
                "input_text": "Project.all()",
                "expected_output": "Flag missing tenant scope.",
                "actor": "tester",
            },
        ).json()
        self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": current_version["id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: False},
                "actor": "tester",
            },
        )
        candidate_run = self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": candidate["variant_version_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: True},
                "actor": "tester",
            },
        ).json()

        response = self.client.get(
            f"/api/variants/{variant['id']}/promotion-review",
            params={
                "candidate_version_id": candidate["variant_version_id"],
                "eval_set_version_id": case["eval_set_version_id"],
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["candidate_run"]["id"], candidate_run["eval_run_id"])
        self.assertEqual(payload["readiness"]["status"], "ready")
        self.assertEqual(payload["comparison_summary"]["fixed"], 1)
        self.assertEqual(payload["case_comparisons"][0]["change_label"], "修复")
        self.assertEqual(payload["bundle_diff"]["summary"]["changed"], 2)

    def test_promotion_command_records_decision(self):
        imported = self.import_standard_skill_bundle("promotion-api-command")
        detail = self.client.get(f"/api/skills/{imported['skill_id']}").json()
        variant = detail["summary"]["default_variant"]
        current_version = variant["current_version"]
        candidate = self.client.post(
            "/api/variant-versions",
            json={
                "variant_id": variant["id"],
                "source": {
                    "kind": "files",
                    "name": "promotion-api-command",
                    "files": [
                        {
                            "path": "promotion-api-command/SKILL.md",
                            "content_text": (
                                "---\n"
                                "name: promotion-api-command\n"
                                "description: Review pull requests for auth and data access regressions.\n"
                                "---\n"
                                "# Security Reviewing\n"
                                "Flag auth regressions and tenant leaks first.\n"
                            ),
                        },
                        {
                            "path": "promotion-api-command/references/checklist.md",
                            "content_text": "Check owner filters and tenant filters.\n",
                        },
                    ],
                },
                "change_summary": "Add tenant leak guidance.",
                "make_current": False,
                "actor": "tester",
            },
        ).json()
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": imported["skill_id"],
                "title": "PR: missing tenant filter",
                "input_text": "Project.all()",
                "expected_output": "Flag missing tenant scope.",
                "actor": "tester",
            },
        ).json()
        self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": current_version["id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: False},
                "actor": "tester",
            },
        )
        candidate_run = self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": candidate["variant_version_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: True},
                "actor": "tester",
            },
        ).json()

        response = self.client.post(
            "/api/variants/promotions",
            json={
                "variant_id": variant["id"],
                "version_id": candidate["variant_version_id"],
                "evidence_eval_run_id": candidate_run["eval_run_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "decision_note": "Candidate fixes tenant leak detection.",
                "accept_risk": False,
                "actor": "tester",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        self.assertEqual(response.json()["promotion_decision"]["to_version_id"], candidate["variant_version_id"])
        promoted = self.client.get(f"/api/skills/{imported['skill_id']}").json()
        self.assertEqual(promoted["summary"]["default_variant"]["current_version"]["id"], candidate["variant_version_id"])

    def test_promotion_decision_note_returns_field_errors(self):
        imported = self.import_standard_skill_bundle("promotion-decision-note")
        detail = self.client.get(f"/api/skills/{imported['skill_id']}").json()
        variant = detail["summary"]["default_variant"]
        current_version = variant["current_version"]
        candidate = self.client.post(
            "/api/variant-versions",
            json={
                "variant_id": variant["id"],
                "source": {
                    "kind": "files",
                    "name": "promotion-decision-note",
                    "files": [
                        {
                            "path": "promotion-decision-note/SKILL.md",
                            "content_text": (
                                "---\n"
                                "name: promotion-decision-note\n"
                                "description: Review pull requests for auth and data access regressions.\n"
                                "---\n"
                                "# Security Reviewing\n"
                                "Flag auth regressions and tenant leaks first.\n"
                            ),
                        }
                    ],
                },
                "change_summary": "Add stricter tenant guidance.",
                "make_current": False,
                "actor": "tester",
            },
        ).json()
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": imported["skill_id"],
                "title": "PR: tenant scope regresses",
                "input_text": "Project.all()",
                "expected_output": "Flag missing tenant scope.",
                "actor": "tester",
            },
        ).json()
        self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": current_version["id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: True},
                "actor": "tester",
            },
        )
        candidate_run = self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": candidate["variant_version_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: False},
                "actor": "tester",
            },
        ).json()

        missing_note = self.client.post(
            "/api/variants/promotions",
            json={
                "variant_id": variant["id"],
                "version_id": candidate["variant_version_id"],
                "evidence_eval_run_id": candidate_run["eval_run_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "decision_note": " ",
                "accept_risk": True,
                "actor": "tester",
            },
        )
        self.assertEqual(missing_note.status_code, 400)
        self.assertEqual(
            missing_note.json()["field_errors"][0],
            {
                "field": "decision_note",
                "message": "填写设为当前版本说明。",
                "code": "promotion.decision_note_required",
            },
        )

        overlong_note = self.client.post(
            "/api/variants/promotions",
            json={
                "variant_id": variant["id"],
                "version_id": candidate["variant_version_id"],
                "evidence_eval_run_id": candidate_run["eval_run_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "decision_note": "x" * 1001,
                "accept_risk": True,
                "actor": "tester",
            },
        )
        self.assertEqual(overlong_note.status_code, 422)
        self.assertEqual(
            overlong_note.json()["field_errors"][0],
            {
                "field": "decision_note",
                "message": "设为当前版本说明最多 1000 个字符。",
                "code": "request.string_too_long",
            },
        )

    def test_eval_run_compare_endpoint_returns_case_impact(self):
        skill = self.create_skill("run-compare-api")
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: missing tenant scope",
                "input_text": "Project.all()",
                "expected_output": "Flag missing tenant scope.",
                "actor": "tester",
            },
        ).json()
        candidate = self.client.post(
            "/api/variant-versions",
            json={
                "variant_id": skill["variant_id"],
                "content_ref": {"kind": "skill_bundle", "locator": "memory:v2", "digest": "digest-v2"},
                "change_summary": "Add tenant guidance.",
                "make_current": False,
                "actor": "tester",
            },
        ).json()
        baseline_run = self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": skill["variant_version_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: False},
                "actor": "tester",
            },
        ).json()
        candidate_run = self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": candidate["variant_version_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: True},
                "actor": "tester",
            },
        ).json()

        response = self.client.get(
            "/api/eval-runs/compare",
            params={
                "baseline_run_id": baseline_run["eval_run_id"],
                "candidate_run_id": candidate_run["eval_run_id"],
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary"]["baseline_pass_rate"], 0)
        self.assertEqual(payload["summary"]["candidate_pass_rate"], 100)
        self.assertEqual(payload["summary"]["delta"], 100)
        self.assertEqual(payload["summary"]["fixed"], 1)
        self.assertEqual(payload["case_comparisons"][0]["change_label"], "修复")
        self.assertIsNone(payload["candidate_accepted_verification"])

    def test_accept_eval_run_verification_command_marks_history(self):
        skill = self.create_skill("accepted-api")
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: owner scope",
                "input_text": "Project.all()",
                "expected_output": "Flag owner scope.",
                "actor": "tester",
            },
        ).json()
        run = self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": skill["variant_version_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: True},
                "actor": "tester",
            },
        ).json()

        response = self.client.post(
            "/api/eval-runs/accepted-verifications",
            json={
                "eval_run_id": run["eval_run_id"],
                "note": "Accepted for Primary v2.",
                "actor": "tester",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        self.assertEqual(response.json()["accepted_verification"]["eval_run_id"], run["eval_run_id"])
        history = self.client.get(f"/api/skills/{skill['skill_id']}/eval-runs").json()
        self.assertEqual(history["runs"][0]["accepted_verification"]["eval_run_id"], run["eval_run_id"])

    def test_accepted_verification_rejects_overlong_note(self):
        skill = self.create_skill("accepted-note-too-long")
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: owner scope",
                "input_text": "Project.all()",
                "expected_output": "Flag owner scope.",
                "actor": "tester",
            },
        ).json()
        run = self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": skill["variant_version_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: True},
                "actor": "tester",
            },
        ).json()

        response = self.client.post(
            "/api/eval-runs/accepted-verifications",
            json={
                "eval_run_id": run["eval_run_id"],
                "note": "x" * 1001,
                "actor": "tester",
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json()["field_errors"][0],
            {
                "field": "note",
                "message": "验证说明最多 1000 个字符。",
                "code": "request.string_too_long",
            },
        )

    def test_skill_role_assignments_can_be_listed_granted_and_revoked(self):
        skill = self.create_skill("access-api")

        listed = self.client.get(f"/api/skills/{skill['skill_id']}/role-assignments")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()[0]["subject_id"], "tester")
        self.assertEqual(listed.json()[0]["role"], "owner")

        granted = self.client.post(
            f"/api/skills/{skill['skill_id']}/role-assignments",
            json={
                "subject_id": "qa-reviewer",
                "role": "evaluator",
                "actor": "tester",
            },
        )

        self.assertEqual(granted.status_code, 200)
        self.assertEqual(granted.json()["subject_id"], "qa-reviewer")
        self.assertEqual(granted.json()["role"], "evaluator")
        detail = self.client.get(f"/api/skills/{skill['skill_id']}").json()
        self.assertIn("qa-reviewer", [item["subject_id"] for item in detail["role_assignments"]])

        revoked = self.client.delete(f"/api/role-assignments/{granted.json()['id']}", params={"actor": "tester"})
        listed_after = self.client.get(f"/api/skills/{skill['skill_id']}/role-assignments")

        self.assertEqual(revoked.status_code, 200)
        self.assertNotIn("qa-reviewer", [item["subject_id"] for item in listed_after.json()])

    def test_skill_capabilities_reflect_actor_roles(self):
        skill = self.create_skill("capabilities-api")

        owner_capabilities = self.client.get(f"/api/skills/{skill['skill_id']}/capabilities").json()
        self.assertEqual(owner_capabilities["actor"], "tester")
        self.assertEqual(owner_capabilities["roles"], ["owner"])
        self.assertEqual(
            owner_capabilities["permissions"],
            {
                "role.manage": True,
                "variant.promote": True,
                "verification.accept": True,
            },
        )

        self.client.post(
            f"/api/skills/{skill['skill_id']}/role-assignments",
            json={"subject_id": "capability-viewer", "role": "viewer"},
        )
        viewer_capabilities = self.client.get(
            f"/api/skills/{skill['skill_id']}/capabilities",
            headers={"X-SkillHub-Actor": "capability-viewer"},
        ).json()
        self.assertEqual(viewer_capabilities["roles"], ["viewer"])
        self.assertEqual(
            viewer_capabilities["permissions"],
            {
                "role.manage": False,
                "variant.promote": False,
                "verification.accept": False,
            },
        )

        self.client.post(
            f"/api/skills/{skill['skill_id']}/role-assignments",
            json={"subject_id": "capability-viewer", "role": "maintainer"},
        )
        maintainer_capabilities = self.client.get(
            f"/api/skills/{skill['skill_id']}/capabilities",
            headers={"X-SkillHub-Actor": "capability-viewer"},
        ).json()
        self.assertEqual(maintainer_capabilities["roles"], ["maintainer", "viewer"])
        self.assertEqual(
            maintainer_capabilities["permissions"],
            {
                "role.manage": False,
                "variant.promote": True,
                "verification.accept": True,
            },
        )

    def test_request_actor_header_controls_created_owner(self):
        response = self.client.post(
            "/api/skills",
            headers={"X-SkillHub-Actor": "header-owner"},
            json={
                "slug": "header-owner-skill",
                "owner_ref": "skillhub-lab",
                "variant_name": "Variant A",
                "variant_label": "Baseline",
                "variant_summary": "Baseline maintained answer.",
                "tags": ["codex"],
                "content_ref": {
                    "kind": "skill_bundle",
                    "locator": "memory:header-owner-skill",
                    "digest": "digest-header-owner",
                },
                "change_summary": "Initial version.",
                "actor": "body-attacker",
            },
        )

        self.assertEqual(response.status_code, 200)
        assignments = self.client.get(f"/api/skills/{response.json()['skill_id']}/role-assignments").json()
        self.assertEqual(assignments[0]["subject_id"], "header-owner")
        self.assertNotEqual(assignments[0]["subject_id"], "body-attacker")

    def test_session_actor_cookie_controls_created_owner(self):
        client = TestClient(create_app(create_local_sqlite_engine()))

        session = client.post("/api/session", json={"actor": "release-manager", "access_code": "skillhub-dev"})
        created = client.post(
            "/api/skills",
            json={
                "slug": "session-owner-skill",
                "owner_ref": "skillhub-lab",
                "variant_name": "Variant A",
                "variant_label": "Baseline",
                "variant_summary": "Baseline maintained answer.",
                "tags": ["codex"],
                "content_ref": {
                    "kind": "skill_bundle",
                    "locator": "memory:session-owner-skill",
                    "digest": "digest-session-owner",
                },
                "change_summary": "Initial version.",
            },
        )

        self.assertEqual(session.status_code, 200)
        self.assertEqual(session.json()["actor"], "release-manager")
        self.assertIn("skillhub_actor=", session.headers["set-cookie"])
        self.assertEqual(created.status_code, 200)
        assignments = client.get(f"/api/skills/{created.json()['skill_id']}/role-assignments").json()
        self.assertEqual(assignments[0]["subject_id"], "release-manager")

    def test_session_actor_requires_local_access_code(self):
        client = TestClient(create_app(create_local_sqlite_engine()))

        rejected = client.post("/api/session", json={"actor": "release-manager", "access_code": "wrong-code"})
        accepted = client.post("/api/session", json={"actor": "release-manager", "access_code": "skillhub-dev"})

        self.assertEqual(rejected.status_code, 403)
        self.assertIn("Invalid local session access code", rejected.json()["detail"])
        self.assertNotIn("skillhub_actor=", rejected.headers.get("set-cookie", ""))
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.json()["actor"], "release-manager")
        self.assertIn("skillhub_actor=", accepted.headers["set-cookie"])

    def test_tampered_session_actor_cookie_is_rejected(self):
        client = TestClient(create_app(create_local_sqlite_engine()))
        client.cookies.set("skillhub_actor", "tampered")

        response = client.post(
            "/api/skills",
            json={
                "slug": "tampered-session-skill",
                "owner_ref": "skillhub-lab",
                "variant_name": "Variant A",
                "variant_label": "Baseline",
                "variant_summary": "Baseline maintained answer.",
                "tags": ["codex"],
                "content_ref": {
                    "kind": "skill_bundle",
                    "locator": "memory:tampered-session-skill",
                    "digest": "digest-tampered-session",
                },
                "change_summary": "Initial version.",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid actor session", response.json()["detail"])

    def test_skill_governance_archive_requires_owner_and_writes_audit_event(self):
        skill = self.create_skill("governance-archive-api")
        self.client.post(
            f"/api/skills/{skill['skill_id']}/role-assignments",
            json={"subject_id": "readonly-user", "role": "viewer"},
        )

        rejected = self.client.delete(
            f"/api/skills/{skill['skill_id']}",
            headers={"X-SkillHub-Actor": "readonly-user"},
        )
        archived = self.client.delete(f"/api/skills/{skill['skill_id']}")
        detail = self.client.get(f"/api/skills/{skill['skill_id']}").json()

        self.assertEqual(rejected.status_code, 403)
        self.assertEqual(archived.status_code, 200)
        self.assertEqual(detail["skill"]["lifecycle_status"], "archived")
        self.assertEqual(detail["audit_events"][0]["action"], "skill.archived")
        self.assertEqual(detail["audit_events"][0]["actor_ref"], "tester")

    def test_skill_audit_events_endpoint_returns_recent_governance_events(self):
        skill = self.create_skill("governance-audit-api")
        granted = self.client.post(
            f"/api/skills/{skill['skill_id']}/role-assignments",
            json={"subject_id": "qa-reviewer", "role": "evaluator"},
        ).json()
        self.client.delete(f"/api/role-assignments/{granted['id']}")

        response = self.client.get(f"/api/skills/{skill['skill_id']}/audit-events")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([event["action"] for event in response.json()[:2]], ["role.revoked", "role.assigned"])
        self.assertEqual(response.json()[0]["payload"]["subject_id"], "qa-reviewer")

    def test_skill_audit_events_include_related_resources_and_filters(self):
        imported = self.import_standard_skill_bundle("audit-related-api")
        detail = self.client.get(f"/api/skills/{imported['skill_id']}").json()
        variant = detail["summary"]["default_variant"]
        current_version = variant["current_version"]
        candidate = self.client.post(
            "/api/variant-versions",
            json={
                "variant_id": variant["id"],
                "source": {
                    "kind": "files",
                    "name": "audit-related-api",
                    "files": [
                        {
                            "path": "audit-related-api/SKILL.md",
                            "content_text": (
                                "---\n"
                                "name: audit-related-api\n"
                                "description: Review pull requests for audit related regressions.\n"
                                "---\n"
                                "# Audit Reviewing\n"
                                "Flag auth regressions and tenant leaks first.\n"
                            ),
                        },
                        {
                            "path": "audit-related-api/references/checklist.md",
                            "content_text": "Check owner filters and tenant filters.\n",
                        },
                    ],
                },
                "change_summary": "Candidate version.",
                "make_current": False,
            },
        ).json()
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": imported["skill_id"],
                "title": "PR: audit tenant scope",
                "input_text": "Project.all()",
                "expected_output": "Flag missing tenant scope.",
            },
        ).json()
        self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": current_version["id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: False},
            },
        )
        candidate_run = self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": candidate["variant_version_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: True},
            },
        ).json()
        promoted = self.client.post(
            "/api/variants/promotions",
            json={
                "variant_id": variant["id"],
                "version_id": candidate["variant_version_id"],
                "evidence_eval_run_id": candidate_run["eval_run_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "decision_note": "Candidate fixes audit case.",
                "accept_risk": False,
            },
        )
        self.assertEqual(promoted.status_code, 200)
        self.client.post(
            "/api/eval-runs/accepted-verifications",
            json={"eval_run_id": candidate_run["eval_run_id"], "note": "Accepted after promotion."},
        )

        all_events = self.client.get(f"/api/skills/{imported['skill_id']}/audit-events", params={"limit": 20}).json()
        promoted_events = self.client.get(
            f"/api/skills/{imported['skill_id']}/audit-events",
            params={"action": "variant.promoted"},
        ).json()
        eval_run_events = self.client.get(
            f"/api/skills/{imported['skill_id']}/audit-events",
            params={"resource_type": "eval_run"},
        ).json()
        actor_events = self.client.get(
            f"/api/skills/{imported['skill_id']}/audit-events",
            params={"actor": "tester", "action": "variant.promoted"},
        ).json()

        self.assertIn("variant.promoted", [event["action"] for event in all_events])
        self.assertIn("eval_run.accepted_verification_set", [event["action"] for event in all_events])
        self.assertEqual([event["action"] for event in promoted_events], ["variant.promoted"])
        self.assertEqual(promoted_events[0]["resource_type"], "variant")
        self.assertEqual([event["resource_type"] for event in eval_run_events], ["eval_run"])
        self.assertEqual([event["actor_ref"] for event in actor_events], ["tester"])

    def test_viewer_cannot_promote_variant_version(self):
        skill = self.create_skill("promotion-permission-api")
        candidate = self.client.post(
            "/api/variant-versions",
            json={
                "variant_id": skill["variant_id"],
                "content_ref": {
                    "kind": "skill_bundle",
                    "locator": "memory:promotion-permission-api-v2",
                    "digest": "digest-permission-v2",
                },
                "change_summary": "Candidate version.",
                "make_current": False,
                "actor": "tester",
            },
        ).json()
        self.client.post(
            f"/api/skills/{skill['skill_id']}/role-assignments",
            json={"subject_id": "readonly-user", "role": "viewer", "actor": "tester"},
        )
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: tenant leak",
                "input_text": "Project.all()",
                "expected_output": "Flag tenant leak.",
                "actor": "tester",
            },
        ).json()
        self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": skill["variant_version_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: False},
                "actor": "tester",
            },
        )
        candidate_run = self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": candidate["variant_version_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: True},
                "actor": "tester",
            },
        ).json()

        response = self.client.post(
            "/api/variants/promotions",
            headers={"X-SkillHub-Actor": "readonly-user"},
            json={
                "variant_id": skill["variant_id"],
                "version_id": candidate["variant_version_id"],
                "evidence_eval_run_id": candidate_run["eval_run_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "decision_note": "Candidate fixes the tenant leak.",
                "actor": "tester",
            },
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn("requires owner or maintainer", response.json()["detail"])

    def test_accepted_verification_requires_maintainer_or_owner(self):
        skill = self.create_skill("accepted-permission-api")
        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: owner scope",
                "input_text": "Project.all()",
                "expected_output": "Flag owner scope.",
                "actor": "tester",
            },
        ).json()
        run = self.client.post(
            "/api/eval-runs",
            json={
                "variant_version_id": skill["variant_version_id"],
                "eval_set_version_id": case["eval_set_version_id"],
                "strategy": "manual_pass_fail",
                "results": {case["eval_case_version_id"]: True},
                "actor": "tester",
            },
        ).json()
        self.client.post(
            f"/api/skills/{skill['skill_id']}/role-assignments",
            json={"subject_id": "readonly-user", "role": "viewer", "actor": "tester"},
        )
        self.client.post(
            f"/api/skills/{skill['skill_id']}/role-assignments",
            json={"subject_id": "release-manager", "role": "maintainer", "actor": "tester"},
        )

        viewer_response = self.client.post(
            "/api/eval-runs/accepted-verifications",
            headers={"X-SkillHub-Actor": "readonly-user"},
            json={
                "eval_run_id": run["eval_run_id"],
                "note": "Viewer should not be able to accept.",
                "actor": "tester",
            },
        )
        maintainer_response = self.client.post(
            "/api/eval-runs/accepted-verifications",
            headers={"X-SkillHub-Actor": "release-manager"},
            json={
                "eval_run_id": run["eval_run_id"],
                "note": "Maintainer accepts Primary evidence.",
                "actor": "tester",
            },
        )

        self.assertEqual(viewer_response.status_code, 403)
        self.assertIn("requires owner or maintainer", viewer_response.json()["detail"])
        self.assertEqual(maintainer_response.status_code, 200)
        self.assertEqual(maintainer_response.json()["accepted_verification"]["created_by"], "release-manager")

    def test_missing_variant_returns_404(self):
        response = self.client.post(
            "/api/variant-versions",
            json={
                "variant_id": "missing",
                "content_ref": {
                    "kind": "skill_bundle",
                    "locator": "memory:v2",
                    "digest": "digest-v2",
                },
                "change_summary": "Missing variant.",
            },
        )

        self.assertEqual(response.status_code, 404)
        self.assertIn("Variant not found", response.json()["detail"])

    def test_management_flow_updates_variant_and_cases(self):
        skill = self.create_skill("reviewer-ops")

        update_skill = self.client.patch(
            f"/api/skills/{skill['skill_id']}",
            json={"slug": "reviewer-ops-v2", "owner_ref": "platform-team"},
        )
        self.assertEqual(update_skill.status_code, 200)
        self.assertEqual(update_skill.json()["slug"], "reviewer-ops-v2")

        variant = self.client.post(
            "/api/variants",
            json={
                "skill_id": skill["skill_id"],
                "name": "Long context",
                "label": "Long context",
                "summary": "Optimized for long review prompts.",
                "tags": ["codex", "long-context"],
                "content_ref": {
                    "kind": "skill_bundle",
                    "locator": "memory:long-context",
                    "digest": "digest-long-context",
                },
                "change_summary": "Add long context variant.",
                "actor": "tester",
                "make_default": True,
            },
        )
        self.assertEqual(variant.status_code, 200)
        variant_id = variant.json()["variant_id"]

        update_default = self.client.patch(
            f"/api/skills/{skill['skill_id']}",
            json={"slug": "reviewer-ops-v2", "owner_ref": "platform-team", "default_variant_id": variant_id},
        )
        self.assertEqual(update_default.status_code, 200)
        self.assertEqual(update_default.json()["default_variant_id"], variant_id)
        detail = self.client.get(f"/api/skills/{skill['skill_id']}").json()
        self.assertEqual(detail["summary"]["default_variant"]["id"], variant_id)
        self.assertEqual(detail["summary"]["default_variant"]["label"], "Long context")

        case = self.client.post(
            "/api/eval-cases",
            json={
                "skill_id": skill["skill_id"],
                "title": "PR: noisy rename",
                "input_text": "rename local variable",
                "expected_output": "No finding",
                "actor": "tester",
            },
        ).json()
        revised = self.client.patch(
            f"/api/eval-cases/{case['eval_case_id']}",
            json={
                "case_id": case["eval_case_id"],
                "title": "PR: harmless rename",
                "input_text": "rename local variable only",
                "expected_output": "Should not report a bug.",
                "actor": "tester",
                "make_current": True,
            },
        )
        self.assertEqual(revised.status_code, 200)

        archived_case = self.client.delete(f"/api/eval-cases/{case['eval_case_id']}")
        self.assertEqual(archived_case.status_code, 200)
        eval_set = self.client.get(f"/api/eval-set-versions/{archived_case.json()['eval_set_version_id']}")
        self.assertEqual(eval_set.status_code, 200)
        self.assertEqual(eval_set.json()["cases"], [])

        archive_skill = self.client.delete(f"/api/skills/{skill['skill_id']}")
        self.assertEqual(archive_skill.status_code, 200)
        archived_detail = self.client.get(f"/api/skills/{skill['skill_id']}")
        self.assertEqual(archived_detail.json()["skill"]["lifecycle_status"], "archived")
        hub = self.client.get("/api/skills")
        self.assertEqual(hub.status_code, 200)
        self.assertEqual(hub.json(), [])

    def test_update_skill_rejects_default_variant_from_another_skill(self):
        skill = self.create_skill("reviewer-default-scope")
        other_skill = self.create_skill("reviewer-other-scope", digest="digest-other-scope")
        other_detail = self.client.get(f"/api/skills/{other_skill['skill_id']}").json()
        other_variant_id = other_detail["summary"]["default_variant"]["id"]

        response = self.client.patch(
            f"/api/skills/{skill['skill_id']}",
            json={
                "slug": "reviewer-default-scope",
                "owner_ref": "skillhub-lab",
                "default_variant_id": other_variant_id,
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("same skill", response.json()["detail"])

    def test_import_skill_from_file_tree_uses_skill_md_frontmatter(self):
        response = self.client.post(
            "/api/skill-imports",
            json={
                "owner_ref": "skillhub-lab",
                "tags": ["codex", "gpt5.4"],
                "actor": "tester",
                "source": {
                    "kind": "files",
                    "name": "security-reviewing",
                    "files": [
                        {
                            "path": "security-reviewing/SKILL.md",
                            "content_text": (
                                "---\n"
                                "name: security-reviewing\n"
                                "description: Review pull requests for auth and data access regressions.\n"
                                "---\n"
                                "# Security Reviewing\n"
                                "Flag auth regressions first.\n"
                            ),
                        },
                        {
                            "path": "security-reviewing/references/checklist.md",
                            "content_text": "Check owner filters and secret logging.\n",
                        },
                    ],
                },
            },
        )

        self.assertEqual(response.status_code, 200)
        imported = response.json()
        self.assertEqual(imported["slug"], "security-reviewing")
        self.assertEqual(imported["file_count"], 2)
        self.assertEqual(imported["entry_path"], "SKILL.md")
        detail = self.client.get(f"/api/skills/{imported['skill_id']}").json()
        self.assertEqual(detail["skill"]["slug"], "security-reviewing")
        self.assertEqual(detail["summary"]["default_variant"]["summary"], "Review pull requests for auth and data access regressions.")
        self.assertEqual(detail["summary"]["default_variant"]["tags"], ["codex", "gpt5.4"])
        self.assertEqual(detail["summary"]["default_variant"]["current_version"]["content_ref"]["kind"], "artifact")
        bundle_artifact = detail["summary"]["default_variant"]["current_version"]["bundle_artifact"]
        self.assertIn("\"path\": \"SKILL.md\"", bundle_artifact["content_text"])
        bundle_files = detail["summary"]["default_variant"]["current_version"]["bundle_files"]
        self.assertEqual([file["path"] for file in bundle_files], ["SKILL.md", "references/checklist.md"])
        self.assertEqual(bundle_files[0]["content_text"].splitlines()[1], "name: security-reviewing")

    def test_import_skill_from_zip_uses_same_bundle_contract(self):
        archive = BytesIO()
        with ZipFile(archive, "w", ZIP_DEFLATED) as bundle:
            bundle.writestr(
                "data-quality/SKILL.md",
                (
                    "---\n"
                    "name: data-quality\n"
                    "description: Inspect data pipelines for schema drift and missing checks.\n"
                    "---\n"
                    "# Data Quality\n"
                ),
            )
            bundle.writestr("data-quality/examples/input.md", "broken schema example")

        response = self.client.post(
            "/api/skill-imports",
            json={
                "owner_ref": "skillhub-lab",
                "tags": ["opencode", "minimax2.7"],
                "actor": "tester",
                "source": {
                    "kind": "zip",
                    "name": "data-quality.zip",
                    "zip_base64": b64encode(archive.getvalue()).decode("ascii"),
                },
            },
        )

        self.assertEqual(response.status_code, 200)
        imported = response.json()
        self.assertEqual(imported["slug"], "data-quality")
        self.assertEqual(imported["file_count"], 2)
        detail = self.client.get(f"/api/skills/{imported['skill_id']}").json()
        self.assertEqual(detail["summary"]["default_variant"]["tags"], ["minimax2.7", "opencode"])

    def test_import_duplicate_skill_returns_validation_error(self):
        payload = {
            "owner_ref": "skillhub-lab",
            "tags": ["codex"],
            "actor": "tester",
            "source": {
                "kind": "files",
                "name": "duplicate-reviewer",
                "files": [
                    {
                        "path": "duplicate-reviewer/SKILL.md",
                        "content_text": (
                            "---\n"
                            "name: duplicate-reviewer\n"
                            "description: Reviewer that demonstrates duplicate handling.\n"
                            "---\n"
                        ),
                    }
                ],
            },
        }
        self.assertEqual(self.client.post("/api/skill-imports", json=payload).status_code, 200)

        duplicate = self.client.post("/api/skill-imports", json=payload)

        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(duplicate.json()["detail"], "Skill ID 已存在：duplicate-reviewer")
        self.assertEqual(duplicate.json()["field_errors"][0]["code"], "skill.slug_conflict")

    def test_import_skill_frontmatter_error_returns_folder_field_error(self):
        response = self.client.post(
            "/api/skill-imports",
            json={
                "owner_ref": "skillhub-lab",
                "tags": ["codex"],
                "source": {
                    "kind": "files",
                    "files": [
                        {
                            "path": "missing-description/SKILL.md",
                            "content_text": "---\nname: missing-description\n---\n\n# Missing description\n",
                        }
                    ],
                },
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Skill description is required.")
        self.assertEqual(
            response.json()["field_errors"],
            [
                {
                    "field": "folder_files",
                    "message": "SKILL.md frontmatter 需要 description。",
                    "code": "skill_import.description_required",
                }
            ],
        )

    def test_import_skill_zip_error_returns_zip_field_error(self):
        response = self.client.post(
            "/api/skill-imports",
            json={
                "owner_ref": "skillhub-lab",
                "tags": ["codex"],
                "source": {
                    "kind": "zip",
                    "zip_base64": "bm90LXJlYWxseS1hLXppcA==",
                },
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["field_errors"][0]["field"], "zip_file")
        self.assertEqual(response.json()["field_errors"][0]["code"], "skill_import.zip_unreadable")

    def test_variant_version_from_bundle_source_can_be_diffed(self):
        imported = self.import_standard_skill_bundle("diff-reviewing")
        detail = self.client.get(f"/api/skills/{imported['skill_id']}").json()
        variant = detail["summary"]["default_variant"]
        first_version = variant["current_version"]

        second_version = self.client.post(
            "/api/variant-versions",
            json={
                "variant_id": variant["id"],
                "source": {
                    "kind": "files",
                    "name": "diff-reviewing",
                    "files": [
                        {
                            "path": "diff-reviewing/SKILL.md",
                            "content_text": (
                                "---\n"
                                "name: diff-reviewing\n"
                                "description: Review pull requests for auth and data access regressions.\n"
                                "---\n"
                                "# Security Reviewing\n"
                                "Flag auth regressions first.\n"
                                "Prioritize missing tenant filters.\n"
                            ),
                        },
                        {
                            "path": "diff-reviewing/references/new-checklist.md",
                            "content_text": "Check tenant filters and audit logs.\n",
                        },
                    ],
                },
                "change_summary": "Add tenant filter guidance and replace checklist.",
                "make_current": True,
                "actor": "tester",
            },
        )
        self.assertEqual(second_version.status_code, 200)

        diff = self.client.get(
            "/api/artifacts/diff",
            params={
                "left_variant_version_id": first_version["id"],
                "right_variant_version_id": second_version.json()["variant_version_id"],
            },
        )

        self.assertEqual(diff.status_code, 200)
        payload = diff.json()
        self.assertEqual(payload["left"]["version_number"], 1)
        self.assertEqual(payload["right"]["version_number"], 2)
        self.assertEqual(payload["summary"]["changed"], 1)
        self.assertEqual(payload["summary"]["added"], 1)
        self.assertEqual(payload["summary"]["removed"], 1)
        self.assertEqual([file["path"] for file in payload["files"]], [
            "SKILL.md",
            "references/checklist.md",
            "references/new-checklist.md",
        ])
        skill_file = payload["files"][0]
        self.assertEqual(skill_file["status"], "changed")
        self.assertTrue(
            any(line["kind"] == "added" and "tenant filters" in line["text"] for hunk in skill_file["hunks"] for line in hunk["lines"])
        )

    def test_bundle_diff_marks_binary_changes_without_hunks(self):
        imported = self.import_standard_skill_bundle(
            "binary-reviewing",
            extra_files=[
                {
                    "path": "binary-reviewing/assets/pixel.bin",
                    "content_base64": b64encode(b"\x00\x01").decode("ascii"),
                }
            ],
        )
        detail = self.client.get(f"/api/skills/{imported['skill_id']}").json()
        variant = detail["summary"]["default_variant"]
        first_version = variant["current_version"]

        second_version = self.client.post(
            "/api/variant-versions",
            json={
                "variant_id": variant["id"],
                "source": {
                    "kind": "files",
                    "name": "binary-reviewing",
                    "files": [
                        {
                            "path": "binary-reviewing/SKILL.md",
                            "content_text": (
                                "---\n"
                                "name: binary-reviewing\n"
                                "description: Review pull requests for auth and data access regressions.\n"
                                "---\n"
                                "# Binary Reviewing\n"
                            ),
                        },
                        {
                            "path": "binary-reviewing/assets/pixel.bin",
                            "content_base64": b64encode(b"\x00\x02").decode("ascii"),
                        },
                    ],
                },
                "change_summary": "Update binary asset.",
                "make_current": True,
                "actor": "tester",
            },
        )
        self.assertEqual(second_version.status_code, 200)

        diff = self.client.get(
            "/api/artifacts/diff",
            params={
                "left_variant_version_id": first_version["id"],
                "right_variant_version_id": second_version.json()["variant_version_id"],
            },
        )

        self.assertEqual(diff.status_code, 200)
        binary_file = next(file for file in diff.json()["files"] if file["path"] == "assets/pixel.bin")
        self.assertEqual(binary_file["status"], "changed")
        self.assertTrue(binary_file["binary"])
        self.assertNotIn("hunks", binary_file)

    def test_bundle_diff_rejects_cross_skill_versions(self):
        first = self.import_standard_skill_bundle("first-diff")
        second = self.import_standard_skill_bundle("second-diff")
        first_version = self.client.get(f"/api/skills/{first['skill_id']}").json()["summary"]["default_variant"]["current_version"]
        second_version = self.client.get(f"/api/skills/{second['skill_id']}").json()["summary"]["default_variant"]["current_version"]

        diff = self.client.get(
            "/api/artifacts/diff",
            params={
                "left_variant_version_id": first_version["id"],
                "right_variant_version_id": second_version["id"],
            },
        )

        self.assertEqual(diff.status_code, 400)
        self.assertIn("same skill", diff.json()["detail"])

    def test_cors_allows_localhost_development_ports(self):
        response = self.client.options(
            "/api/skill-imports",
            headers={
                "origin": "http://127.0.0.1:3011",
                "access-control-request-method": "POST",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["access-control-allow-origin"], "http://127.0.0.1:3011")

    def import_standard_skill_bundle(self, slug: str, extra_files: list[dict] | None = None):
        files = [
            {
                "path": f"{slug}/SKILL.md",
                "content_text": (
                    "---\n"
                    f"name: {slug}\n"
                    "description: Review pull requests for auth and data access regressions.\n"
                    "---\n"
                    "# Security Reviewing\n"
                    "Flag auth regressions first.\n"
                ),
            },
            {
                "path": f"{slug}/references/checklist.md",
                "content_text": "Check owner filters and secret logging.\n",
            },
            *(extra_files or []),
        ]
        response = self.client.post(
            "/api/skill-imports",
            json={
                "owner_ref": "skillhub-lab",
                "tags": ["codex"],
                "actor": "tester",
                "source": {"kind": "files", "name": slug, "files": files},
            },
        )
        self.assertEqual(response.status_code, 200)
        return response.json()

    def skill_payload(self, slug: str, digest: str = "digest-code"):
        return {
            "slug": slug,
            "owner_ref": "skillhub-lab",
            "variant_name": "Variant A",
            "variant_label": "Baseline",
            "variant_summary": "Baseline maintained answer.",
            "tags": ["codex"],
            "content_ref": {
                "kind": "skill_bundle",
                "locator": f"memory:{slug}",
                "digest": digest,
            },
            "change_summary": "Initial version.",
            "actor": "tester",
        }

    def create_skill(self, slug: str, digest: str = "digest-code"):
        response = self.client.post(
            "/api/skills",
            json=self.skill_payload(slug, digest=digest),
        )
        self.assertEqual(response.status_code, 200)
        return response.json()


if __name__ == "__main__":
    unittest.main()
