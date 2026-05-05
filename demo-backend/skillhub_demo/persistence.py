from __future__ import annotations

import json
from pathlib import Path
from typing import Callable, Dict, List, Type, TypeVar, Union

from .models import (
    AppData,
    Artifact,
    CaseResult,
    ContentRef,
    EvalCase,
    EvalCaseVersion,
    EvalCorpus,
    EvalRun,
    EvalSetVersion,
    Skill,
    TagSet,
    Variant,
    VariantVersion,
    to_jsonable,
)


PathLike = Union[str, Path]
T = TypeVar("T")


def load_app_data(path: PathLike, fallback: Callable[[], AppData]) -> AppData:
    data_path = Path(path)
    if not data_path.exists():
        return fallback()
    with data_path.open("r", encoding="utf-8") as handle:
        raw = json.load(handle)
    if not isinstance(raw, dict):
        return fallback()
    return app_data_from_dict(raw)


def save_app_data(path: PathLike, data: AppData) -> None:
    data_path = Path(path)
    data_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = data_path.with_suffix(data_path.suffix + ".tmp")
    with temp_path.open("w", encoding="utf-8") as handle:
        json.dump(to_jsonable(data), handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    temp_path.replace(data_path)


def app_data_from_dict(raw: Dict[str, object]) -> AppData:
    return AppData(
        skills=_items(raw, "skills", Skill),
        tag_sets=_items(raw, "tag_sets", TagSet),
        variants=_items(raw, "variants", Variant),
        variant_versions=[_variant_version(item) for item in _dicts(raw, "variant_versions")],
        eval_corpora=_items(raw, "eval_corpora", EvalCorpus),
        eval_cases=_eval_cases(raw),
        eval_case_versions=_eval_case_versions(raw),
        eval_set_versions=_eval_set_versions(raw),
        eval_runs=_items(raw, "eval_runs", EvalRun),
        case_results=_case_results(raw),
        artifacts=_items(raw, "artifacts", Artifact),
    )


def _items(raw: Dict[str, object], key: str, item_type: Type[T]) -> List[T]:
    return [item_type(**item) for item in _dicts(raw, key)]  # type: ignore[arg-type]


def _variant_version(raw: Dict[str, object]) -> VariantVersion:
    content_ref = raw.get("content_ref")
    if not isinstance(content_ref, dict):
        raise ValueError("variant_version.content_ref must be an object")
    return VariantVersion(
        id=str(raw["id"]),
        variant_ref=str(raw["variant_ref"]),
        version=str(raw["version"]),
        content_ref=ContentRef(**content_ref),
        change_note=raw.get("change_note") if isinstance(raw.get("change_note"), str) else None,
        created_at=str(raw["created_at"]),
    )


def _eval_cases(raw: Dict[str, object]) -> List[EvalCase]:
    cases: List[EvalCase] = []
    for item in _dicts(raw, "eval_cases"):
        case_id = str(item["id"])
        current_version_ref = item.get("current_version_ref")
        cases.append(
            EvalCase(
                id=case_id,
                corpus_ref=str(item["corpus_ref"]),
                title=str(item["title"]),
                source_type=str(item["source_type"]),  # type: ignore[arg-type]
                current_version_ref=str(current_version_ref) if isinstance(current_version_ref, str) else _legacy_case_version_id(case_id),
                origin_ref=item.get("origin_ref") if isinstance(item.get("origin_ref"), str) else None,
                created_at=str(item["created_at"]),
            )
        )
    return cases


def _eval_case_versions(raw: Dict[str, object]) -> List[EvalCaseVersion]:
    explicit = _dicts(raw, "eval_case_versions")
    if explicit:
        return [EvalCaseVersion(**item) for item in explicit]  # type: ignore[arg-type]

    versions: List[EvalCaseVersion] = []
    for item in _dicts(raw, "eval_cases"):
        case_id = str(item["id"])
        versions.append(
            EvalCaseVersion(
                id=_legacy_case_version_id(case_id),
                case_ref=case_id,
                version="v1",
                input_artifact_ref=str(item["input_artifact_ref"]),
                expectation_artifact_ref=str(item["expectation_artifact_ref"]),
                grader_ref=str(item["grader_ref"]),
                expectation=str(item["expectation"]),
                created_at=str(item["created_at"]),
            )
        )
    return versions


def _eval_set_versions(raw: Dict[str, object]) -> List[EvalSetVersion]:
    versions: List[EvalSetVersion] = []
    legacy_case_to_version = {
        str(item["id"]): _legacy_case_version_id(str(item["id"]))
        for item in _dicts(raw, "eval_cases")
        if "current_version_ref" not in item
    }
    current_case_to_version = {
        str(item["id"]): str(item["current_version_ref"])
        for item in _dicts(raw, "eval_cases")
        if isinstance(item.get("current_version_ref"), str)
    }
    case_to_version = {**legacy_case_to_version, **current_case_to_version}

    for item in _dicts(raw, "eval_set_versions"):
        case_version_refs = item.get("case_version_refs")
        if isinstance(case_version_refs, list):
            refs = [str(ref) for ref in case_version_refs]
        else:
            refs = [case_to_version.get(str(ref), str(ref)) for ref in item.get("case_refs", [])] if isinstance(item.get("case_refs"), list) else []
        versions.append(
            EvalSetVersion(
                id=str(item["id"]),
                corpus_ref=str(item["corpus_ref"]),
                version=str(item["version"]),
                case_version_refs=refs,
                created_at=str(item["created_at"]),
            )
        )
    return versions


def _case_results(raw: Dict[str, object]) -> List[CaseResult]:
    case_to_version = {
        str(item["id"]): str(item.get("current_version_ref") or _legacy_case_version_id(str(item["id"])))
        for item in _dicts(raw, "eval_cases")
    }
    results: List[CaseResult] = []
    for item in _dicts(raw, "case_results"):
        case_version_ref = item.get("case_version_ref")
        if not isinstance(case_version_ref, str):
            case_version_ref = case_to_version.get(str(item.get("case_ref")), str(item.get("case_ref")))
        results.append(
            CaseResult(
                run_ref=str(item["run_ref"]),
                case_version_ref=case_version_ref,
                passed=bool(item["passed"]),
                score=int(item["score"]),
            )
        )
    return results


def _legacy_case_version_id(case_id: str) -> str:
    return "casever-%s-v1" % case_id


def _dicts(raw: Dict[str, object], key: str) -> List[Dict[str, object]]:
    value = raw.get(key, [])
    if not isinstance(value, list):
        raise ValueError("%s must be a list" % key)
    if not all(isinstance(item, dict) for item in value):
        raise ValueError("%s must contain objects" % key)
    return value
