from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Optional, Protocol, Union

from .artifact_store import ArtifactStore, FileArtifactStore
from .models import AppData
from .persistence import load_app_data, save_app_data
from .sqlite_store import (
    connect,
    eval_result_detail,
    eval_set_detail,
    load_app_snapshot,
    save_app_snapshot,
    skill_detail,
    skills_overview,
    variant_page,
)
from .skill_bundle import skill_bundle_content
from .store import SkillHubStore, digest


PathLike = Union[str, Path]


class StateRepository(Protocol):
    label: str

    def load(self, fallback: Callable[[], AppData]) -> AppData:
        ...

    def save(self, data: AppData) -> None:
        ...

    def mutate(self, fallback: Callable[[], AppData], operation: Callable[[SkillHubStore], Any]) -> Any:
        ...


class JsonFileRepository:
    def __init__(self, path: PathLike, artifact_store: Optional[ArtifactStore] = None):
        self.path = Path(path)
        self.artifact_store = artifact_store or FileArtifactStore(self.path.parent / "artifacts")
        self.label = "json:%s" % self.path

    def load(self, fallback: Callable[[], AppData]) -> AppData:
        return load_app_data(self.path, fallback)

    def save(self, data: AppData) -> None:
        save_app_data(self.path, data)

    def mutate(self, fallback: Callable[[], AppData], operation: Callable[[SkillHubStore], Any]) -> Any:
        store = SkillHubStore(self.load(fallback))
        result = operation(store)
        self.save(store.data)
        return result

    def import_skill_bundle(self, fallback: Callable[[], AppData], name: str, files: dict) -> Any:
        content = skill_bundle_content(name, files)
        locator = self.artifact_store.write_text("skill-bundles", digest(content), content)
        return self.mutate(fallback, lambda store: store.import_skill_bundle(name, files, content_locator=locator))

    def skill_bundle_detail(self, fallback: Callable[[], AppData], artifact_id: str) -> dict:
        return _skill_bundle_detail(SkillHubStore(self.load(fallback)), self.artifact_store, artifact_id)


class SqliteRepository:
    def __init__(
        self,
        path: PathLike,
        import_json_path: Optional[PathLike] = None,
        artifact_store: Optional[ArtifactStore] = None,
    ):
        self.path = Path(path)
        self.import_json_path = Path(import_json_path) if import_json_path is not None else None
        self.artifact_store = artifact_store or FileArtifactStore(self.path.parent / "artifacts")
        self.label = "sqlite:%s" % self.path

    def load(self, fallback: Callable[[], AppData]) -> AppData:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = connect(str(self.path))
        try:
            snapshot = load_app_snapshot(connection)
            if snapshot is not None:
                save_app_snapshot(connection, snapshot)
                return snapshot
            data = self._initial_data(fallback)
            save_app_snapshot(connection, data)
            return data
        finally:
            connection.close()

    def save(self, data: AppData) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = connect(str(self.path))
        try:
            save_app_snapshot(connection, data)
        finally:
            connection.close()

    def mutate(self, fallback: Callable[[], AppData], operation: Callable[[SkillHubStore], Any]) -> Any:
        store = SkillHubStore(self.load(fallback))
        result = operation(store)
        self.save(store.data)
        return result

    def import_skill_bundle(self, fallback: Callable[[], AppData], name: str, files: dict) -> Any:
        content = skill_bundle_content(name, files)
        locator = self.artifact_store.write_text("skill-bundles", digest(content), content)
        return self.mutate(fallback, lambda store: store.import_skill_bundle(name, files, content_locator=locator))

    def skill_bundle_detail(self, fallback: Callable[[], AppData], artifact_id: str) -> dict:
        return _skill_bundle_detail(SkillHubStore(self.load(fallback)), self.artifact_store, artifact_id)

    def skills(self) -> list:
        connection = connect(str(self.path))
        try:
            return skills_overview(connection)
        finally:
            connection.close()

    def skill_detail(self, skill_id: str) -> dict:
        connection = connect(str(self.path))
        try:
            return skill_detail(connection, skill_id)
        finally:
            connection.close()

    def variant_page(self, variant_id: str, version_id: str | None, eval_set_version_id: str) -> dict:
        connection = connect(str(self.path))
        try:
            return variant_page(connection, variant_id, version_id, eval_set_version_id)
        finally:
            connection.close()

    def eval_set_detail(self, eval_set_version_id: str) -> dict:
        connection = connect(str(self.path))
        try:
            return eval_set_detail(connection, eval_set_version_id)
        finally:
            connection.close()

    def eval_result_detail(self, variant_version_id: str, eval_set_version_id: str) -> dict:
        connection = connect(str(self.path))
        try:
            return eval_result_detail(connection, variant_version_id, eval_set_version_id)
        finally:
            connection.close()

    def _initial_data(self, fallback: Callable[[], AppData]) -> AppData:
        if self.import_json_path is not None and self.import_json_path.exists():
            return load_app_data(self.import_json_path, fallback)
        return fallback()


def _skill_bundle_detail(store: SkillHubStore, artifact_store: ArtifactStore, artifact_id: str) -> dict:
    import json

    artifact = store._artifact(artifact_id)
    if artifact.kind != "skill_bundle":
        raise ValueError("Artifact %s is not a skill_bundle" % artifact_id)
    raw = artifact.content if artifact.content.lstrip().startswith("{") else artifact_store.read_text(artifact.content)
    payload = json.loads(raw)
    files = payload.get("files", {})
    if not isinstance(files, dict):
        raise ValueError("Skill bundle artifact has invalid files")
    return {
        "artifact": {
            "id": artifact.id,
            "kind": artifact.kind,
            "content": artifact.content,
            "content_hash": artifact.content_hash,
            "media_type": artifact.media_type,
            "created_at": artifact.created_at,
        },
        "metadata": payload.get("metadata", {}),
        "files": [{"path": path, "content": files[path]} for path in sorted(files)],
    }
