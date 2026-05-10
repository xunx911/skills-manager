"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { passRate } from "@/lib/api";
import { emptySkillDetail } from "@/lib/empty-state";
import { percent, shortId } from "@/lib/format";
import { PromotionReviewPane } from "@/components/promotion-review/promotion-review-pane";
import { RunComparisonPanel } from "@/components/run-comparison/run-comparison-panel";
import type {
  BundleDiff,
  BundleDiffFile,
  BundleDiffStatus,
  BundleFile,
  EvalCaseHistory,
  EvalRunComparison,
  EvalRunRecord,
  EvalRunDetail,
  EvalRunHistory,
  EvalSetVersionDetail,
  PromotionDecision,
  PromotionReview,
  SkillDetail,
  SkillSummary,
  VariantDetail,
  VariantVersion,
} from "@/lib/types";
import { Badge } from "./chrome";

const API_BASE_URL = process.env.NEXT_PUBLIC_SKILLHUB_API_URL ?? "http://127.0.0.1:8000";
const ACTOR = "product-operator";

type DecisionWorkbenchProps = {
  skills: SkillSummary[];
  featuredSkill: SkillDetail;
};

type Mode = "overview" | "variants" | "evals" | "diff" | "history" | "promotion";
type ActionMode =
  | "skill"
  | "new-skill"
  | "import-skill"
  | "new-variant"
  | "new-version"
  | "new-case"
  | "edit-case"
  | "run";
type Notice = { tone: "good" | "bad" | "neutral"; message: string } | null;
type ImportSkillResponse = { skill_id: string; slug: string; file_count: number };
type ImportPreview = {
  tone: "good" | "bad" | "neutral";
  title: string;
  detail: string;
} | null;
type CommandResult = string | void | { message?: string; selectedSkillId?: string };
type RunFilters = {
  variant_version_id: string;
  eval_set_version_id: string;
  strategy: string;
  status: string;
};
type BundleSource =
  | { kind: "zip"; name: string; zip_base64: string }
  | {
      kind: "files";
      name: string;
      files: Array<
        | { path: string; content_text: string }
        | { path: string; content_base64: string }
      >;
    };
type DiffFilter = "all" | BundleDiffStatus | "binary";

