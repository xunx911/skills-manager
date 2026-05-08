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
