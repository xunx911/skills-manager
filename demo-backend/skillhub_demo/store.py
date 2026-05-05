from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, Dict, List, Optional

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
from .skill_bundle import normalize_bundle_files, skill_bundle_content, skill_bundle_payload, skill_md_metadata


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def digest(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()[:12]


class SkillHubStore:
    def __init__(self, data: AppData):
        self.data = deepcopy(data)

    def state(self) -> Dict[str, Any]:
        return to_jsonable(self.data)

    def skills(self) -> List[Dict[str, Any]]:
        return [
            self.variant_page(skill.default_variant_ref, None, self.latest_eval_set_for_skill(skill.id).id)
            for skill in self.data.skills
            if skill.lifecycle_status == "active"
        ]

    def skill_detail(self, skill_id: str) -> Dict[str, Any]:
        skill = self._skill(skill_id)
        variants = [item for item in self.data.variants if item.skill_ref == skill.id]
        eval_set = self.latest_eval_set_for_skill(skill.id)
        return {
            "skill": to_jsonable(skill),
            "variants": to_jsonable(variants),
            "eval_set_version": self._eval_set_payload(eval_set),
        }

    def variant_page(
        self,
        variant_id: str,
        version_id: Optional[str],
        eval_set_version_id: str,
    ) -> Dict[str, Any]:
        variant = self._variant(variant_id)
        version = self._variant_version(version_id or variant.current_version_ref)
        eval_set = self._eval_set_version(eval_set_version_id)
        history = [item for item in self.data.variant_versions if item.variant_ref == variant.id]
        history.sort(key=lambda item: item.created_at, reverse=True)
        return {
            "variant": to_jsonable(variant),
            "variant_version": to_jsonable(version),
            "tags": self.tags_for_variant(variant.id),
            "history": to_jsonable(history),
            "eval_set_version": self._eval_set_payload(eval_set),
            "score": self.aggregate_score(version.id, eval_set.id),
            "result_counts": self.result_counts(version.id, eval_set.id),
            "content_ref": to_jsonable(version.content_ref),
            "verification_runs": self._verification_runs(variant, version),
        }

    def eval_set_detail(self, eval_set_version_id: str) -> Dict[str, Any]:
        eval_set = self._eval_set_version(eval_set_version_id)
        case_versions = [self._eval_case_version(case_version_ref) for case_version_ref in eval_set.case_version_refs]
        return {
            "eval_set_version": self._eval_set_payload(eval_set),
            "cases": [self._case_detail(case_version) for case_version in case_versions],
        }

    def eval_result_detail(self, variant_version_id: str, eval_set_version_id: str) -> Dict[str, Any]:
        version = self._variant_version(variant_version_id)
        variant = self._variant(version.variant_ref)
        eval_set = self._eval_set_version(eval_set_version_id)
        case_versions = [self._eval_case_version(case_version_ref) for case_version_ref in eval_set.case_version_refs]
        return {
            "variant": to_jsonable(variant),
            "variant_version": to_jsonable(version),
            "eval_set_version": self._eval_set_payload(eval_set),
            "score": self.aggregate_score(version.id, eval_set.id),
            "result_counts": self.result_counts(version.id, eval_set.id),
            "cases": [
                {
                    **self._case_detail(case_version),
                    "result": self.case_result(version.id, eval_set.id, case_version.id),
                }
                for case_version in case_versions
            ],
        }

    def skill_bundle_detail(self, artifact_id: str) -> Dict[str, Any]:
        artifact = self._artifact(artifact_id)
        if artifact.kind != "skill_bundle":
            raise ValueError("Artifact %s is not a skill_bundle" % artifact_id)
        payload = json.loads(artifact.content)
        files = payload.get("files", {})
        if not isinstance(files, dict):
            raise ValueError("Skill bundle artifact has invalid files")
        return {
            "artifact": to_jsonable(artifact),
            "metadata": payload.get("metadata", {}),
            "files": [{"path": path, "content": files[path]} for path in sorted(files)],
        }

    def create_eval_case(
        self,
        skill_id: str,
        title: str,
        input_text: str,
        expected_output: str,
        source_type: str = "manual",
    ) -> Dict[str, Any]:
        corpus = self._corpus_for_skill(skill_id)
        current_eval_set = self.latest_eval_set_for_skill(skill_id)
        created_at = now_iso()
        sequence = len(self.data.eval_cases) + 1
        case_id = "case-%d" % sequence
        case_version_id = "casever-%d-v1" % sequence
        input_artifact_id = "artifact-%s-input" % case_id
        expected_artifact_id = "artifact-%s-expected" % case_id

        self.data.artifacts.extend(
            [
                Artifact(
                    id=input_artifact_id,
                    kind="eval_input",
                    content=input_text,
                    content_hash=digest(input_text),
                    media_type="text/plain",
                    created_at=created_at,
                ),
                Artifact(
                    id=expected_artifact_id,
                    kind="expected_output",
                    content=expected_output,
                    content_hash=digest(expected_output),
                    media_type="text/plain",
                    created_at=created_at,
                ),
            ]
        )

        eval_case = EvalCase(
            id=case_id,
            corpus_ref=corpus.id,
            title=title,
            source_type=source_type,  # type: ignore[arg-type]
            current_version_ref=case_version_id,
            created_at=created_at,
        )
        eval_case_version = EvalCaseVersion(
            id=case_version_id,
            case_ref=case_id,
            version="v1",
            input_artifact_ref=input_artifact_id,
            expectation_artifact_ref=expected_artifact_id,
            grader_ref="manual-pass-fail-v1",
            expectation=expected_output,
            created_at=created_at,
        )
        self.data.eval_cases.append(eval_case)
        self.data.eval_case_versions.append(eval_case_version)

        next_number = len([item for item in self.data.eval_set_versions if item.corpus_ref == corpus.id]) + 1
        eval_set = EvalSetVersion(
            id=self._unique_id("evalset-v%d" % next_number, [item.id for item in self.data.eval_set_versions], created_at),
            corpus_ref=corpus.id,
            version="v%d" % next_number,
            case_version_refs=[*current_eval_set.case_version_refs, eval_case_version.id],
            created_at=created_at,
        )
        self.data.eval_set_versions.append(eval_set)
        return {
            "eval_case": to_jsonable(eval_case),
            "eval_case_version": to_jsonable(eval_case_version),
            "eval_set_version": self._eval_set_payload(eval_set),
        }

    def create_eval_case_version(
        self,
        case_id: str,
        input_text: str,
        expected_output: str,
        make_current: bool = True,
    ) -> Dict[str, Any]:
        eval_case = self._eval_case(case_id)
        corpus = self._corpus(eval_case.corpus_ref)
        current_eval_set = self._latest_eval_set_for_corpus(corpus.id)
        created_at = now_iso()
        existing_versions = [item for item in self.data.eval_case_versions if item.case_ref == eval_case.id]
        next_number = len(existing_versions) + 1
        case_version_id = self._unique_id(
            "casever-%s-v%d" % (eval_case.id, next_number),
            [item.id for item in self.data.eval_case_versions],
            created_at,
        )
        input_artifact_id = "artifact-%s-input" % case_version_id
        expected_artifact_id = "artifact-%s-expected" % case_version_id

        self.data.artifacts.extend(
            [
                Artifact(
                    id=input_artifact_id,
                    kind="eval_input",
                    content=input_text,
                    content_hash=digest(input_text),
                    media_type="text/plain",
                    created_at=created_at,
                ),
                Artifact(
                    id=expected_artifact_id,
                    kind="expected_output",
                    content=expected_output,
                    content_hash=digest(expected_output),
                    media_type="text/plain",
                    created_at=created_at,
                ),
            ]
        )

        eval_case_version = EvalCaseVersion(
            id=case_version_id,
            case_ref=eval_case.id,
            version="v%d" % next_number,
            input_artifact_ref=input_artifact_id,
            expectation_artifact_ref=expected_artifact_id,
            grader_ref="manual-pass-fail-v1",
            expectation=expected_output,
            created_at=created_at,
        )
        self.data.eval_case_versions.append(eval_case_version)

        eval_set = None
        if make_current:
            eval_case.current_version_ref = eval_case_version.id
            next_eval_set_number = len([item for item in self.data.eval_set_versions if item.corpus_ref == corpus.id]) + 1
            refs = self._replace_case_version_ref(current_eval_set.case_version_refs, eval_case.id, eval_case_version.id)
            eval_set = EvalSetVersion(
                id=self._unique_id(
                    "evalset-v%d" % next_eval_set_number,
                    [item.id for item in self.data.eval_set_versions],
                    created_at,
                ),
                corpus_ref=corpus.id,
                version="v%d" % next_eval_set_number,
                case_version_refs=refs,
                created_at=created_at,
            )
            self.data.eval_set_versions.append(eval_set)

        return {
            "eval_case": to_jsonable(eval_case),
            "eval_case_version": to_jsonable(eval_case_version),
            "eval_set_version": self._eval_set_payload(eval_set) if eval_set is not None else None,
        }

    def create_skill(
        self,
        slug: str,
        owner_ref: str,
        variant_name: str,
        variant_label: str,
        variant_summary: str,
        tags: List[str],
        change_note: str = "",
        content: str = "",
    ) -> Dict[str, Any]:
        created_at = now_iso()
        slug = slug.strip()
        slug_token = self._slug_token(slug)
        skill_id = self._unique_id("skill-%s" % slug_token, [item.id for item in self.data.skills], created_at)
        corpus_id = self._unique_id("corpus-%s" % slug_token, [item.id for item in self.data.eval_corpora], created_at)
        eval_set_id = self._unique_id("evalset-%s-v1" % slug_token, [item.id for item in self.data.eval_set_versions], created_at)

        skill = Skill(
            id=skill_id,
            slug=slug,
            owner_ref=owner_ref,
            default_variant_ref="",
            created_at=created_at,
        )
        self.data.skills.append(skill)
        self.data.eval_corpora.append(EvalCorpus(id=corpus_id, skill_ref=skill.id, created_at=created_at))
        eval_set = EvalSetVersion(
            id=eval_set_id,
            corpus_ref=corpus_id,
            version="v1",
            case_version_refs=[],
            created_at=created_at,
        )
        self.data.eval_set_versions.append(eval_set)

        variant_result = self.create_variant(
            skill_id=skill.id,
            name=variant_name,
            label=variant_label,
            summary=variant_summary,
            tags=tags,
            change_note=change_note,
            content=content,
        )
        skill.default_variant_ref = variant_result["variant"]["id"]
        return {
            "skill": to_jsonable(skill),
            "variant": variant_result["variant"],
            "variant_version": variant_result["variant_version"],
            "eval_set_version": self._eval_set_payload(eval_set),
        }

    def update_skill(
        self,
        skill_id: str,
        slug: Optional[str] = None,
        owner_ref: Optional[str] = None,
        default_variant_ref: Optional[str] = None,
        lifecycle_status: Optional[str] = None,
    ) -> Dict[str, Any]:
        skill = self._skill(skill_id)
        if slug is not None:
            skill.slug = slug
        if owner_ref is not None:
            skill.owner_ref = owner_ref
        if default_variant_ref is not None:
            variant = self._variant(default_variant_ref)
            if variant.skill_ref != skill.id:
                raise ValueError("Default variant must belong to skill %s" % skill.id)
            if variant.lifecycle_status != "active":
                raise ValueError("Default variant must be active")
            skill.default_variant_ref = default_variant_ref
        if lifecycle_status is not None:
            self._set_lifecycle(skill, lifecycle_status)
        return {"skill": to_jsonable(skill)}

    def create_variant(
        self,
        skill_id: str,
        name: str,
        label: str,
        summary: str,
        tags: List[str],
        change_note: str = "",
        content: str = "",
    ) -> Dict[str, Any]:
        self._corpus_for_skill(skill_id)
        created_at = now_iso()
        normalized_tags = sorted({tag.strip() for tag in tags if tag.strip()})
        tags_hash = "|".join(normalized_tags) or "untagged"
        tag_set = next((item for item in self.data.tag_sets if item.tags_hash == tags_hash), None)
        if tag_set is None:
            tag_set = TagSet(
                id="tagset-%s-%s" % (tags_hash.replace("|", "-"), digest(created_at)[:6]),
                tags_hash=tags_hash,
                tags=normalized_tags,
            )
            self.data.tag_sets.append(tag_set)

        variant_id = "variant-%s" % digest("%s-%s-%s" % (skill_id, name, created_at))[:8]
        version_id = "version-%s-v1" % variant_id
        content_digest = "sha-%s" % digest(content or "%s-%s" % (variant_id, created_at))[:8]
        variant = Variant(
            id=variant_id,
            skill_ref=skill_id,
            name=name,
            label=label,
            summary=summary,
            tag_set_ref=tag_set.id,
            current_version_ref=version_id,
            created_at=created_at,
        )
        variant_version = VariantVersion(
            id=version_id,
            variant_ref=variant_id,
            version="v1",
            content_ref=ContentRef(
                kind="inline_bundle",
                locator=name.lower().replace(" ", "-"),
                digest=content_digest,
            ),
            change_note=change_note or "初始版本。",
            created_at=created_at,
        )
        self.data.variants.append(variant)
        self.data.variant_versions.append(variant_version)
        return {
            "variant": to_jsonable(variant),
            "variant_version": to_jsonable(variant_version),
            "tag_set": to_jsonable(tag_set),
        }

    def import_skill_bundle(self, name: str, files: Dict[str, str], content_locator: Optional[str] = None) -> Dict[str, Any]:
        payload = skill_bundle_payload(name, files)
        normalized_files = payload["files"]
        if not isinstance(normalized_files, dict):
            raise ValueError("Skill bundle payload has invalid files")
        metadata = payload["metadata"]
        if not isinstance(metadata, dict):
            raise ValueError("Skill bundle payload has invalid metadata")
        bundle_name = str(payload["name"])
        content = skill_bundle_content(name, files)
        content_hash = digest(content)
        existing = next(
            (item for item in self.data.artifacts if item.kind == "skill_bundle" and item.content_hash == content_hash),
            None,
        )
        created_at = now_iso()
        if existing is None:
            artifact_id = self._unique_id(
                "artifact-skill-bundle-%s-%s" % (self._slug_token(bundle_name), content_hash[:8]),
                [item.id for item in self.data.artifacts],
                created_at,
            )
            existing = Artifact(
                id=artifact_id,
                kind="skill_bundle",
                content=content_locator or content,
                content_hash=content_hash,
                media_type="application/vnd.skillhub.bundle+json",
                created_at=created_at,
            )
            self.data.artifacts.append(existing)

        content_ref = ContentRef(
            kind="skill_bundle",
            locator=existing.id,
            digest="sha-%s" % existing.content_hash,
            path="/",
        )
        return {
            "content_ref": to_jsonable(content_ref),
            "metadata": metadata,
            "files": sorted(normalized_files.keys()),
        }

    def update_variant(
        self,
        variant_id: str,
        label: Optional[str] = None,
        summary: Optional[str] = None,
        lifecycle_status: Optional[str] = None,
    ) -> Dict[str, Any]:
        variant = self._variant(variant_id)
        if label is not None:
            variant.label = label
        if summary is not None:
            variant.summary = summary
        if lifecycle_status is not None:
            skill = self._skill(variant.skill_ref)
            if lifecycle_status == "archived" and skill.default_variant_ref == variant.id:
                raise ValueError("Cannot archive the default variant; choose another default variant first")
            self._set_lifecycle(variant, lifecycle_status)
        return {"variant": to_jsonable(variant)}

    def publish_variant_version(
        self,
        variant_id: str,
        change_note: str,
        content: str = "",
        content_ref: Optional[ContentRef] = None,
        make_current: bool = False,
    ) -> Dict[str, Any]:
        variant = self._variant(variant_id)
        created_at = now_iso()
        existing = [item for item in self.data.variant_versions if item.variant_ref == variant.id]
        next_number = len(existing) + 1
        locator = "%s-v%d" % (variant.name.lower().replace(" ", "-"), next_number)
        content_digest = "sha-%s" % digest(content or "%s-%s" % (variant.id, created_at))[:8]
        resolved_content_ref = content_ref or ContentRef(kind="inline_bundle", locator=locator, digest=content_digest)
        self._validate_content_ref(resolved_content_ref)
        version = VariantVersion(
            id="version-%s-v%d" % (variant.id, next_number),
            variant_ref=variant.id,
            version="v%d" % next_number,
            content_ref=resolved_content_ref,
            change_note=change_note,
            created_at=created_at,
        )
        self.data.variant_versions.append(version)
        if make_current:
            variant.current_version_ref = version.id
        return {"variant": to_jsonable(variant), "variant_version": to_jsonable(version)}

    def record_eval_run(
        self,
        variant_version_id: str,
        eval_set_version_id: str,
        results: Dict[str, bool],
    ) -> Dict[str, Any]:
        eval_set = self._eval_set_version(eval_set_version_id)
        variant_version = self._variant_version(variant_version_id)
        variant = self._variant(variant_version.variant_ref)
        corpus = self._corpus_for_skill(variant.skill_ref)
        if eval_set.corpus_ref != corpus.id:
            raise ValueError("Eval set must belong to the same skill as variant version %s" % variant_version_id)
        created_at = now_iso()
        run_id = "run-%s-%s-%s" % (variant_version_id, eval_set_version_id, digest(created_at))
        run = EvalRun(
            id=run_id,
            variant_version_ref=variant_version_id,
            eval_set_version_ref=eval_set_version_id,
            strategy_ref="manual-eval-v1",
            run_config_hash="manual-v1",
            status="finished",
            started_at=created_at,
            finished_at=created_at,
        )
        self.data.eval_runs.append(run)
        for case_version_ref in eval_set.case_version_refs:
            passed = bool(results.get(case_version_ref, False))
            self.data.case_results.append(
                CaseResult(run_ref=run.id, case_version_ref=case_version_ref, passed=passed, score=1 if passed else 0)
            )
        return {"eval_run": to_jsonable(run), "result_counts": self.result_counts(variant_version_id, eval_set_version_id)}

    def latest_eval_set_for_skill(self, skill_id: str) -> EvalSetVersion:
        corpus = self._corpus_for_skill(skill_id)
        return self._latest_eval_set_for_corpus(corpus.id)

    def _latest_eval_set_for_corpus(self, corpus_id: str) -> EvalSetVersion:
        versions = [item for item in self.data.eval_set_versions if item.corpus_ref == corpus_id]
        if not versions:
            raise KeyError("No eval set version for corpus %s" % corpus_id)
        return sorted(versions, key=lambda item: item.version)[-1]

    def tags_for_variant(self, variant_id: str) -> List[str]:
        variant = self._variant(variant_id)
        tag_set = next(item for item in self.data.tag_sets if item.id == variant.tag_set_ref)
        return tag_set.tags

    def aggregate_score(self, variant_version_id: str, eval_set_version_id: str) -> Optional[float]:
        eval_set = self._eval_set_version(eval_set_version_id)
        if not eval_set.case_version_refs:
            return None
        scores = [self.case_result(variant_version_id, eval_set_version_id, case_ref) for case_ref in eval_set.case_version_refs]
        if any(item is None for item in scores):
            return None
        return sum(1 if item and item["passed"] else 0 for item in scores) / len(scores)

    def result_counts(self, variant_version_id: str, eval_set_version_id: str) -> Dict[str, int]:
        eval_set = self._eval_set_version(eval_set_version_id)
        counts = {"passed": 0, "failed": 0, "missing": 0, "total": len(eval_set.case_version_refs)}
        for case_ref in eval_set.case_version_refs:
            result = self.case_result(variant_version_id, eval_set_version_id, case_ref)
            if result is None:
                counts["missing"] += 1
            elif result["passed"]:
                counts["passed"] += 1
            else:
                counts["failed"] += 1
        return counts

    def case_result(self, variant_version_id: str, eval_set_version_id: str, case_version_id: str) -> Optional[Dict[str, Any]]:
        latest_run = self._latest_run(variant_version_id, eval_set_version_id)
        if latest_run is None:
            return None
        result = next(
            (item for item in self.data.case_results if item.run_ref == latest_run.id and item.case_version_ref == case_version_id),
            None,
        )
        return to_jsonable(result) if result else None

    def _verification_runs(self, variant: Variant, version: VariantVersion) -> List[Dict[str, Any]]:
        corpus = self._corpus_for_skill(variant.skill_ref)
        eval_sets = [item for item in self.data.eval_set_versions if item.corpus_ref == corpus.id]
        eval_sets.sort(key=lambda item: item.version, reverse=True)
        return [
            {
                "eval_set_version": self._eval_set_payload(eval_set),
                "eval_run": to_jsonable(self._latest_run(version.id, eval_set.id)),
                "score": self.aggregate_score(version.id, eval_set.id),
                "result_counts": self.result_counts(version.id, eval_set.id),
            }
            for eval_set in eval_sets
        ]

    def _latest_run(self, variant_version_id: str, eval_set_version_id: str) -> Optional[EvalRun]:
        runs = [
            run
            for run in self.data.eval_runs
            if run.variant_version_ref == variant_version_id and run.eval_set_version_ref == eval_set_version_id and run.status == "finished"
        ]
        if not runs:
            return None
        return sorted(runs, key=lambda run: run.started_at)[-1]

    def _eval_set_payload(self, eval_set: EvalSetVersion) -> Dict[str, Any]:
        payload = to_jsonable(eval_set)
        payload["case_refs"] = list(eval_set.case_version_refs)
        return payload

    def _case_detail(self, case_version: EvalCaseVersion) -> Dict[str, Any]:
        eval_case = self._eval_case(case_version.case_ref)
        return {
            **to_jsonable(eval_case),
            "id": case_version.id,
            "case_ref": eval_case.id,
            "case_version": to_jsonable(case_version),
            "input_artifact_ref": case_version.input_artifact_ref,
            "expectation_artifact_ref": case_version.expectation_artifact_ref,
            "grader_ref": case_version.grader_ref,
            "expectation": case_version.expectation,
            "created_at": case_version.created_at,
            "input": self._artifact(case_version.input_artifact_ref).content,
            "expected_output": self._artifact(case_version.expectation_artifact_ref).content,
        }

    def _skill(self, skill_id: str):
        skill = next((item for item in self.data.skills if item.id == skill_id), None)
        if skill is None:
            raise KeyError("Unknown skill %s" % skill_id)
        return skill

    def _variant(self, variant_id: str):
        variant = next((item for item in self.data.variants if item.id == variant_id), None)
        if variant is None:
            raise KeyError("Unknown variant %s" % variant_id)
        return variant

    def _variant_version(self, version_id: str):
        version = next((item for item in self.data.variant_versions if item.id == version_id), None)
        if version is None:
            raise KeyError("Unknown variant version %s" % version_id)
        return version

    def _eval_set_version(self, eval_set_version_id: str):
        version = next((item for item in self.data.eval_set_versions if item.id == eval_set_version_id), None)
        if version is None:
            raise KeyError("Unknown eval set version %s" % eval_set_version_id)
        return version

    def _eval_case(self, case_id: str):
        eval_case = next((item for item in self.data.eval_cases if item.id == case_id), None)
        if eval_case is None:
            raise KeyError("Unknown eval case %s" % case_id)
        return eval_case

    def _eval_case_version(self, case_version_id: str):
        case_version = next((item for item in self.data.eval_case_versions if item.id == case_version_id), None)
        if case_version is None:
            raise KeyError("Unknown eval case version %s" % case_version_id)
        return case_version

    def _corpus_for_skill(self, skill_id: str):
        corpus = next((item for item in self.data.eval_corpora if item.skill_ref == skill_id), None)
        if corpus is None:
            raise KeyError("Unknown eval corpus for skill %s" % skill_id)
        return corpus

    def _corpus(self, corpus_id: str):
        corpus = next((item for item in self.data.eval_corpora if item.id == corpus_id), None)
        if corpus is None:
            raise KeyError("Unknown eval corpus %s" % corpus_id)
        return corpus

    def _artifact(self, artifact_id: str):
        artifact = next((item for item in self.data.artifacts if item.id == artifact_id), None)
        if artifact is None:
            raise KeyError("Unknown artifact %s" % artifact_id)
        return artifact

    def _validate_content_ref(self, content_ref: ContentRef) -> None:
        if content_ref.kind != "skill_bundle":
            return
        artifact = self._artifact(content_ref.locator)
        if artifact.kind != "skill_bundle":
            raise ValueError("ContentRef locator must point to a skill_bundle artifact")
        if content_ref.digest != "sha-%s" % artifact.content_hash:
            raise ValueError("ContentRef digest does not match bundle artifact")

    def _replace_case_version_ref(self, refs: List[str], case_id: str, next_case_version_id: str) -> List[str]:
        replaced = False
        next_refs: List[str] = []
        for case_version_ref in refs:
            case_version = self._eval_case_version(case_version_ref)
            if case_version.case_ref == case_id:
                if not replaced:
                    next_refs.append(next_case_version_id)
                    replaced = True
                continue
            next_refs.append(case_version_ref)
        if not replaced:
            next_refs.append(next_case_version_id)
        return next_refs

    def _set_lifecycle(self, item, lifecycle_status: str) -> None:
        if lifecycle_status not in {"active", "archived"}:
            raise ValueError("lifecycle_status must be active or archived")
        item.lifecycle_status = lifecycle_status
        item.archived_at = now_iso() if lifecycle_status == "archived" else None

    def _normalize_bundle_files(self, files: Dict[str, str]) -> Dict[str, str]:
        return normalize_bundle_files(files)

    def _skill_md_metadata(self, content: str) -> Dict[str, str]:
        return skill_md_metadata(content)

    def _unique_id(self, base_id: str, existing_ids: List[str], salt: str) -> str:
        if base_id not in existing_ids:
            return base_id
        return "%s-%s" % (base_id, digest(salt)[:6])

    def _slug_token(self, slug: str) -> str:
        token = slug.strip().lower().replace(" ", "-")
        return "".join(char for char in token if char.isalnum() or char in ("-", "_", ".")) or "skill"