export function DecisionWorkbench({ skills: initialSkills, featuredSkill }: DecisionWorkbenchProps) {
  const [skills, setSkills] = useState(initialSkills);
  const [selectedSkillId, setSelectedSkillId] = useState(initialSkills[0]?.skill.id ?? featuredSkill.skill.id);
  const [selectedDetail, setSelectedDetail] = useState<SkillDetail>(featuredSkill);
  const [evalSetDetail, setEvalSetDetail] = useState<EvalSetVersionDetail | null>(null);
  const [caseResults, setCaseResults] = useState<Record<string, boolean | null>>({});
  const [mode, setMode] = useState<Mode>("overview");
  const [actionMode, setActionMode] = useState<ActionMode>(initialSkills.length > 0 ? "skill" : "import-skill");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview>(null);
  const [bundleDiff, setBundleDiff] = useState<BundleDiff | null>(null);
  const [diffLeftVersionId, setDiffLeftVersionId] = useState<string | null>(null);
  const [diffRightVersionId, setDiffRightVersionId] = useState<string | null>(null);
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null);
  const [diffFilter, setDiffFilter] = useState<DiffFilter>("all");
  const [diffLoading, setDiffLoading] = useState(false);
  const [runHistory, setRunHistory] = useState<EvalRunHistory | null>(null);
  const [runHistoryLoading, setRunHistoryLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunDetail, setSelectedRunDetail] = useState<EvalRunDetail | null>(null);
  const [compareBaselineRunId, setCompareBaselineRunId] = useState<string | null>(null);
  const [compareCandidateRunId, setCompareCandidateRunId] = useState<string | null>(null);
  const [runComparison, setRunComparison] = useState<EvalRunComparison | null>(null);
  const [runComparisonLoading, setRunComparisonLoading] = useState(false);
  const [runFilters, setRunFilters] = useState<RunFilters>({
    variant_version_id: "all",
    eval_set_version_id: "all",
    strategy: "all",
    status: "all",
  });
  const [caseHistory, setCaseHistory] = useState<EvalCaseHistory | null>(null);
  const [caseHistoryCaseId, setCaseHistoryCaseId] = useState<string | null>(null);
  const [caseHistoryLoading, setCaseHistoryLoading] = useState(false);
  const [evalTargetVersionId, setEvalTargetVersionId] = useState<string | null>(null);
  const [promotionReview, setPromotionReview] = useState<PromotionReview | null>(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const visibleSkills = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    if (!query) return skills;
    return skills.filter((summary) => {
      const tags = summary.default_variant?.tags.join(" ") ?? "";
      return `${summary.skill.slug} ${summary.skill.owner_ref} ${tags}`.toLowerCase().includes(query);
    });
  }, [catalogQuery, skills]);
  const selectedSummary = useMemo(
    () => skills.find((summary) => summary.skill.id === selectedSkillId) ?? selectedDetail.summary,
    [selectedDetail.summary, selectedSkillId, skills],
  );
  const defaultVariant = selectedDetail.summary.default_variant ?? selectedSummary.default_variant;
  const primaryEvalSet = selectedDetail.eval_sets[0] ?? selectedSummary.primary_eval_set;
  const currentEvalSetVersion = primaryEvalSet?.current_version ?? null;
  const latestRun = selectedDetail.latest_eval_runs[0] ?? selectedSummary.latest_accepted_eval_run;
  const score = latestRun ? passRate(latestRun) : null;
  const variantVersionOptions = useMemo(
    () =>
      selectedDetail.variants.flatMap((variant) =>
        sortedVersions(variant.versions).map((version) => ({
          variant,
          version,
          label: `${variant.label} v${version.version_number}`,
          isCurrent: variant.current_version?.id === version.id,
        })),
      ),
    [selectedDetail.variants],
  );
  const evalTargetVersion =
    variantVersionOptions.find((item) => item.version.id === evalTargetVersionId)?.version ??
    defaultVariant?.current_version ??
    variantVersionOptions[0]?.version ??
    null;
  const cases = evalSetDetail?.cases ?? [];
  const selectedCase = cases.find((item) => item.case.id === selectedCaseId) ?? cases[0] ?? null;
  const passedDraft = cases.filter((item) => caseResults[item.case_version.id] === true).length;
  const failedDraft = cases.filter((item) => caseResults[item.case_version.id] === false).length;
  const confirmedDraft = passedDraft + failedDraft;
  const hasPersistedSkill = selectedDetail.skill.lifecycle_status !== "empty";

  useEffect(() => {
    void loadSkill(selectedSkillId);
    setBundleDiff(null);
    setDiffLeftVersionId(null);
    setDiffRightVersionId(null);
    setSelectedDiffPath(null);
    setDiffFilter("all");
    setRunHistory(null);
    setSelectedRunId(null);
    setSelectedRunDetail(null);
    setCompareBaselineRunId(null);
    setCompareCandidateRunId(null);
    setRunComparison(null);
    setRunComparisonLoading(false);
    setCaseHistory(null);
    setCaseHistoryCaseId(null);
    setEvalTargetVersionId(null);
    setPromotionReview(null);
    setPromotionLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSkillId]);

  useEffect(() => {
    if (variantVersionOptions.length === 0) {
      if (evalTargetVersionId) setEvalTargetVersionId(null);
      return;
    }
    if (evalTargetVersionId && variantVersionOptions.some((item) => item.version.id === evalTargetVersionId)) {
      return;
    }
    setEvalTargetVersionId(defaultVariant?.current_version?.id ?? variantVersionOptions[0].version.id);
  }, [defaultVariant?.current_version?.id, evalTargetVersionId, variantVersionOptions]);

  useEffect(() => {
    if (!currentEvalSetVersion) {
      setEvalSetDetail(null);
      setCaseResults({});
      return;
    }
    void loadEvalSetVersion(currentEvalSetVersion.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvalSetVersion?.id]);

  useEffect(() => {
    if (mode !== "history" || !hasPersistedSkill) return;
    void loadRunHistory(selectedDetail.skill.id, runFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    hasPersistedSkill,
    selectedDetail.skill.id,
    runFilters.variant_version_id,
    runFilters.eval_set_version_id,
    runFilters.strategy,
    runFilters.status,
  ]);

  useEffect(() => {
    if (mode !== "history" || !selectedRunId) {
      setSelectedRunDetail(null);
      return;
    }
    void loadSelectedRunDetail(selectedRunId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedRunId]);

  useEffect(() => {
    if (mode !== "history" || !compareBaselineRunId || !compareCandidateRunId) {
      setRunComparison(null);
      return;
    }
    if (compareBaselineRunId === compareCandidateRunId) {
      setRunComparison(null);
      return;
    }
    void loadRunComparison(compareBaselineRunId, compareCandidateRunId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, compareBaselineRunId, compareCandidateRunId]);

  useEffect(() => {
    if (!runHistory) return;
    const visibleRunIds = new Set(runHistory.runs.map((row) => row.eval_run.id));
    if (compareBaselineRunId && !visibleRunIds.has(compareBaselineRunId)) setCompareBaselineRunId(null);
    if (compareCandidateRunId && !visibleRunIds.has(compareCandidateRunId)) setCompareCandidateRunId(null);
  }, [compareBaselineRunId, compareCandidateRunId, runHistory]);

  function chooseAction(nextActionMode: ActionMode) {
    setActionMode(nextActionMode);
    if (nextActionMode === "new-case" || nextActionMode === "edit-case" || nextActionMode === "run") {
      setMode("evals");
    }
    if (nextActionMode === "new-variant" || nextActionMode === "new-version") {
      setMode("variants");
    }
    if (nextActionMode === "skill" || nextActionMode === "new-skill" || nextActionMode === "import-skill") {
      setMode("overview");
    }
  }

  async function loadSkills(nextSelectedId = selectedSkillId) {
    const nextSkills = await apiGet<SkillSummary[]>("/api/skills");
    setSkills(nextSkills);
    if (nextSkills.length === 0) {
      setSelectedSkillId(emptySkillDetail.skill.id);
      setSelectedDetail(emptySkillDetail);
      setEvalSetDetail(null);
      setCaseResults({});
      chooseAction("import-skill");
      return;
    }
    const nextId = nextSkills.some((item) => item.skill.id === nextSelectedId)
      ? nextSelectedId
      : nextSkills[0].skill.id;
    setSelectedSkillId(nextId);
    await loadSkill(nextId);
  }

  async function loadSkill(skillId: string) {
    if (skillId === emptySkillDetail.skill.id) {
      setSelectedDetail(emptySkillDetail);
      return;
    }
    try {
      setSelectedDetail(await apiGet<SkillDetail>(`/api/skills/${skillId}`));
    } catch {
      if (skillId === featuredSkill.skill.id) setSelectedDetail(featuredSkill);
    }
  }

  async function loadEvalSetVersion(evalSetVersionId: string) {
    try {
      const detail = await apiGet<EvalSetVersionDetail>(`/api/eval-set-versions/${evalSetVersionId}`);
      setEvalSetDetail(detail);
      setCaseResults(Object.fromEntries(detail.cases.map((item) => [item.case_version.id, null])));
      setCaseHistory(null);
      setCaseHistoryCaseId(null);
    } catch {
      setEvalSetDetail(null);
      setCaseResults({});
      setCaseHistory(null);
      setCaseHistoryCaseId(null);
    }
  }

  async function loadRunHistory(skillId: string, filters: RunFilters) {
    setRunHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value !== "all") params.set(key, value);
      }
      const query = params.toString();
      const history = await apiGet<EvalRunHistory>(`/api/skills/${skillId}/eval-runs${query ? `?${query}` : ""}`);
      setRunHistory(history);
      setSelectedRunId((current) => {
        if (current && history.runs.some((row) => row.eval_run.id === current)) return current;
        return history.runs[0]?.eval_run.id ?? null;
      });
      if (history.runs.length === 0) setSelectedRunDetail(null);
    } catch (error) {
      setRunHistory(null);
      setSelectedRunId(null);
      setSelectedRunDetail(null);
      setNotice({ tone: "bad", message: error instanceof Error ? error.message : "加载测评历史失败" });
    } finally {
      setRunHistoryLoading(false);
    }
  }

  async function loadSelectedRunDetail(evalRunId: string) {
    try {
      setSelectedRunDetail(await apiGet<EvalRunDetail>(`/api/eval-runs/${evalRunId}`));
    } catch (error) {
      setSelectedRunDetail(null);
      setNotice({ tone: "bad", message: error instanceof Error ? error.message : "加载 run 详情失败" });
    }
  }

  async function loadRunComparison(baselineRunId: string, candidateRunId: string) {
    setRunComparisonLoading(true);
    setNotice(null);
    try {
      const params = new URLSearchParams({
        baseline_run_id: baselineRunId,
        candidate_run_id: candidateRunId,
      });
      setRunComparison(await apiGet<EvalRunComparison>(`/api/eval-runs/compare?${params.toString()}`));
    } catch (error) {
      setRunComparison(null);
      setNotice({ tone: "bad", message: error instanceof Error ? error.message : "比较 run 失败：请选择同一个 EvalSetVersion 下的两次 run" });
    } finally {
      setRunComparisonLoading(false);
    }
  }

  function chooseComparisonRun(role: "baseline" | "candidate", runId: string) {
    if (role === "baseline") {
      setCompareBaselineRunId(runId);
      if (compareCandidateRunId === runId) setCompareCandidateRunId(null);
      return;
    }
    setCompareCandidateRunId(runId);
    if (compareBaselineRunId === runId) setCompareBaselineRunId(null);
  }

  async function acceptComparisonCandidate(note: string) {
    if (!runComparison) return;
    await runCommand("候选 run 已接受为验证依据。", async () => {
      await apiSend<{ ok: boolean }>("/api/eval-runs/accepted-verifications", {
        method: "POST",
        body: {
          eval_run_id: runComparison.candidate.eval_run.id,
          note,
          actor: ACTOR,
        },
      });
      await loadRunHistory(selectedDetail.skill.id, runFilters);
      await loadRunComparison(runComparison.baseline.eval_run.id, runComparison.candidate.eval_run.id);
      return "候选 run 已接受为验证依据。";
    });
  }

  async function loadCaseHistory(caseId: string) {
    setCaseHistoryLoading(true);
    setCaseHistoryCaseId(caseId);
    setSelectedCaseId(caseId);
    setMode("evals");
    try {
      setCaseHistory(await apiGet<EvalCaseHistory>(`/api/eval-cases/${caseId}/versions`));
    } catch (error) {
      setCaseHistory(null);
      setNotice({ tone: "bad", message: error instanceof Error ? error.message : "加载 case 历史失败" });
    } finally {
      setCaseHistoryLoading(false);
    }
  }

  async function loadBundleDiff(leftVariantVersionId: string, rightVariantVersionId: string) {
    setDiffLoading(true);
    setNotice(null);
    try {
      const diff = await apiGet<BundleDiff>(
        `/api/artifacts/diff?left_variant_version_id=${encodeURIComponent(leftVariantVersionId)}&right_variant_version_id=${encodeURIComponent(rightVariantVersionId)}`,
      );
      setBundleDiff(diff);
      setSelectedDiffPath((current) => {
        if (current && diff.files.some((file) => file.path === current)) return current;
        return diff.files[0]?.path ?? null;
      });
    } catch (error) {
      setBundleDiff(null);
      setSelectedDiffPath(null);
      setNotice({ tone: "bad", message: error instanceof Error ? error.message : "加载版本 diff 失败" });
    } finally {
      setDiffLoading(false);
    }
  }

  function openDiffMode(variant = defaultVariant) {
    setMode("diff");
    const pair = defaultDiffPair(variant);
    if (!pair) {
      setBundleDiff(null);
      setSelectedDiffPath(null);
      return;
    }
    setDiffLeftVersionId(pair.left.id);
    setDiffRightVersionId(pair.right.id);
    void loadBundleDiff(pair.left.id, pair.right.id);
  }

  function updateDiffPair(leftVariantVersionId: string, rightVariantVersionId: string) {
    setDiffLeftVersionId(leftVariantVersionId);
    setDiffRightVersionId(rightVariantVersionId);
    if (leftVariantVersionId && rightVariantVersionId && leftVariantVersionId !== rightVariantVersionId) {
      void loadBundleDiff(leftVariantVersionId, rightVariantVersionId);
    }
  }

  async function openPromotionReview(variantId: string, candidateVersionId: string) {
    setMode("promotion");
    setPromotionLoading(true);
    setPromotionReview(null);
    setNotice(null);
    try {
      const params = new URLSearchParams({ candidate_version_id: candidateVersionId });
      if (currentEvalSetVersion?.id) params.set("eval_set_version_id", currentEvalSetVersion.id);
      const review = await apiGet<PromotionReview>(`/api/variants/${variantId}/promotion-review?${params.toString()}`);
      setPromotionReview(review);
    } catch (error) {
      setNotice({ tone: "bad", message: error instanceof Error ? error.message : "加载设为当前版本评审失败" });
    } finally {
      setPromotionLoading(false);
    }
  }

  async function promoteFromReview(decisionNote: string) {
    if (!promotionReview?.candidate_run) {
      setNotice({ tone: "bad", message: "候选版本还没有可用的测评证据。" });
      return;
    }
    await runCommand("已设为当前版本。", async () => {
      await apiSend<{ ok: boolean; promotion_decision: PromotionDecision }>("/api/variants/promotions", {
        method: "POST",
        body: {
          variant_id: promotionReview.variant.id,
          version_id: promotionReview.candidate_version.id,
          evidence_eval_run_id: promotionReview.candidate_run?.id,
          eval_set_version_id: promotionReview.eval_set_version.id,
          decision_note: decisionNote || null,
          accept_risk: promotionReview.readiness.status === "risky",
          actor: ACTOR,
        },
      });
      setPromotionReview(null);
      setMode("variants");
      return "已设为当前版本。";
    });
  }

  async function runCommand(message: string, command: () => Promise<CommandResult>) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await command();
      const nextSelectedId = typeof result === "object" && result?.selectedSkillId ? result.selectedSkillId : selectedSkillId;
      const resultMessage = typeof result === "string" ? result : typeof result === "object" ? result?.message : undefined;
      await loadSkills(nextSelectedId);
      setNotice({ tone: "good", message: resultMessage || message });
    } catch (error) {
      setNotice({ tone: "bad", message: error instanceof Error ? error.message : "操作失败" });
    } finally {
      setBusy(false);
    }
  }

  async function createSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const slug = textValue(form, "slug");
    await runCommand("Skill 已创建。", async () => {
      const summary = textValue(form, "summary");
      const result = await apiSend<{ skill_id: string }>("/api/skills", {
        method: "POST",
        body: {
          slug,
          owner_ref: textValue(form, "owner_ref"),
          variant_name: "Default",
          variant_label: textValue(form, "variant_label"),
          variant_summary: summary,
          tags: tagList(textValue(form, "tags")),
          content_ref: {
            kind: "skill_bundle",
            locator: `inline:${slug}`,
            digest: await digestText(summary + slug),
          },
          change_summary: textValue(form, "change_summary"),
          actor: ACTOR,
        },
      });
      setCatalogQuery("");
      chooseAction("skill");
      formElement.reset();
      return { selectedSkillId: result.skill_id };
    });
  }

  async function importSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const zipInput = formElement.elements.namedItem("zip_file") as HTMLInputElement | null;
    const folderInput = formElement.elements.namedItem("folder_files") as HTMLInputElement | null;
    const zipFile = zipInput?.files?.[0];
    const folderFiles = Array.from(folderInput?.files ?? []);
    if ((!zipFile || zipFile.size === 0) && folderFiles.length === 0) {
      setNotice({ tone: "bad", message: "请选择包含 SKILL.md 的文件夹，或上传一个 zip。" });
      return;
    }
    if (zipFile && zipFile.size > 0 && folderFiles.length > 0) {
      setNotice({ tone: "bad", message: "文件夹和 zip 只能选择一种来源。" });
      return;
    }
    await runCommand("Skill bundle 已导入。", async () => {
      const source = await sourceFromSelectedBundle({ folderFiles, zipFile });
      const result = await apiSend<ImportSkillResponse>("/api/skill-imports", {
        method: "POST",
        body: {
          owner_ref: textValue(form, "owner_ref"),
          tags: tagList(textValue(form, "tags")),
          variant_label: textValue(form, "variant_label") || "Imported",
          source,
          actor: ACTOR,
        },
      });
      setCatalogQuery("");
      chooseAction("skill");
      setImportPreview(null);
      formElement.reset();
      return {
        message: `已导入 ${result.slug}，包含 ${result.file_count} 个文件。`,
        selectedSkillId: result.skill_id,
      };
    });
  }

  async function refreshImportPreview(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const zipInput = form.elements.namedItem("zip_file") as HTMLInputElement | null;
    const folderInput = form.elements.namedItem("folder_files") as HTMLInputElement | null;
    const zipFile = zipInput?.files?.[0];
    const folderFiles = Array.from(folderInput?.files ?? []);
    if (zipFile && zipFile.size > 0 && folderFiles.length > 0) {
      setImportPreview({ tone: "bad", title: "来源冲突", detail: "文件夹和 zip 只能选择一种。" });
      return;
    }
    if (zipFile && zipFile.size > 0) {
      setImportPreview({
        tone: "neutral",
        title: zipFile.name,
        detail: `Zip bundle · ${formatBytes(zipFile.size)} · 提交后由后端校验 SKILL.md。`,
      });
      return;
    }
    if (folderFiles.length === 0) {
      setImportPreview(null);
      return;
    }
    const skillFile = folderFiles.find((file) => (file.webkitRelativePath || file.name).endsWith("SKILL.md"));
    if (!skillFile) {
      setImportPreview({ tone: "bad", title: "缺少 SKILL.md", detail: `${folderFiles.length} 个文件中没有找到 SKILL.md。` });
      return;
    }
    const metadata = parseSkillMetadata(await skillFile.text());
    setImportPreview({
      tone: metadata.name && metadata.description ? "good" : "bad",
      title: metadata.name || "未识别 name",
      detail: metadata.description
        ? `${metadata.description} · ${folderFiles.length} files`
        : "SKILL.md frontmatter 需要 description。",
    });
  }

  async function updateSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runCommand("Skill 已更新。", async () => {
      await apiSend(`/api/skills/${selectedDetail.skill.id}`, {
        method: "PATCH",
        body: { slug: textValue(form, "slug"), owner_ref: textValue(form, "owner_ref") },
      });
    });
  }

  async function archiveSkill() {
    await runCommand("Skill 已归档。", async () => {
      await apiSend(`/api/skills/${selectedDetail.skill.id}`, { method: "DELETE" });
      return "Skill 已归档，历史版本和测评记录仍保留。";
    });
  }

  async function createVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await runCommand("Variant 已创建。", async () => {
      const label = textValue(form, "label");
      const summary = textValue(form, "summary");
      await apiSend("/api/variants", {
        method: "POST",
        body: {
          skill_id: selectedDetail.skill.id,
          name: label,
          label,
          summary,
          tags: tagList(textValue(form, "tags")),
          content_ref: {
            kind: "skill_bundle",
            locator: `inline:${selectedDetail.skill.slug}/${label}`,
            digest: await digestText(summary + textValue(form, "tags")),
          },
          change_summary: textValue(form, "change_summary"),
          actor: ACTOR,
          make_default: form.get("make_default") === "on",
        },
      });
      formElement.reset();
    });
  }

  async function createVariantVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const zipInput = formElement.elements.namedItem("version_zip_file") as HTMLInputElement | null;
    const folderInput = formElement.elements.namedItem("version_folder_files") as HTMLInputElement | null;
    const zipFile = zipInput?.files?.[0];
    const folderFiles = Array.from(folderInput?.files ?? []);
    if (zipFile && zipFile.size > 0 && folderFiles.length > 0) {
      setNotice({ tone: "bad", message: "文件夹和 zip 只能选择一种来源。" });
      return;
    }
    if ((!zipFile || zipFile.size === 0) && folderFiles.length === 0 && !textValue(form, "content")) {
      setNotice({ tone: "bad", message: "请选择标准 Skill 文件夹、zip，或填写 content_ref 摘要。" });
      return;
    }
    await runCommand("Variant 版本已创建。", async () => {
      const variantId = textValue(form, "variant_id");
      const content = textValue(form, "content");
      const hasBundleSource = (zipFile && zipFile.size > 0) || folderFiles.length > 0;
      const source = hasBundleSource
        ? await sourceFromSelectedBundle({ folderFiles, zipFile })
        : null;
      await apiSend("/api/variant-versions", {
        method: "POST",
        body: {
          variant_id: variantId,
          ...(source
            ? { source }
            : {
                content_ref: {
                  kind: "skill_bundle",
                  locator: `inline:${variantId}/${Date.now()}`,
                  digest: await digestText(content),
                },
              }),
          change_summary: textValue(form, "change_summary"),
          actor: ACTOR,
          make_current: form.get("make_current") === "on",
        },
      });
      formElement.reset();
    });
  }

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await runCommand("测试用例已加入当前评测集。", async () => {
      const result = await apiSend<{ eval_case_id: string }>("/api/eval-cases", {
        method: "POST",
        body: {
          skill_id: selectedDetail.skill.id,
          title: textValue(form, "title"),
          input_text: textValue(form, "input_text"),
          expected_output: textValue(form, "expected_output"),
          notes: textValue(form, "notes"),
          actor: ACTOR,
        },
      });
      setSelectedCaseId(result.eval_case_id);
      chooseAction("run");
      formElement.reset();
    });
  }

  async function updateCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runCommand("测试用例新版本已保存。", async () => {
      await apiSend(`/api/eval-cases/${textValue(form, "case_id")}`, {
        method: "PATCH",
        body: {
          case_id: textValue(form, "case_id"),
          title: textValue(form, "title"),
          input_text: textValue(form, "input_text"),
          expected_output: textValue(form, "expected_output"),
          notes: textValue(form, "notes"),
          actor: ACTOR,
          make_current: true,
        },
      });
      setSelectedCaseId(textValue(form, "case_id"));
    });
  }

  async function archiveCase(caseId: string) {
    await runCommand("测试用例已归档。", async () => {
      await apiSend(`/api/eval-cases/${caseId}`, { method: "DELETE" });
      if (selectedCaseId === caseId) setSelectedCaseId(null);
    });
  }

  async function recordEvalRun() {
    if (!evalTargetVersion || !currentEvalSetVersion) return;
    const missing = cases.filter((item) => typeof caseResults[item.case_version.id] !== "boolean");
    if (missing.length > 0) {
      setNotice({ tone: "bad", message: `还有 ${missing.length} 条测试用例没有确认通过或不通过。` });
      chooseAction("run");
      return;
    }
    await runCommand("手工测评已记录。", async () => {
      const results = Object.fromEntries(
        cases.map((item) => [item.case_version.id, caseResults[item.case_version.id] === true]),
      );
      const result = await apiSend<{ passed: number; total: number }>("/api/eval-runs", {
        method: "POST",
        body: {
          variant_version_id: evalTargetVersion.id,
          eval_set_version_id: currentEvalSetVersion.id,
          strategy: "manual_pass_fail",
          results,
          actor: ACTOR,
        },
      });
      return `已记录 ${result.passed}/${result.total} 通过。`;
    });
  }

  function setAllCases(passed: boolean) {
    setCaseResults(Object.fromEntries(cases.map((item) => [item.case_version.id, passed])));
  }

  return (
    <div className="linearWorkbench">
      <aside className="linearCatalog" aria-label="Skill catalog">
        <div className="linearCatalogTop">
          <div>
            <span>SkillHub</span>
            <small>{skills.length} skills</small>
          </div>
          <div className="catalogTopActions">
            <button onClick={() => chooseAction("import-skill")} type="button">导入</button>
            <button onClick={() => chooseAction("new-skill")} type="button">新建</button>
          </div>
        </div>
        <label className="linearSearch">
          <span>Filter</span>
          <input
            onChange={(event) => setCatalogQuery(event.currentTarget.value)}
            placeholder="skill、owner、tag"
            value={catalogQuery}
          />
        </label>
        <div className="linearSkillList">
          {visibleSkills.map((summary) => {
            const isSelected = summary.skill.id === selectedDetail.skill.id;
            const run = summary.latest_accepted_eval_run;
            const rate = run ? passRate(run) : null;
            return (
              <button
                className={`linearSkillItem ${isSelected ? "linearSkillItemActive" : ""}`}
                key={summary.skill.id}
                onClick={() => {
                  setSelectedSkillId(summary.skill.id);
                  chooseAction("skill");
                  setSelectedCaseId(null);
                }}
                type="button"
              >
                <span className="linearSkillTitle">
                  <strong>{summary.skill.slug}</strong>
                  <i>{run ? percent(rate) : "未测"}</i>
                </span>
                <span>{summary.skill.owner_ref}</span>
                <span>{summary.default_variant?.tags.join(" + ") ?? "draft"}</span>
              </button>
            );
          })}
          {visibleSkills.length === 0 ? (
            <div className="linearCatalogEmpty">{skills.length === 0 ? "还没有 skill。先导入 bundle 或新建一个。" : "没有匹配的 skill"}</div>
          ) : null}
        </div>
      </aside>

      <main className="linearMain">
        <header className="linearHeader">
          <div>
            <p>{selectedDetail.skill.owner_ref} / {selectedDetail.skill.lifecycle_status}</p>
            <h1>{selectedDetail.skill.slug}</h1>
          </div>
          <nav className="linearTabs" aria-label="Workbench modes">
            <button className={mode === "overview" ? "linearTabActive" : ""} onClick={() => setMode("overview")} type="button">概览</button>
            <button className={mode === "variants" ? "linearTabActive" : ""} onClick={() => setMode("variants")} type="button">变体</button>
            <button className={mode === "evals" ? "linearTabActive" : ""} onClick={() => setMode("evals")} type="button">测评</button>
            <button className={mode === "diff" ? "linearTabActive" : ""} onClick={() => openDiffMode()} type="button">差异</button>
            <button className={mode === "history" ? "linearTabActive" : ""} onClick={() => setMode("history")} type="button">历史</button>
            {mode === "promotion" || promotionReview ? (
              <button className={mode === "promotion" ? "linearTabActive" : ""} onClick={() => setMode("promotion")} type="button">评审</button>
            ) : null}
          </nav>
        </header>

        {notice ? <div className={`linearNotice linearNotice-${notice.tone}`}>{notice.message}</div> : null}

        {mode === "overview" ? (
          <OverviewPane
            defaultVariant={defaultVariant}
            hasPersistedSkill={hasPersistedSkill}
            latestRun={latestRun}
            onAction={chooseAction}
            onDiff={() => openDiffMode()}
            primaryEvalSetVersion={currentEvalSetVersion?.version_number}
            score={score}
            selectedDetail={selectedDetail}
          />
        ) : null}

        {mode === "variants" ? (
          <VariantsPane
            defaultVariant={defaultVariant}
            onAction={chooseAction}
            onDiff={() => openDiffMode()}
            onPromotionReview={openPromotionReview}
            variants={selectedDetail.variants}
          />
        ) : null}

        {mode === "diff" ? (
          <DiffPane
            diff={bundleDiff}
            filter={diffFilter}
            leftVersionId={diffLeftVersionId}
            loading={diffLoading}
            onPairChange={updateDiffPair}
            onPromotionReview={openPromotionReview}
            onSelectFile={setSelectedDiffPath}
            onSetFilter={setDiffFilter}
            rightVersionId={diffRightVersionId}
            selectedPath={selectedDiffPath}
            variant={defaultVariant}
          />
        ) : null}

        {mode === "history" ? (
          <HistoryPane
            busy={busy}
            compareBaselineRunId={compareBaselineRunId}
            compareCandidateRunId={compareCandidateRunId}
            evalSets={selectedDetail.eval_sets}
            filters={runFilters}
            loading={runHistoryLoading}
            onAcceptComparison={acceptComparisonCandidate}
            onAction={chooseAction}
            onChooseComparisonRun={chooseComparisonRun}
            onFilterChange={(key, value) => setRunFilters((current) => ({ ...current, [key]: value }))}
            onSelectRun={setSelectedRunId}
            runComparison={runComparison}
            runComparisonLoading={runComparisonLoading}
            runDetail={selectedRunDetail}
            runHistory={runHistory}
            selectedRunId={selectedRunId}
            variants={selectedDetail.variants}
          />
        ) : null}

        {mode === "promotion" ? (
          <PromotionReviewPane
            busy={busy}
            loading={promotionLoading}
            onBack={() => setMode("variants")}
            onOpenEvals={() => setMode("evals")}
            onPromote={promoteFromReview}
            review={promotionReview}
          />
        ) : null}

        {mode === "evals" ? (
          <EvalsPane
            busy={busy}
            caseHistory={caseHistory}
            caseHistoryCaseId={caseHistoryCaseId}
            caseHistoryLoading={caseHistoryLoading}
            caseResults={caseResults}
            cases={cases}
            confirmedDraft={confirmedDraft}
            currentEvalSetVersion={currentEvalSetVersion?.version_number}
            evalTargetVersionId={evalTargetVersion?.id ?? ""}
            evalTargetVersions={variantVersionOptions}
            failedDraft={failedDraft}
            onAction={chooseAction}
            onArchiveCase={archiveCase}
            onEditCase={(caseId) => {
              setSelectedCaseId(caseId);
              chooseAction("edit-case");
            }}
            onHistoryCase={loadCaseHistory}
            onRecord={recordEvalRun}
            onSelectCase={setSelectedCaseId}
            onSelectEvalTargetVersion={setEvalTargetVersionId}
            onSetAll={setAllCases}
            onToggle={(caseVersionId, passed) => {
              setCaseResults((current) => ({ ...current, [caseVersionId]: passed }));
              setActionMode("run");
            }}
            passedDraft={passedDraft}
            selectedCaseId={selectedCase?.case.id ?? null}
          />
        ) : null}
      </main>

      <aside className="linearInspector" aria-label="Inspector">
        <Inspector
          actionMode={actionMode}
          busy={busy}
          cases={cases}
          createCase={createCase}
          importSkill={importSkill}
          createSkill={createSkill}
          createVariant={createVariant}
          createVariantVersion={createVariantVersion}
          currentEvalSetVersionId={currentEvalSetVersion?.id}
          defaultVariant={defaultVariant}
          latestRun={latestRun}
          onAction={chooseAction}
          onArchiveSkill={archiveSkill}
          onSelectCase={setSelectedCaseId}
          importPreview={importPreview}
          confirmedDraft={confirmedDraft}
          failedDraft={failedDraft}
          hasPersistedSkill={hasPersistedSkill}
          passedDraft={passedDraft}
          recordEvalRun={recordEvalRun}
          refreshImportPreview={refreshImportPreview}
          score={score}
          selectedCase={selectedCase}
          selectedDetail={selectedDetail}
          updateCase={updateCase}
          updateSkill={updateSkill}
        />
      </aside>
    </div>
  );
}

