import unittest

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
