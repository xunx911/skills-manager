from __future__ import annotations

from pathlib import Path
from typing import Callable, Optional, Protocol, Union

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


PathLike = Union[str, Path]


class StateRepository(Protocol):
    label: str

    def load(self, fallback: Callable[[], AppData]) -> AppData:
        ...

    def save(self, data: AppData) -> None:
        ...


class JsonFileRepository:
    def __init__(self, path: PathLike):
        self.path = Path(path)
        self.label = "json:%s" % self.path

    def load(self, fallback: Callable[[], AppData]) -> AppData:
        return load_app_data(self.path, fallback)

    def save(self, data: AppData) -> None:
        save_app_data(self.path, data)


class SqliteRepository:
    def __init__(self, path: PathLike, import_json_path: Optional[PathLike] = None):
        self.path = Path(path)
        self.import_json_path = Path(import_json_path) if import_json_path is not None else None
        self.label = "sqlite:%s" % self.path

    def load(self, fallback: Callable[[], AppData]) -> AppData:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = connect(str(self.path))
        try:
            snapshot = load_app_snapshot(connection)
            if snapshot is not None:
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
