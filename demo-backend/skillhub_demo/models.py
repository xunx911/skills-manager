from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Literal, Optional


ContentKind = Literal["inline_bundle", "skill_bundle", "artifact", "git", "external_repo"]
EvalCaseSource = Literal["manual", "bad_case", "imported", "generated"]
EvalRunStatus = Literal["queued", "running", "finished", "failed"]
LifecycleStatus = Literal["active", "archived"]


@dataclass
class Skill:
    id: str
    slug: str
    owner_ref: str
    default_variant_ref: str
    created_at: str
    lifecycle_status: LifecycleStatus = "active"
    archived_at: Optional[str] = None


@dataclass
class TagSet:
    id: str
    tags_hash: str
    tags: List[str]


@dataclass
class ContentRef:
    kind: ContentKind
    locator: str
    digest: str
    path: Optional[str] = None


@dataclass
class Variant:
    id: str
    skill_ref: str
    name: str
    label: str
    summary: str
    tag_set_ref: str
    current_version_ref: str
    created_at: str
    lifecycle_status: LifecycleStatus = "active"
    archived_at: Optional[str] = None


@dataclass
class VariantVersion:
    id: str
    variant_ref: str
    version: str
    content_ref: ContentRef
    change_note: Optional[str]
    created_at: str


@dataclass
class EvalCorpus:
    id: str
    skill_ref: str
    created_at: str


@dataclass
class EvalCase:
    id: str
    corpus_ref: str
    title: str
    source_type: EvalCaseSource
    current_version_ref: str
    created_at: str
    origin_ref: Optional[str] = None


@dataclass
class EvalCaseVersion:
    id: str
    case_ref: str
    version: str
    input_artifact_ref: str
    expectation_artifact_ref: str
    grader_ref: str
    expectation: str
    created_at: str


@dataclass
class EvalSetVersion:
    id: str
    corpus_ref: str
    version: str
    case_version_refs: List[str]
    created_at: str


@dataclass
class EvalRun:
    id: str
    variant_version_ref: str
    eval_set_version_ref: str
    strategy_ref: str
    run_config_hash: str
    status: EvalRunStatus
    started_at: str
    finished_at: Optional[str] = None
    result_artifact_ref: Optional[str] = None


@dataclass
class CaseResult:
    run_ref: str
    case_version_ref: str
    passed: bool
    score: int


@dataclass
class Artifact:
    id: str
    kind: str
    content: str
    content_hash: str
    media_type: str
    created_at: str


@dataclass
class AppData:
    skills: List[Skill]
    tag_sets: List[TagSet]
    variants: List[Variant]
    variant_versions: List[VariantVersion]
    eval_corpora: List[EvalCorpus]
    eval_cases: List[EvalCase]
    eval_case_versions: List[EvalCaseVersion]
    eval_set_versions: List[EvalSetVersion]
    eval_runs: List[EvalRun]
    case_results: List[CaseResult]
    artifacts: List[Artifact]


def to_jsonable(value: Any) -> Any:
    if hasattr(value, "__dataclass_fields__"):
        return {key: to_jsonable(item) for key, item in asdict(value).items() if item is not None}
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {key: to_jsonable(item) for key, item in value.items()}
    return value
