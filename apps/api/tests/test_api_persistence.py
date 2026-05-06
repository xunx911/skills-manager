from pathlib import Path

from fastapi.testclient import TestClient

from skillhub.api.main import create_app, create_sqlite_engine


def test_sqlite_engine_persists_skill_between_app_instances(tmp_path: Path):
    database_url = f"sqlite:///{tmp_path / 'skillhub.sqlite3'}"
    first_engine = create_sqlite_engine(database_url)
    first_client = TestClient(create_app(first_engine))
    response = first_client.post(
        "/api/skills",
        json={
            "slug": "persistent-reviewer",
            "owner_ref": "skillhub-lab",
            "variant_name": "Default",
            "variant_label": "Baseline",
            "variant_summary": "Persistent skill.",
            "tags": ["codex"],
            "content_ref": {
                "kind": "skill_bundle",
                "locator": "memory:persistent-reviewer",
                "digest": "digest-persistent",
            },
            "change_summary": "Initial persistent skill.",
            "actor": "tester",
        },
    )
    assert response.status_code == 200
    first_engine.dispose()

    second_engine = create_sqlite_engine(database_url)
    second_client = TestClient(create_app(second_engine))

    skills = second_client.get("/api/skills").json()

    assert [item["skill"]["slug"] for item in skills] == ["persistent-reviewer"]