function OverviewPane({
  defaultVariant,
  hasPersistedSkill,
  latestRun,
  onAction,
  onDiff,
  primaryEvalSetVersion,
  score,
  selectedDetail,
}: {
  defaultVariant: VariantDetail | null;
  hasPersistedSkill: boolean;
  latestRun: EvalRunRecord | null;
  onAction: (mode: ActionMode) => void;
  onDiff: () => void;
  primaryEvalSetVersion?: number;
  score: number | null;
  selectedDetail: SkillDetail;
}) {
  const currentVersion = defaultVariant?.current_version ?? null;
  const bundleFiles = bundleFilesFromVariant(defaultVariant);
  const skillMd = fileContent(bundleFiles, "SKILL.md") ?? formatBundlePreview(defaultVariant);
  const tags = defaultVariant?.tags ?? [];

  if (!hasPersistedSkill) {
    return (
      <div className="linearPane overviewPane">
        <section className="emptySkillStudio">
          <div>
            <span>First run</span>
            <h2>把第一个标准 Skill 接进来</h2>
            <p>
              正式版首页仍然是普通 SkillHub 的入口；工作台只在选中 skill 后展开。现在先导入包含 SKILL.md 的 bundle，
              或创建一个草稿 skill，然后补 variant、case 和手工测评结果。
            </p>
            <div className="emptyStudioActions">
              <button aria-label="从空状态导入 bundle" onClick={() => onAction("import-skill")} type="button">导入 bundle</button>
              <button aria-label="从空状态新建 skill" onClick={() => onAction("new-skill")} type="button">新建 skill</button>
            </div>
          </div>
          <div className="emptyStudioChecklist">
            <strong>闭环路径</strong>
            <span>1. Skill = default variant 引用</span>
            <span>2. Variant = current version 引用</span>
            <span>3. EvalSetVersion = case version 快照</span>
            <span>4. EvalRun = exact variant version + exact eval set version</span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="linearPane overviewPane">
      <section className="productHero">
        <div className="productHeroCopy">
          <span>Default distribution</span>
          <h2>{defaultVariant?.label ?? "暂无默认 variant"}</h2>
          <p>{defaultVariant?.summary ?? "这个 skill 还没有默认 variant。先创建或导入一个标准 Skill bundle。"}</p>
          <div className="tagLine">
            {tags.length > 0 ? tags.map((tag) => <Badge key={tag} tone="blue">{tag}</Badge>) : <Badge>draft</Badge>}
          </div>
        </div>
        <div className="heroScore">
          <span>Verified score</span>
          <strong>{latestRun ? percent(score) : "未测"}</strong>
          <small>{latestRun ? `${latestRun.summary.passed ?? 0}/${latestRun.summary.total ?? 0} cases passed` : "等待第一次手工测评"}</small>
        </div>
      </section>

      <div className="linearMetrics">
        <Metric label="变体数" value={String(selectedDetail.variants.length)} />
        <Metric label="当前版本" value={currentVersion ? `v${currentVersion.version_number}` : "暂无"} />
        <Metric label="测评集版本" value={primaryEvalSetVersion ? `v${primaryEvalSetVersion}` : "暂无"} />
        <Metric label="最近分数" tone={latestRun ? (score === 100 ? "good" : "bad") : "neutral"} value={latestRun ? percent(score) : "未测"} />
      </div>

      <section className="linearSection bundleSection">
        <div className="linearSectionHeader">
          <div>
            <h3>Skill bundle</h3>
            <p>{bundleFiles.length > 0 ? `${bundleFiles.length} files · ${currentVersion?.content_digest ?? ""}` : currentVersion?.content_ref.locator}</p>
          </div>
          <div className="sectionActions">
            <button onClick={() => onAction("new-version")} type="button">追加版本</button>
            <button disabled={!defaultVariant || defaultVariant.versions.length < 2} onClick={onDiff} type="button">比较版本</button>
            <Link href={defaultVariant ? `/variants/${defaultVariant.id}` : "#"}>打开详情</Link>
          </div>
        </div>
        <div className="linearBundle">
          <div className="bundleFileList">
            {bundleFiles.length > 0 ? (
              bundleFiles.map((file) => (
                <span className={file.path === "SKILL.md" ? "bundleFileActive" : ""} key={file.path}>
                  {file.path}
                  {typeof file.size_bytes === "number" ? <small>{formatBytes(file.size_bytes)}</small> : null}
                </span>
              ))
            ) : (
              <span className="bundleFileActive">content_ref</span>
            )}
          </div>
          <pre>{skillMd}</pre>
        </div>
      </section>
    </div>
  );
}

function VariantsPane({
  defaultVariant,
  onAction,
  onDiff,
  onPromotionReview,
  variants,
}: {
  defaultVariant: VariantDetail | null;
  onAction: (mode: ActionMode) => void;
  onDiff: () => void;
  onPromotionReview: (variantId: string, candidateVersionId: string) => void;
  variants: VariantDetail[];
}) {
  const historyCount = variants.reduce((total, variant) => total + variant.versions.length, 0);

  return (
    <div className="linearPane">
      <div className="linearToolbar">
        <div>
          <h2>变体空间</h2>
          <p>{variants.length} 个当前变体 · {historyCount} 个历史版本 · 默认分发保持清晰可见。</p>
        </div>
        <div>
          <button onClick={() => onAction("new-variant")} type="button">添加 variant</button>
          <button onClick={() => onAction("new-version")} type="button">追加版本</button>
          <button disabled={!defaultVariant || defaultVariant.versions.length < 2} onClick={onDiff} type="button">比较版本</button>
        </div>
      </div>
      <div className="variantMapCanvas">
        {variants.map((variant) => (
          <article className={`variantMapCard ${variant.id === defaultVariant?.id ? "variantMapCardDefault" : ""}`} key={variant.id}>
            <Link href={`/variants/${variant.id}`}>
              <span>{variant.id === defaultVariant?.id ? "Default variant" : "Variant"}</span>
              <strong>{variant.label}</strong>
              <p>{variant.summary}</p>
            </Link>
            <div className="tagLine">
              {variant.tags.map((tag) => <Badge key={tag} tone="blue">{tag}</Badge>)}
            </div>
            <div className="variantMapMeta">
              <small>{variant.current_version ? `current v${variant.current_version.version_number}` : "no current version"}</small>
              <small>{variant.versions.length} versions</small>
            </div>
            <div className="variantVersionList" aria-label={`${variant.label} versions`}>
              {sortedVersions(variant.versions).map((version) => {
                const isCurrent = version.id === variant.current_version?.id;
                return (
                  <div className="variantVersionRow" key={version.id}>
                    <span>
                      <b>v{version.version_number}</b>
                      <small>{version.change_summary}</small>
                    </span>
                    {isCurrent ? (
                      <Badge tone="good">Current</Badge>
                    ) : (
                      <button onClick={() => onPromotionReview(variant.id, version.id)} type="button">
                        设为当前版本评审
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function DiffPane({
  diff,
  filter,
  leftVersionId,
  loading,
  onPairChange,
  onPromotionReview,
  onSelectFile,
  onSetFilter,
  rightVersionId,
  selectedPath,
  variant,
}: {
  diff: BundleDiff | null;
  filter: DiffFilter;
  leftVersionId: string | null;
  loading: boolean;
  onPairChange: (leftVariantVersionId: string, rightVariantVersionId: string) => void;
  onPromotionReview: (variantId: string, candidateVersionId: string) => void;
  onSelectFile: (path: string) => void;
  onSetFilter: (filter: DiffFilter) => void;
  rightVersionId: string | null;
  selectedPath: string | null;
  variant: VariantDetail | null;
}) {
  const versions = sortedVersions(variant?.versions ?? []);
  const rightVersion = versions.find((version) => version.id === rightVersionId) ?? null;
  const canReviewRight = Boolean(variant && rightVersion && rightVersion.id !== variant.current_version?.id);
  const filteredFiles = filterDiffFiles(diff?.files ?? [], filter);
  const selectedFile = filteredFiles.find((file) => file.path === selectedPath) ?? filteredFiles[0] ?? null;

  if (!variant || versions.length < 2) {
    return (
      <div className="linearPane diffPane">
        <div className="linearToolbar">
          <div>
            <h2>版本差异</h2>
            <p>至少需要两个不可变 VariantVersion，才能比较标准 Skill bundle 的文件变化。</p>
          </div>
        </div>
        <div className="linearEmpty">当前默认 variant 还没有可比较的历史版本。先从右侧追加一个版本。</div>
      </div>
    );
  }

  return (
    <div className="linearPane diffPane">
      <div className="linearToolbar">
        <div>
          <h2>版本差异</h2>
          <p>{variant.label} · {diff ? `v${diff.left.version_number} -> v${diff.right.version_number}` : "选择两个版本后加载 diff"}</p>
        </div>
        <div className="diffSelectors">
          <label>
            <span>From</span>
            <select
              onChange={(event) => updatePairFromSelect(event.currentTarget.value, rightVersionId, onPairChange)}
              value={leftVersionId ?? ""}
            >
              {versions.map((version) => (
                <option disabled={version.id === rightVersionId} key={version.id} value={version.id}>
                  v{version.version_number}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>To</span>
            <select
              onChange={(event) => updatePairFromSelect(leftVersionId, event.currentTarget.value, onPairChange)}
              value={rightVersionId ?? ""}
            >
              {versions.map((version) => (
                <option disabled={version.id === leftVersionId} key={version.id} value={version.id}>
                  v{version.version_number}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!canReviewRight}
            onClick={() => {
              if (variant && rightVersion) onPromotionReview(variant.id, rightVersion.id);
            }}
            type="button"
          >
            设为当前版本评审
          </button>
        </div>
      </div>

      <section className="diffWorkbench" aria-busy={loading}>
        <div className="diffSummary">
          <Metric label="Changed" value={String(diff?.summary.changed ?? 0)} />
          <Metric label="Added" tone="good" value={String(diff?.summary.added ?? 0)} />
          <Metric label="Removed" tone="bad" value={String(diff?.summary.removed ?? 0)} />
          <Metric label="Binary" value={String(diff?.summary.binary ?? 0)} />
        </div>

        <div className="diffFilterBar" aria-label="Diff filters">
          {[
            ["all", "全部"],
            ["changed", "修改"],
            ["added", "新增"],
            ["removed", "删除"],
            ["binary", "二进制"],
          ].map(([value, label]) => (
            <button
              className={filter === value ? "diffFilterActive" : ""}
              key={value}
              onClick={() => onSetFilter(value as DiffFilter)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="diffGrid">
          <aside className="diffFileRail" aria-label="Changed files">
            {loading ? <div className="linearEmpty">正在加载 diff...</div> : null}
            {!loading && filteredFiles.length === 0 ? <div className="linearEmpty">这个筛选下没有文件变化。</div> : null}
            {filteredFiles.map((file) => (
              <button
                className={`diffFileRow ${selectedFile?.path === file.path ? "diffFileRowActive" : ""}`}
                key={file.path}
                onClick={() => onSelectFile(file.path)}
                type="button"
              >
                <span>{file.path}</span>
                <small>{file.binary ? "binary" : file.status}</small>
              </button>
            ))}
          </aside>

          <section className="diffDetail">
            {selectedFile ? (
              <>
                <div className="diffDetailHead">
                  <div>
                    <span>{selectedFile.status}</span>
                    <strong>{selectedFile.path}</strong>
                  </div>
                  <small>{diffFileSizeLabel(selectedFile)}</small>
                </div>
                {selectedFile.binary ? (
                  <div className="diffBinaryNotice">二进制文件不展示文本 diff；仍保留 digest 和大小用于审查。</div>
                ) : (
                  <div className="diffCode">
                    {(selectedFile.hunks ?? []).flatMap((hunk, hunkIndex) =>
                      hunk.lines.map((line, lineIndex) => (
                        <div className={`diffLine diffLine-${line.kind}`} key={`${hunkIndex}-${lineIndex}`}>
                          <span>{line.old_line ?? ""}</span>
                          <span>{line.new_line ?? ""}</span>
                          <code>{diffLinePrefix(line.kind)}{line.text || " "}</code>
                        </div>
                      )),
                    )}
                    {(selectedFile.hunks ?? []).length === 0 ? <div className="diffBinaryNotice">没有可展示的文本变化。</div> : null}
                  </div>
                )}
              </>
            ) : (
              <div className="evalCaseDetailEmpty">
                <strong>等待 diff</strong>
                <span>选择两个 bundle 版本后，这里会显示文件级和行级变化。</span>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function HistoryPane({
  busy,
  compareBaselineRunId,
  compareCandidateRunId,
  evalSets,
  filters,
  loading,
  onAcceptComparison,
  onAction,
  onChooseComparisonRun,
  onFilterChange,
  onSelectRun,
  runComparison,
  runComparisonLoading,
  runDetail,
  runHistory,
  selectedRunId,
  variants,
}: {
  busy: boolean;
  compareBaselineRunId: string | null;
  compareCandidateRunId: string | null;
  evalSets: SkillDetail["eval_sets"];
  filters: RunFilters;
  loading: boolean;
  onAcceptComparison: (note: string) => void;
  onAction: (mode: ActionMode) => void;
  onChooseComparisonRun: (role: "baseline" | "candidate", runId: string) => void;
  onFilterChange: (key: keyof RunFilters, value: string) => void;
  onSelectRun: (runId: string) => void;
  runComparison: EvalRunComparison | null;
  runComparisonLoading: boolean;
  runDetail: EvalRunDetail | null;
  runHistory: EvalRunHistory | null;
  selectedRunId: string | null;
  variants: VariantDetail[];
}) {
  const rows = runHistory?.runs ?? [];
  const selectedRow = rows.find((row) => row.eval_run.id === selectedRunId) ?? rows[0] ?? null;
  const variantVersions = variants.flatMap((variant) =>
    variant.versions.map((version) => ({
      id: version.id,
      label: `${variant.label} v${version.version_number}`,
    })),
  );
  const evalSetVersions = evalSets.flatMap((evalSet) =>
    evalSet.versions.map((version) => ({
      id: version.id,
      label: `${evalSet.name} v${version.version_number}`,
    })),
  );

  return (
    <div className="linearPane historyPane">
      <div className="linearToolbar">
        <div>
          <h2>历史记录</h2>
          <p>{loading ? "正在加载 runs..." : `${rows.length} runs · exact VariantVersion + EvalSetVersion bindings`}</p>
        </div>
        <div className="historyFilters">
          <label>
            <span>Variant</span>
            <select
              aria-label="Variant version filter"
              onChange={(event) => onFilterChange("variant_version_id", event.currentTarget.value)}
              value={filters.variant_version_id}
            >
              <option value="all">All versions</option>
              {variantVersions.map((version) => (
                <option key={version.id} value={version.id}>{version.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Eval set</span>
            <select
              aria-label="Eval set version filter"
              onChange={(event) => onFilterChange("eval_set_version_id", event.currentTarget.value)}
              value={filters.eval_set_version_id}
            >
              <option value="all">All snapshots</option>
              {evalSetVersions.map((version) => (
                <option key={version.id} value={version.id}>{version.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Strategy</span>
            <select
              aria-label="Strategy filter"
              onChange={(event) => onFilterChange("strategy", event.currentTarget.value)}
              value={filters.strategy}
            >
              <option value="all">All strategies</option>
              <option value="manual_pass_fail">manual_pass_fail</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              aria-label="Status filter"
              onChange={(event) => onFilterChange("status", event.currentTarget.value)}
              value={filters.status}
            >
              <option value="all">All statuses</option>
              <option value="finished">finished</option>
              <option value="failed">failed</option>
            </select>
          </label>
        </div>
      </div>

      <div className="historyGrid">
        <section className="historyRunList" aria-label="Eval run history">
          {rows.map((row) => {
            const isSelected = row.eval_run.id === selectedRunId;
            const isBaseline = row.eval_run.id === compareBaselineRunId;
            const isCandidate = row.eval_run.id === compareCandidateRunId;
            return (
              <article
                className={`historyRunRow ${isSelected ? "historyRunRowActive" : ""} ${row.accepted_verification ? "historyRunAccepted" : ""}`}
                key={row.eval_run.id}
              >
                <button className="historyRunMain" onClick={() => onSelectRun(row.eval_run.id)} type="button">
                  <span>
                    <strong>{runFraction(row.eval_run)}</strong>
                    <small>{percent(passRate(row.eval_run))}</small>
                  </span>
                  <span>
                    <b>{row.variant.label} v{row.variant_version.version_number}</b>
                    <small>{row.eval_set.name} v{row.eval_set_version.version_number}</small>
                  </span>
                  <span>
                    <b>{row.eval_run.strategy}</b>
                    <small>{row.eval_run.status} · {formatDate(row.eval_run.created_at)}</small>
                  </span>
                </button>
                <div className="historyRunCompareActions">
                  {row.accepted_verification ? <Badge tone="good">Accepted</Badge> : null}
                  <button className={isBaseline ? "historyCompareActive" : ""} onClick={() => onChooseComparisonRun("baseline", row.eval_run.id)} type="button">
                    对照
                  </button>
                  <button className={isCandidate ? "historyCompareActive" : ""} onClick={() => onChooseComparisonRun("candidate", row.eval_run.id)} type="button">
                    候选
                  </button>
                </div>
              </article>
            );
          })}
          {!loading && rows.length === 0 ? (
            <div className="historyEmpty">
              <strong>还没有测评历史</strong>
              <span>先在“测评”里记录一次 run，历史页会按 exact version binding 展示。</span>
              <button onClick={() => onAction("run")} type="button">去记录测评</button>
            </div>
          ) : null}
        </section>

        <section className="historyRunDetail">
          <RunComparisonPanel
            busy={busy}
            comparison={runComparison}
            loading={runComparisonLoading}
            onAccept={onAcceptComparison}
          />
          {selectedRow ? (
            <>
              <div className="historyDetailHead">
                <div>
                  <span>Selected run</span>
                  <strong>{runFraction(selectedRow.eval_run)} · {percent(passRate(selectedRow.eval_run))}</strong>
                </div>
                <Link href={`/eval-runs/${selectedRow.eval_run.id}`}>打开详情</Link>
              </div>
              <div className="historyBindingGrid">
                <Metric label="VariantVersion" value={`v${selectedRow.variant_version.version_number}`} />
                <Metric label="EvalSetVersion" value={`v${selectedRow.eval_set_version.version_number}`} />
                <Metric label="Strategy" value={selectedRow.eval_run.strategy} />
                <Metric label="Status" value={selectedRow.eval_run.status} />
              </div>
              <div className="historyCaseResults">
                <div className="evalCaseRailHead">
                  <strong>Case results</strong>
                  <span>{runDetail?.case_results.length ?? 0} cases</span>
                </div>
                {runDetail?.case_results.map((item) => (
                  <article className="historyCaseResult" key={item.result.case_version_id}>
                    <div>
                      <span>case v{item.case_version.version_number}</span>
                      <strong>{item.case.title}</strong>
                    </div>
                    <Badge tone={item.result.passed ? "good" : "bad"}>{item.result.passed ? "通过" : "不通过"}</Badge>
                  </article>
                ))}
                {!runDetail ? <div className="linearEmpty">正在加载 run 详情...</div> : null}
              </div>
            </>
          ) : (
            <div className="evalCaseDetailEmpty">
              <strong>等待历史记录</strong>
              <span>记录测评后，这里会显示逐 case 结果。</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EvalsPane({
  busy,
  caseHistory,
  caseHistoryCaseId,
  caseHistoryLoading,
  caseResults,
  cases,
  confirmedDraft,
  currentEvalSetVersion,
  evalTargetVersionId,
  evalTargetVersions,
  failedDraft,
  onAction,
  onArchiveCase,
  onEditCase,
  onHistoryCase,
  onRecord,
  onSelectCase,
  onSelectEvalTargetVersion,
  onSetAll,
  onToggle,
  passedDraft,
  selectedCaseId,
}: {
  busy: boolean;
  caseHistory: EvalCaseHistory | null;
  caseHistoryCaseId: string | null;
  caseHistoryLoading: boolean;
  caseResults: Record<string, boolean | null>;
  cases: EvalSetVersionDetail["cases"];
  confirmedDraft: number;
  currentEvalSetVersion?: number;
  evalTargetVersionId: string;
  evalTargetVersions: Array<{
    variant: VariantDetail;
    version: VariantVersion;
    label: string;
    isCurrent: boolean;
  }>;
  failedDraft: number;
  onAction: (mode: ActionMode) => void;
  onArchiveCase: (caseId: string) => void;
  onEditCase: (caseId: string) => void;
  onHistoryCase: (caseId: string) => void;
  onRecord: () => void;
  onSelectCase: (caseId: string) => void;
  onSelectEvalTargetVersion: (versionId: string) => void;
  onSetAll: (passed: boolean) => void;
  onToggle: (caseVersionId: string, passed: boolean) => void;
  passedDraft: number;
  selectedCaseId: string | null;
}) {
  return (
    <div className="linearPane evalPane">
      <div className="linearToolbar">
        <div>
          <h2>手工测评</h2>
          <p>EvalSetVersion {currentEvalSetVersion ? `v${currentEvalSetVersion}` : "暂无"} · 已确认 {confirmedDraft}/{cases.length} · 通过 {passedDraft} · 不通过 {failedDraft}</p>
        </div>
        <div>
          <button onClick={() => onAction("new-case")} type="button">添加 case</button>
          <button disabled={cases.length === 0} onClick={() => onAction("edit-case")} type="button">编辑 case</button>
        </div>
      </div>

      <div className="evalTargetBar">
        <label>
          <span>测评目标版本</span>
          <select
            aria-label="测评目标版本"
            disabled={evalTargetVersions.length === 0}
            onChange={(event) => onSelectEvalTargetVersion(event.currentTarget.value)}
            value={evalTargetVersionId}
          >
            {evalTargetVersions.map((item) => (
              <option key={item.version.id} value={item.version.id}>
                {item.label}{item.isCurrent ? " · current" : " · candidate"}
              </option>
            ))}
          </select>
        </label>
        <span>测评结果会绑定到 exact VariantVersion，候选版本也可以先测再上架。</span>
      </div>

      <div className="evalRunBar" data-testid="eval-run-bar">
        <div className="evalProgress">
          <strong>{cases.length === 0 ? "0%" : percent(Math.round((confirmedDraft / cases.length) * 100))}</strong>
          <span>confirmation coverage</span>
          <i style={{ width: cases.length === 0 ? "0%" : `${Math.round((confirmedDraft / cases.length) * 100)}%` }} />
        </div>
        <div className="evalRunActions">
          <button onClick={() => onSetAll(true)} type="button">全部通过</button>
          <button onClick={() => onSetAll(false)} type="button">全部不通过</button>
          <button className="primaryAction" disabled={busy || cases.length === 0 || confirmedDraft !== cases.length} onClick={onRecord} type="button">
            记录本次测评
          </button>
        </div>
      </div>

      <div className="evalReviewGrid">
        <section className="evalCaseRail">
          <div className="evalCaseRailHead">
            <strong>Cases</strong>
            <span>{cases.length} snapshots</span>
          </div>
          <div className="caseReviewList">
            {cases.map((item) => {
              const passed = caseResults[item.case_version.id];
              const isSelected = selectedCaseId === item.case.id;
              return (
                <article
                  className={`caseReviewCard ${isSelected ? "caseReviewCardActive" : ""}`}
                  key={item.case_version.id}
                  onClick={() => onSelectCase(item.case.id)}
                >
                  <div className="caseReviewHeader">
                    <div>
                      <span>case v{item.case_version.version_number}</span>
                      <strong>{item.case.title}</strong>
                    </div>
                    <div className="resultSwitch" aria-label={`${item.case.title} result`}>
                      <button className={passed === true ? "resultOn" : ""} onClick={() => onToggle(item.case_version.id, true)} type="button">通过</button>
                      <button className={passed === false ? "resultOff" : ""} onClick={() => onToggle(item.case_version.id, false)} type="button">不通过</button>
                    </div>
                  </div>
                  <div className="caseReviewFooter">
                    <small>{item.case_version.notes || "No notes"}</small>
                    <div className="caseRowActions">
                      <button onClick={() => onEditCase(item.case.id)} type="button">编辑</button>
                      <button onClick={() => onHistoryCase(item.case.id)} type="button">历史</button>
                      <button onClick={() => onArchiveCase(item.case.id)} type="button">归档</button>
                    </div>
                  </div>
                </article>
              );
            })}
            {cases.length === 0 ? <div className="linearEmpty">还没有测试用例。先从右侧添加一个 case。</div> : null}
          </div>
        </section>

        <section className="evalCaseDetail">
          {caseHistoryCaseId === selectedCaseId ? (
            <CaseHistoryPanel history={caseHistory} loading={caseHistoryLoading} />
          ) : null}
          {cases.map((item) => {
            const isSelected = selectedCaseId === item.case.id || (!selectedCaseId && item.position === 0);
            if (caseHistoryCaseId === selectedCaseId) return null;
            if (!isSelected) return null;
            return (
              <div key={item.case_version.id}>
                <div className="evalCaseDetailHead">
                  <span>Selected case</span>
                  <strong>{item.case.title}</strong>
                </div>
                <div className="caseIOGrid">
                  <div>
                    <span>Input</span>
                    <pre>{item.case_version.input_artifact.content_text ?? item.case_version.input_artifact.digest}</pre>
                  </div>
                  <div>
                    <span>Expected output</span>
                    <pre>{item.case_version.expected_output_artifact.content_text ?? item.case_version.expected_output_artifact.digest}</pre>
                  </div>
                </div>
              </div>
            );
          })}
          {cases.length === 0 ? (
            <div className="evalCaseDetailEmpty">
              <strong>等待 case</strong>
              <span>添加测试用例后，这里会固定展示 input 和 expected output，左侧只负责快速确认通过/不通过。</span>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function CaseHistoryPanel({ history, loading }: { history: EvalCaseHistory | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="evalCaseDetailEmpty">
        <strong>Case version history</strong>
        <span>正在加载这个 case 的历史版本...</span>
      </div>
    );
  }
  if (!history) {
    return (
      <div className="evalCaseDetailEmpty">
        <strong>Case version history</strong>
        <span>暂时没有可展示的历史记录。</span>
      </div>
    );
  }
  return (
    <div className="caseHistoryPanel">
      <div className="evalCaseDetailHead">
        <span>Case version history</span>
        <strong>{history.case.title}</strong>
      </div>
      <div className="caseHistoryTimeline">
        {history.versions.map((item) => (
          <article className="caseHistoryVersion" key={item.case_version.id}>
            <div className="caseHistoryVersionHead">
              <div>
                <span>v{item.case_version.version_number}</span>
                <strong>{item.case_version.notes || "No notes"}</strong>
              </div>
              <small>{formatDate(item.case_version.created_at)} · {item.case_version.created_by}</small>
            </div>
            <div className="caseIOGrid">
              <div>
                <span>Input</span>
                <pre>{item.case_version.input_artifact.content_text ?? item.case_version.input_artifact.digest}</pre>
              </div>
              <div>
                <span>Expected output</span>
                <pre>{item.case_version.expected_output_artifact.content_text ?? item.case_version.expected_output_artifact.digest}</pre>
              </div>
            </div>
            <div className="caseHistoryMembership">
              {item.included_in_eval_set_versions.length > 0 ? (
                item.included_in_eval_set_versions.map((membership) => (
                  <Badge key={membership.id}>EvalSet v{membership.version_number} · position {membership.position + 1}</Badge>
                ))
              ) : (
                <Badge>未进入 eval set snapshot</Badge>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Inspector({
  actionMode,
  busy,
  cases,
  confirmedDraft,
  createCase,
  importSkill,
  createSkill,
  createVariant,
  createVariantVersion,
  currentEvalSetVersionId,
  defaultVariant,
  latestRun,
  onAction,
  onArchiveSkill,
  onSelectCase,
  importPreview,
  failedDraft,
  hasPersistedSkill,
  passedDraft,
  recordEvalRun,
  refreshImportPreview,
  score,
  selectedCase,
  selectedDetail,
  updateCase,
  updateSkill,
}: {
  actionMode: ActionMode;
  busy: boolean;
  cases: EvalSetVersionDetail["cases"];
  confirmedDraft: number;
  createCase: (event: FormEvent<HTMLFormElement>) => void;
  importSkill: (event: FormEvent<HTMLFormElement>) => void;
  createSkill: (event: FormEvent<HTMLFormElement>) => void;
  createVariant: (event: FormEvent<HTMLFormElement>) => void;
  createVariantVersion: (event: FormEvent<HTMLFormElement>) => void;
  currentEvalSetVersionId?: string;
  defaultVariant: VariantDetail | null;
  latestRun: EvalRunRecord | null;
  onAction: (mode: ActionMode) => void;
  onArchiveSkill: () => void;
  onSelectCase: (caseId: string) => void;
  importPreview: ImportPreview;
  failedDraft: number;
  hasPersistedSkill: boolean;
  passedDraft: number;
  recordEvalRun: () => void;
  refreshImportPreview: (event: FormEvent<HTMLFormElement>) => void;
  score: number | null;
  selectedCase: EvalSetVersionDetail["cases"][number] | null;
  selectedDetail: SkillDetail;
  updateCase: (event: FormEvent<HTMLFormElement>) => void;
  updateSkill: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="inspectorStack">
      <section className="inspectorCard inspectorEvidence">
        <div className="inspectorTitle">
          <span>Verification</span>
          <Badge tone={latestRun ? (score === 100 ? "good" : "bad") : "neutral"}>{latestRun ? "已验证" : "未验证"}</Badge>
        </div>
        <strong>{latestRun ? percent(score) : "未测评"}</strong>
        <small>{latestRun ? `${latestRun.summary.passed ?? 0}/${latestRun.summary.total ?? 0} 通过` : "暂无 accepted run"}</small>
        <div className="bindingList">
          <span>VariantVersion <b>{shortId(defaultVariant?.current_version?.id)}</b></span>
          <span>EvalSetVersion <b>{shortId(currentEvalSetVersionId)}</b></span>
        </div>
      </section>

      <div className="actionMenu">
        {[
          ["skill", "Skill 设置"],
          ["import-skill", "导入 bundle"],
          ["new-skill", "新建 skill"],
          ["new-variant", "新建 variant"],
          ["new-version", "追加版本"],
          ["new-case", "新增 case"],
          ["edit-case", "编辑 case"],
          ["run", "记录测评"],
        ].map(([value, label]) => (
          <button
            className={actionMode === value ? "actionMenuActive" : ""}
            disabled={!hasPersistedSkill && value !== "new-skill" && value !== "import-skill"}
            key={value}
            onClick={() => onAction(value as ActionMode)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {actionMode === "skill" ? (
        <form className="inspectorForm" key={selectedDetail.skill.id} onSubmit={updateSkill}>
          <h3>编辑 skill</h3>
          <input name="slug" defaultValue={selectedDetail.skill.slug} required />
          <input name="owner_ref" defaultValue={selectedDetail.skill.owner_ref} required />
          <button disabled={busy} type="submit">保存</button>
          <button className="dangerButton" disabled={busy} onClick={onArchiveSkill} type="button">归档 skill</button>
        </form>
      ) : null}

      {actionMode === "new-skill" ? (
        <form className="inspectorForm" onSubmit={createSkill}>
          <h3>添加 skill</h3>
          <input name="slug" placeholder="security-reviewer" required />
          <input name="owner_ref" placeholder="skillhub-lab" required />
          <input name="variant_label" placeholder="Baseline" required />
          <input name="tags" placeholder="codex, gpt5.4" required />
          <textarea name="summary" placeholder="这个 skill 解决什么问题" required />
          <textarea name="change_summary" placeholder="初始版本说明" required />
          <button disabled={busy} type="submit">创建</button>
        </form>
      ) : null}

      {actionMode === "import-skill" ? (
        <form className="inspectorForm" onChange={refreshImportPreview} onSubmit={importSkill}>
          <h3>导入标准 Skill</h3>
          <p className="inspectorHint">选择包含 SKILL.md 的文件夹，或上传 zip。SKILL.md frontmatter 的 name 会成为 skill slug。</p>
          <input name="owner_ref" placeholder="skillhub-lab" required />
          <input name="tags" placeholder="codex, gpt5.4" required />
          <input name="variant_label" placeholder="Imported" defaultValue="Imported" />
          <label className="fileDrop">
            <span>选择文件夹</span>
            <input {...folderInputProps} />
          </label>
          <label className="fileDrop">
            <span>或选择 zip</span>
            <input accept=".zip,application/zip" name="zip_file" type="file" />
          </label>
          {importPreview ? (
            <div className={`importPreview importPreview-${importPreview.tone}`}>
              <strong>{importPreview.title}</strong>
              <span>{importPreview.detail}</span>
            </div>
          ) : null}
          <button disabled={busy || importPreview?.tone === "bad"} type="submit">导入并创建 skill</button>
        </form>
      ) : null}

      {actionMode === "new-variant" ? (
        <form className="inspectorForm" onSubmit={createVariant}>
          <h3>添加 variant</h3>
          <input name="label" placeholder="Codex + long-context" required />
          <input name="tags" placeholder="codex, long-context" required />
          <textarea name="summary" placeholder="这个约束下的最优解说明" required />
          <textarea name="change_summary" placeholder="初始版本说明" required />
          <label><input name="make_default" type="checkbox" /> 设为默认</label>
          <button disabled={busy} type="submit">创建 variant</button>
        </form>
      ) : null}

      {actionMode === "new-version" ? (
        <form className="inspectorForm" onSubmit={createVariantVersion}>
          <h3>追加版本</h3>
          <select name="variant_id" required>
            {selectedDetail.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>{variant.label}</option>
            ))}
          </select>
          <p className="inspectorHint">优先上传标准 Skill 文件夹或 zip；这会生成可 diff 的不可变 bundle artifact。</p>
          <label className="fileDrop">
            <span>选择新版本文件夹</span>
            <input {...versionFolderInputProps} />
          </label>
          <label className="fileDrop">
            <span>或选择新版本 zip</span>
            <input accept=".zip,application/zip" name="version_zip_file" type="file" />
          </label>
          <textarea name="content" placeholder="没有文件时，可填写 content_ref 摘要或 locator 来源" />
          <textarea name="change_summary" placeholder="这次更新的收益" required />
          <label><input name="make_current" type="checkbox" defaultChecked /> 设为 current</label>
          <button disabled={busy} type="submit">保存版本</button>
        </form>
      ) : null}

      {actionMode === "new-case" ? (
        <form className="inspectorForm" onSubmit={createCase}>
          <h3>添加测试用例</h3>
          <input name="title" placeholder="PR: 缺少 owner 校验" required />
          <textarea name="input_text" placeholder="输入：代码 diff、上下文、用户请求..." required />
          <textarea name="expected_output" placeholder="期望输出：应该指出什么、避免什么..." required />
          <textarea name="notes" placeholder="来源、bad case、维护说明" />
          <button disabled={busy} type="submit">加入评测集</button>
        </form>
      ) : null}

      {actionMode === "edit-case" ? (
        <form className="inspectorForm" key={selectedCase?.case.id ?? "empty-case"} onSubmit={updateCase}>
          <h3>编辑 case 为新版本</h3>
          <select
            name="case_id"
            onChange={(event) => onSelectCase(event.currentTarget.value)}
            required
            value={selectedCase?.case.id ?? ""}
          >
            {cases.length === 0 ? <option value="">暂无 case</option> : null}
            {cases.map((item) => (
              <option key={item.case.id} value={item.case.id}>{item.case.title}</option>
            ))}
          </select>
          <input name="title" defaultValue={selectedCase?.case.title ?? ""} placeholder="新标题" required />
          <textarea name="input_text" defaultValue={selectedCase?.case_version.input_artifact.content_text ?? ""} placeholder="新的 input" required />
          <textarea name="expected_output" defaultValue={selectedCase?.case_version.expected_output_artifact.content_text ?? ""} placeholder="新的 expected output" required />
          <textarea name="notes" defaultValue={selectedCase?.case_version.notes ?? ""} placeholder="为什么更新" />
          <button disabled={busy || cases.length === 0} type="submit">保存 case version</button>
        </form>
      ) : null}

      {actionMode === "run" ? (
        <section className="inspectorForm">
          <h3>记录本次测评</h3>
          <div className="runSummary">
            <span>已确认 <b>{confirmedDraft}/{cases.length}</b></span>
            <span>通过 <b>{passedDraft}</b></span>
            <span>不通过 <b>{failedDraft}</b></span>
          </div>
          <button disabled={busy || cases.length === 0 || confirmedDraft !== cases.length} onClick={recordEvalRun} type="button">
            提交 eval run
          </button>
          {latestRun ? <Link href={`/eval-runs/${latestRun.id}`}>查看最近 run</Link> : null}
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "good" | "bad"; value: string }) {
  return (
    <div className={`linearMetric linearMetric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

async function sourceFromSelectedBundle({
  folderFiles,
  zipFile,
}: {
  folderFiles: File[];
  zipFile?: File;
}): Promise<BundleSource> {
  if (zipFile && zipFile.size > 0) {
    return {
      kind: "zip",
      name: zipFile.name,
      zip_base64: await fileToBase64(zipFile),
    };
  }
  if (folderFiles.length === 0) throw new Error("请选择包含 SKILL.md 的文件夹，或上传一个 zip。");
  return {
    kind: "files",
    name: folderFiles[0]?.webkitRelativePath?.split("/")[0] || folderFiles[0]?.name || "skill-folder",
    files: await Promise.all(folderFiles.map(filePayloadFromFile)),
  };
}

function sortedVersions(versions: VariantVersion[]) {
  return [...versions].sort((left, right) => left.version_number - right.version_number);
}

function defaultDiffPair(variant: VariantDetail | null): { left: VariantVersion; right: VariantVersion } | null {
  const versions = sortedVersions(variant?.versions ?? []);
  if (versions.length < 2) return null;
  const currentIndex = versions.findIndex((version) => version.id === variant?.current_version?.id);
  if (currentIndex >= 0 && currentIndex < versions.length - 1) {
    return { left: versions[currentIndex], right: versions[currentIndex + 1] };
  }
  const right = currentIndex >= 0 ? versions[currentIndex] : versions[versions.length - 1];
  const rightIndex = versions.findIndex((version) => version.id === right.id);
  const left = versions[rightIndex - 1] ?? versions[versions.length - 2];
  if (!left || left.id === right.id) return null;
  return { left, right };
}

function updatePairFromSelect(
  leftVariantVersionId: string | null,
  rightVariantVersionId: string | null,
  onPairChange: (leftVariantVersionId: string, rightVariantVersionId: string) => void,
) {
  if (!leftVariantVersionId || !rightVariantVersionId || leftVariantVersionId === rightVariantVersionId) return;
  onPairChange(leftVariantVersionId, rightVariantVersionId);
}

function filterDiffFiles(files: BundleDiffFile[], filter: DiffFilter) {
  if (filter === "all") return files;
  if (filter === "binary") return files.filter((file) => file.binary);
  return files.filter((file) => file.status === filter);
}

function diffLinePrefix(kind: "context" | "added" | "removed") {
  if (kind === "added") return "+ ";
  if (kind === "removed") return "- ";
  return "  ";
}

function diffFileSizeLabel(file: BundleDiffFile) {
  const left = typeof file.left_size_bytes === "number" ? formatBytes(file.left_size_bytes) : "missing";
  const right = typeof file.right_size_bytes === "number" ? formatBytes(file.right_size_bytes) : "missing";
  return `${left} -> ${right}`;
}

function runFraction(run: EvalRunRecord) {
  return `${run.summary.passed ?? 0}/${run.summary.total ?? 0}`;
}

function formatDate(value?: string) {
  if (!value) return "unknown time";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBundlePreview(variant: VariantDetail | null): string {
  if (!variant?.current_version) return "还没有 current version。";
  const files = bundleFilesFromVariant(variant);
  const importedSkill = fileContent(files, "SKILL.md") ?? skillMdFromBundleArtifact(variant.current_version.bundle_artifact?.content_text);
  if (importedSkill) return importedSkill;
  return [
    `name: ${variant.label}`,
    `tags: ${variant.tags.join(", ")}`,
    `version: v${variant.current_version.version_number}`,
    `locator: ${variant.current_version.content_ref.locator}`,
    `digest: ${variant.current_version.content_digest}`,
    "",
    variant.current_version.change_summary,
  ].join("\n");
}

function bundleFilesFromVariant(variant: VariantDetail | null): BundleFile[] {
  const version = variant?.current_version;
  if (!version) return [];
  if (version.bundle_files?.length) return version.bundle_files;
  return bundleFilesFromArtifact(version.bundle_artifact?.content_text);
}

function bundleFilesFromArtifact(contentText?: string | null): BundleFile[] {
  if (!contentText) return [];
  try {
    const manifest = JSON.parse(contentText) as {
      files?: BundleFile[];
    };
    return (manifest.files ?? []).filter((file) => typeof file.path === "string").sort((a, b) => a.path.localeCompare(b.path));
  } catch {
    return [];
  }
}

function fileContent(files: BundleFile[], path: string): string | null {
  return files.find((file) => file.path === path)?.content_text ?? null;
}

function skillMdFromBundleArtifact(contentText?: string | null): string | null {
  if (!contentText) return null;
  try {
    const manifest = JSON.parse(contentText) as {
      files?: Array<{ path?: string; content_text?: string }>;
    };
    return manifest.files?.find((file) => file.path === "SKILL.md")?.content_text ?? null;
  } catch {
    return null;
  }
}

function parseSkillMetadata(content: string) {
  const lines = content.split(/\r?\n/);
  const metadata: Record<string, string> = {};
  if (lines[0]?.trim() !== "---") return metadata;
  for (const line of lines.slice(1)) {
    if (line.trim() === "---") break;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    metadata[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
  }
  return metadata;
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function textValue(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function tagList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

async function digestText(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function fileToBase64(file: File) {
  return bytesToBase64(new Uint8Array(await file.arrayBuffer()));
}

async function filePayloadFromFile(file: File) {
  const path = file.webkitRelativePath || file.name;
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!text.includes("\x00")) return { path, content_text: text };
  } catch {
    // Fall through to base64 for non UTF-8 bundle assets.
  }
  return { path, content_base64: bytesToBase64(bytes) };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(await responseText(response));
  return response.json() as Promise<T>;
}

const folderInputProps = {
  directory: "",
  multiple: true,
  name: "folder_files",
  type: "file",
  webkitdirectory: "",
} as const;

const versionFolderInputProps = {
  directory: "",
  multiple: true,
  name: "version_folder_files",
  type: "file",
  webkitdirectory: "",
} as const;

async function apiSend<T = unknown>(path: string, options: { method: string; body?: unknown }): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) throw new Error(await responseText(response));
  return response.json() as Promise<T>;
}

async function responseText(response: Response) {
  try {
    const payload = await response.json();
    return typeof payload.detail === "string" ? payload.detail : JSON.stringify(payload);
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}
