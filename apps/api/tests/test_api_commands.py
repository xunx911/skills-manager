import unittest
from base64 import b64encode
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi.testclient import TestClient

from skillhub.api.main import create_app, create_local_sqlite_engine


class ApiCommandTest(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(create_app(create_local_sqlite_engine()))

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
        self.assertIn("already exists", duplicate.json()["detail"])

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

    def create_skill(self, slug: str, digest: str = "digest-code"):
        response = self.client.post(
            "/api/skills",
            json={
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
            },
        )
        self.assertEqual(response.status_code, 200)
        return response.json()


if __name__ == "__main__":
    unittest.main()
