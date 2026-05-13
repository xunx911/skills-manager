"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { passRate } from "@/lib/api";
import { emptySkillDetail } from "@/lib/empty-state";
import { formatBytes, percent, shortId } from "@/lib/format";
import { CommandMenu, type CommandMenuItem } from "@/components/command-menu/command-menu";
import { WorkbenchDiffPane, type DiffFilter } from "@/components/diff/workbench-diff-pane";
import type { QuickEvalCaseDraft } from "@/components/eval-cases/quick-add-cases";
import type { EvalCaseUpdateDraft } from "@/components/eval-cases/eval-case-detail-panel";
import { GlobalCommandButton } from "@/components/command-menu/global-command-button";
import { WorkbenchEvalsPane } from "@/components/evals/workbench-evals-pane";
import { WorkbenchHistoryPane, type HistoryRunFilters as RunFilters } from "@/components/history/workbench-history-pane";
import {
  WorkbenchInspector,
  type InspectorActionMode as ActionMode,
  type InspectorImportPreview as ImportPreview,
} from "@/components/inspector/workbench-inspector";
import { WorkbenchOverviewPane } from "@/components/overview/workbench-overview-pane";
import { PromotionReviewPane } from "@/components/promotion-review/promotion-review-pane";
import type { RunMatrixControls } from "@/components/run-matrix/run-matrix-panel";
import { SkillAuditExplorer, type AuditExplorerFilters } from "@/components/skills/skill-audit-explorer";
import { SkillCatalog } from "@/components/skills/skill-catalog";
import { VariantCreationComposer } from "@/components/variants/variant-creation-composer";
import { WorkspaceVersionComposer } from "@/components/variants/workspace-version-composer";
import {
  WorkbenchTabs,
  type WorkbenchMode,
  type WorkbenchTabItem,
  workbenchPanelId,
  workbenchTabId,
} from "@/components/workbench-tabs";
import type {
  BundleDiff,
  EvalCaseHistory,
  EvalRunComparison,
  EvalRunRecord,
  EvalRunDetail,
  EvalRunHistory,
  EvalRunMatrix,
  EvalSetVersionDetail,
  PromotionDecision,
  PromotionReview,
  SavedView,
  AuditEvent,
  SkillDetail,
  SkillSummary,
  VariantDetail,
  VariantVersion,
} from "@/lib/types";
import { Badge } from "./chrome";

const API_BASE_URL = process.env.NEXT_PUBLIC_SKILLHUB_API_URL ?? "http://127.0.0.1:8000";
const DEFAULT_ACTOR = "product-operator";

type DecisionWorkbenchProps = {
  skills: SkillSummary[];
  featuredSkill: SkillDetail;
};

type Mode = WorkbenchMode;
type Notice = { tone: "good" | "bad" | "neutral"; message: string } | null;
type ActionFocusOptions = { focusInspector?: boolean };
type ImportSkillResponse = { skill_id: string; slug: string; file_count: number };
type SessionResponse = { actor: string; subject_type: string };
type CommandResult = string | void | {
  actionMode?: ActionMode;
  evalTargetVersionId?: string;
  message?: string;
  mode?: Mode;
  selectedSkillId?: string;
};
const DEFAULT_RUN_FILTERS: RunFilters = {
  variant_version_id: "all",
  eval_set_version_id: "all",
  strategy: "all",
  status: "all",
};
const DEFAULT_RUN_MATRIX_CONTROLS: RunMatrixControls = {
  matrix_group_by: "none",
  matrix_impact: "all",
  matrix_show_score: "true",
};
const DEFAULT_AUDIT_FILTERS: AuditExplorerFilters = {
  actor: "",
  action: "",
  resource_type: "all",
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

export function DecisionWorkbench({ skills: initialSkills, featuredSkill }: DecisionWorkbenchProps) {
  const [skills, setSkills] = useState(initialSkills);
  const [selectedSkillId, setSelectedSkillId] = useState(initialSkills[0]?.skill.id ?? featuredSkill.skill.id);
  const [selectedDetail, setSelectedDetail] = useState<SkillDetail>(featuredSkill);
  const [evalSetDetail, setEvalSetDetail] = useState<EvalSetVersionDetail | null>(null);
  const [caseResults, setCaseResults] = useState<Record<string, boolean | null>>({});
  const [mode, setMode] = useState<Mode>("overview");
  const [actionMode, setActionMode] = useState<ActionMode>(initialSkills.length > 0 ? "skill" : "import-skill");
  const [inspectorFocusRequest, setInspectorFocusRequest] = useState(0);
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
  const [runMatrix, setRunMatrix] = useState<EvalRunMatrix | null>(null);
  const [runMatrixLoading, setRunMatrixLoading] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [savedViewsLoading, setSavedViewsLoading] = useState(false);
  const [selectedSavedViewId, setSelectedSavedViewId] = useState("adhoc");
  const [savedViewName, setSavedViewName] = useState("");
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(featuredSkill.audit_events);
  const [auditFilters, setAuditFilters] = useState<AuditExplorerFilters>(DEFAULT_AUDIT_FILTERS);
  const [auditLoading, setAuditLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunDetail, setSelectedRunDetail] = useState<EvalRunDetail | null>(null);
  const [compareBaselineRunId, setCompareBaselineRunId] = useState<string | null>(null);
  const [compareCandidateRunId, setCompareCandidateRunId] = useState<string | null>(null);
  const [runComparison, setRunComparison] = useState<EvalRunComparison | null>(null);
  const [runComparisonLoading, setRunComparisonLoading] = useState(false);
  const [runFilters, setRunFilters] = useState<RunFilters>(DEFAULT_RUN_FILTERS);
  const [runMatrixControls, setRunMatrixControls] = useState<RunMatrixControls>(DEFAULT_RUN_MATRIX_CONTROLS);
  const [caseHistory, setCaseHistory] = useState<EvalCaseHistory | null>(null);
  const [caseHistoryCaseId, setCaseHistoryCaseId] = useState<string | null>(null);
  const [caseHistoryLoading, setCaseHistoryLoading] = useState(false);
  const [evalTargetVersionId, setEvalTargetVersionId] = useState<string | null>(null);
  const [promotionReview, setPromotionReview] = useState<PromotionReview | null>(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [actor, setActor] = useState(DEFAULT_ACTOR);

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
  const evalTargetOption = variantVersionOptions.find((item) => item.version.id === evalTargetVersionId) ?? null;
  const evalTargetVersion =
    evalTargetOption?.version ??
    defaultVariant?.current_version ??
    variantVersionOptions[0]?.version ??
    null;
  const cases = evalSetDetail?.cases ?? [];
  const selectedCase = cases.find((item) => item.case.id === selectedCaseId) ?? cases[0] ?? null;
  const passedDraft = cases.filter((item) => caseResults[item.case_version.id] === true).length;
  const failedDraft = cases.filter((item) => caseResults[item.case_version.id] === false).length;
  const confirmedDraft = passedDraft + failedDraft;
  const hasPersistedSkill = selectedDetail.skill.lifecycle_status !== "empty";
  const commandItems = useMemo<CommandMenuItem[]>(() => {
    const canUseSkill = hasPersistedSkill;
    const canCompareVersions = Boolean(defaultVariant && defaultDiffPair(defaultVariant));
    return [
      command("nav-overview", "打开概览", "导航", "查看 skill 说明、当前验证和 bundle 文件。", () => setMode("overview"), "G O"),
      command("nav-variants", "打开变体", "导航", "查看 variant map 和历史版本。", () => setMode("variants"), "G V", !canUseSkill, "先创建或导入一个 skill。"),
      command("nav-evals", "打开测评", "导航", "管理测试用例并记录手工测评。", () => setMode("evals"), "G E", !canUseSkill, "先创建或导入一个 skill。"),
      command("nav-history", "打开历史", "导航", "查看 run history、比较 run 和 accepted verification。", () => setMode("history"), "G H", !canUseSkill, "先创建或导入一个 skill。"),
      command("nav-audit", "打开审计", "导航", "过滤当前 skill 的治理和发布事件。", () => setMode("audit"), "G A", !canUseSkill, "先创建或导入一个 skill。"),
      command("nav-diff", "打开差异", "导航", "比较当前 variant 的两个 bundle version。", () => openDiffMode(), "G D", !canCompareVersions, "当前 variant 至少需要两个版本。"),
      command("import-skill", "导入标准 Skill bundle", "创建", "上传包含 SKILL.md 的文件夹或 zip。", () => chooseAction("import-skill"), "I"),
      command("new-skill", "新建 skill", "创建", "创建一个空白 skill 和默认 variant。", () => chooseAction("new-skill"), "N"),
      command("new-variant", "新建 variant", "创建", "为当前 skill 新增一组 tag 约束下的最优解。", () => chooseAction("new-variant"), "V", !canUseSkill, "先创建或导入一个 skill。"),
      command("new-version", "追加版本", "创建", "上传新的标准 skill bundle，形成不可变 VariantVersion。", () => chooseAction("new-version"), "A", !canUseSkill, "先创建或导入一个 skill。"),
      command("new-case", "添加 case", "测评", "新增测试用例并生成新的 EvalSetVersion。", () => chooseAction("new-case"), "C", !canUseSkill, "先创建或导入一个 skill。"),
      command("batch-case", "批量添加 case", "测评", "打开测评页的快速批量粘贴入口。", () => setMode("evals"), "B", !canUseSkill, "先创建或导入一个 skill。"),
      command("record-run", "记录本次测评", "测评", "进入 pass/fail 手工测评确认区。", () => chooseAction("run"), "R", !canUseSkill || cases.length === 0, cases.length === 0 ? "当前测试集还没有 case。" : "先创建或导入一个 skill。"),
      command("compare-version", "比较版本", "证据", "打开 bundle 文件级 diff。", () => openDiffMode(), "D", !canCompareVersions, "当前 variant 至少需要两个版本。"),
    ];
  }, [cases.length, defaultVariant, hasPersistedSkill]);

  useEffect(() => {
    void loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadSkill(selectedSkillId);
    setBundleDiff(null);
    setDiffLeftVersionId(null);
    setDiffRightVersionId(null);
    setSelectedDiffPath(null);
    setDiffFilter("all");
    setRunHistory(null);
    setRunMatrix(null);
    setSavedViews([]);
    setSavedViewsLoading(false);
    setSelectedSavedViewId("adhoc");
    setSavedViewName("");
    setAuditEvents([]);
    setAuditFilters(DEFAULT_AUDIT_FILTERS);
    setAuditLoading(false);
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

  function selectEvalTargetVersion(versionId: string) {
    setEvalTargetVersionId(versionId);
    setCaseResults(Object.fromEntries(cases.map((item) => [item.case_version.id, null])));
    setActionMode("run");
  }

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
    void loadRunMatrix(selectedDetail.skill.id, runFilters);
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
    if (mode !== "history" || !hasPersistedSkill) return;
    void loadSavedViews(selectedDetail.skill.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hasPersistedSkill, selectedDetail.skill.id]);

  useEffect(() => {
    if (mode !== "audit" || !hasPersistedSkill) return;
    void loadAuditEvents(selectedDetail.skill.id, auditFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    hasPersistedSkill,
    selectedDetail.skill.id,
    auditFilters.actor,
    auditFilters.action,
    auditFilters.resource_type,
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

  function chooseAction(nextActionMode: ActionMode, options: ActionFocusOptions = {}) {
    setActionMode(nextActionMode);
    if (options.focusInspector !== false) {
      setInspectorFocusRequest((current) => current + 1);
    }
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

  async function loadSession() {
    try {
      const session = await apiGet<SessionResponse>("/api/session");
      setActor(session.actor);
    } catch {
      setActor(DEFAULT_ACTOR);
    }
  }

  async function loadSkills(nextSelectedId = selectedSkillId) {
    const nextSkills = await apiGet<SkillSummary[]>("/api/skills");
    setSkills(nextSkills);
    if (nextSkills.length === 0) {
      setSelectedSkillId(emptySkillDetail.skill.id);
      setSelectedDetail(emptySkillDetail);
      setAuditEvents([]);
      setEvalSetDetail(null);
      setCaseResults({});
      chooseAction("import-skill", { focusInspector: false });
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
      setAuditEvents([]);
      return;
    }
    try {
      const detail = await apiGet<SkillDetail>(`/api/skills/${skillId}`);
      setSelectedDetail(detail);
      setAuditEvents(detail.audit_events);
    } catch {
      if (skillId === featuredSkill.skill.id) {
        setSelectedDetail(featuredSkill);
        setAuditEvents(featuredSkill.audit_events);
      }
    }
  }

  async function loadEvalSetVersion(evalSetVersionId: string) {
    try {
      const detail = await apiGet<EvalSetVersionDetail>(`/api/eval-set-versions/${evalSetVersionId}`);
      const activeCaseIds = new Set(detail.cases.map((item) => item.case.id));
      setEvalSetDetail(detail);
      setCaseResults(Object.fromEntries(detail.cases.map((item) => [item.case_version.id, null])));
      setCaseHistory((current) => (current && activeCaseIds.has(current.case.id) ? current : null));
      setCaseHistoryCaseId((current) => (current && activeCaseIds.has(current) ? current : null));
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

  async function loadRunMatrix(skillId: string, filters: RunFilters) {
    setRunMatrixLoading(true);
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value !== "all") params.set(key, value);
      }
      const query = params.toString();
      setRunMatrix(await apiGet<EvalRunMatrix>(`/api/skills/${skillId}/eval-run-matrix${query ? `?${query}` : ""}`));
    } catch (error) {
      setRunMatrix(null);
      setNotice({ tone: "bad", message: error instanceof Error ? error.message : "加载 run matrix 失败" });
    } finally {
      setRunMatrixLoading(false);
    }
  }

  async function loadSavedViews(skillId: string) {
    setSavedViewsLoading(true);
    try {
      const views = await apiGet<SavedView[]>(`/api/skills/${skillId}/saved-views?view_type=run_history`);
      setSavedViews(views);
      setSelectedSavedViewId((current) => (current === "adhoc" || views.some((view) => view.id === current) ? current : "adhoc"));
    } catch (error) {
      setSavedViews([]);
      setSelectedSavedViewId("adhoc");
      setNotice({ tone: "bad", message: error instanceof Error ? error.message : "加载保存视图失败" });
    } finally {
      setSavedViewsLoading(false);
    }
  }

  async function loadAuditEvents(skillId: string, filters: AuditExplorerFilters) {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filters.actor.trim()) params.set("actor", filters.actor.trim());
      if (filters.action.trim()) params.set("action", filters.action.trim());
      if (filters.resource_type !== "all") params.set("resource_type", filters.resource_type);
      setAuditEvents(await apiGet<AuditEvent[]>(`/api/skills/${skillId}/audit-events?${params.toString()}`));
    } catch (error) {
      setAuditEvents([]);
      setNotice({ tone: "bad", message: error instanceof Error ? error.message : "加载审计事件失败" });
    } finally {
      setAuditLoading(false);
    }
  }

  function updateRunFilter(key: keyof RunFilters, value: string) {
    setSelectedSavedViewId("adhoc");
    setRunFilters((current) => ({ ...current, [key]: value }));
  }

  function updateAuditFilter(key: keyof AuditExplorerFilters, value: string) {
    setAuditFilters((current) => ({ ...current, [key]: value }));
  }

  function clearAuditFilters() {
    setAuditFilters(DEFAULT_AUDIT_FILTERS);
  }

  function updateRunMatrixControl<Key extends keyof RunMatrixControls>(key: Key, value: RunMatrixControls[Key]) {
    setSelectedSavedViewId("adhoc");
    setRunMatrixControls((current) => ({ ...current, [key]: value }));
  }

  function applySavedView(view: SavedView | null) {
    setSelectedSavedViewId(view?.id ?? "adhoc");
    setSavedViewName("");
    if (!view) {
      setRunFilters(DEFAULT_RUN_FILTERS);
      setRunMatrixControls(DEFAULT_RUN_MATRIX_CONTROLS);
      return;
    }
    setRunFilters({ ...DEFAULT_RUN_FILTERS, ...runFiltersFromConfig(view.config) });
    setRunMatrixControls({ ...DEFAULT_RUN_MATRIX_CONTROLS, ...runMatrixControlsFromConfig(view.config) });
  }

  async function createSavedRunView() {
    const name = savedViewName.trim();
    if (!name) return;
    setBusy(true);
    setNotice(null);
    try {
      const view = await apiSend<SavedView>("/api/saved-views", {
        method: "POST",
        body: {
          skill_id: selectedDetail.skill.id,
          name,
          view_type: "run_history",
          config: { ...runFilterConfig(runFilters), ...runMatrixControlConfig(runMatrixControls) },
        },
      });
      await loadSavedViews(selectedDetail.skill.id);
      setSelectedSavedViewId(view.id);
      setSavedViewName("");
      setNotice({ tone: "good", message: "保存视图已创建。" });
    } catch (error) {
      setNotice({ tone: "bad", message: error instanceof Error ? error.message : "保存视图失败" });
    } finally {
      setBusy(false);
    }
  }

  async function deleteSavedRunView() {
    if (selectedSavedViewId === "adhoc") return;
    setBusy(true);
    setNotice(null);
    try {
      await apiSend<{ ok: boolean }>(`/api/saved-views/${selectedSavedViewId}`, { method: "DELETE" });
      setSavedViews((current) => current.filter((view) => view.id !== selectedSavedViewId));
      setSelectedSavedViewId("adhoc");
      setNotice({ tone: "good", message: "保存视图已删除。" });
    } catch (error) {
      setNotice({ tone: "bad", message: error instanceof Error ? error.message : "删除保存视图失败" });
    } finally {
      setBusy(false);
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
      if (typeof result === "object" && result?.evalTargetVersionId) selectEvalTargetVersion(result.evalTargetVersionId);
      if (typeof result === "object" && result?.mode) setMode(result.mode);
      if (typeof result === "object" && result?.actionMode) setActionMode(result.actionMode);
      setNotice({ tone: "good", message: resultMessage || message });
      return true;
    } catch (error) {
      setNotice({ tone: "bad", message: error instanceof Error ? error.message : "操作失败" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function switchActor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const nextActor = textValue(form, "actor");
    if (!nextActor) return;
    await runCommand("Actor 已切换。", async () => {
      const session = await apiSend<SessionResponse>("/api/session", {
        method: "POST",
        body: { actor: nextActor },
      });
      setActor(session.actor);
      formElement.reset();
      return "Actor 已切换。";
    });
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
        },
      });
      setCatalogQuery("");
      chooseAction("skill", { focusInspector: false });
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
        },
      });
      setCatalogQuery("");
      chooseAction("skill", { focusInspector: false });
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
      const defaultVariantId = textValue(form, "default_variant_id");
      await apiSend(`/api/skills/${selectedDetail.skill.id}`, {
        method: "PATCH",
        body: {
          slug: textValue(form, "slug"),
          owner_ref: textValue(form, "owner_ref"),
          ...(defaultVariantId ? { default_variant_id: defaultVariantId } : {}),
        },
      });
    });
  }

  async function assignSkillRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await runCommand("成员角色已添加。", async () => {
      await apiSend(`/api/skills/${selectedDetail.skill.id}/role-assignments`, {
        method: "POST",
        body: {
          subject_id: textValue(form, "subject_id"),
          role: textValue(form, "role"),
        },
      });
      formElement.reset();
    });
  }

  async function revokeSkillRole(roleAssignmentId: string) {
    await runCommand("成员角色已移除。", async () => {
      await apiSend(`/api/role-assignments/${roleAssignmentId}`, { method: "DELETE" });
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
      const baseContentRef = defaultVariant?.current_version?.content_ref ?? null;
      const copyCurrent = form.get("copy_current") === "on" && baseContentRef;
      await apiSend("/api/variants", {
        method: "POST",
        body: {
          skill_id: selectedDetail.skill.id,
          name: label,
          label,
          summary,
          tags: tagList(textValue(form, "tags")),
          content_ref: copyCurrent
            ? baseContentRef
            : {
                kind: "skill_bundle",
                locator: `inline:${selectedDetail.skill.slug}/${label}`,
                digest: await digestText(summary + textValue(form, "tags")),
              },
          change_summary: textValue(form, "change_summary"),
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
      const makeCurrent = form.get("make_current") === "on";
      const result = await apiSend<{ variant_version_id: string; version_number: number }>("/api/variant-versions", {
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
          make_current: makeCurrent,
        },
      });
      formElement.reset();
      if (!makeCurrent) {
        return {
          actionMode: "run",
          evalTargetVersionId: result.variant_version_id,
          message: `Variant 版本已创建。已切到候选 v${result.version_number} 测评。`,
          mode: "evals",
        };
      }
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
        },
      });
      setSelectedCaseId(result.eval_case_id);
      formElement.reset();
      return {
        actionMode: "run",
        message: "测试用例已加入当前评测集。已切到手工测评。",
        mode: "evals",
      };
    });
  }

  async function createCases(drafts: QuickEvalCaseDraft[]) {
    return runCommand(`已批量加入 ${drafts.length} 条测试用例。`, async () => {
      const result = await apiSend<{
        created: Array<{ eval_case_id: string; eval_case_version_id: string }>;
      }>("/api/eval-cases/batch", {
        method: "POST",
        body: {
          skill_id: selectedDetail.skill.id,
          cases: drafts,
        },
      });
      const lastCase = result.created.at(-1);
      if (lastCase) setSelectedCaseId(lastCase.eval_case_id);
      chooseAction("run");
    });
  }

  async function updateCaseDraft(draft: EvalCaseUpdateDraft) {
    return runCommand("测试用例新版本已保存。", async () => {
      await apiSend(`/api/eval-cases/${draft.caseId}`, {
        method: "PATCH",
        body: {
          case_id: draft.caseId,
          title: draft.title,
          input_text: draft.inputText,
          expected_output: draft.expectedOutput,
          notes: draft.notes,
          make_current: true,
        },
      });
      setSelectedCaseId(draft.caseId);
    });
  }

  async function updateCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await updateCaseDraft({
      caseId: textValue(form, "case_id"),
      title: textValue(form, "title"),
      inputText: textValue(form, "input_text"),
      expectedOutput: textValue(form, "expected_output"),
      notes: textValue(form, "notes"),
    });
  }

  async function archiveCase(caseId: string) {
    await runCommand("测试用例已归档。", async () => {
      await apiSend(`/api/eval-cases/${caseId}`, { method: "DELETE" });
      if (selectedCaseId === caseId) setSelectedCaseId(null);
    });
  }

  async function restoreCaseVersion(caseId: string, sourceCaseVersionId: string, sourceVersionNumber: number) {
    await runCommand(`已从 case v${sourceVersionNumber} 恢复为新版本。`, async () => {
      const result = await apiSend<{ eval_set_version_id: string }>(`/api/eval-cases/${caseId}/restores`, {
        method: "POST",
        body: {
          source_case_version_id: sourceCaseVersionId,
          notes: `Restored from case v${sourceVersionNumber}.`,
        },
      });
      setSelectedCaseId(caseId);
      await loadEvalSetVersion(result.eval_set_version_id);
      await loadCaseHistory(caseId);
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
        },
      });
      return `已记录 ${result.passed}/${result.total} 通过。`;
    });
  }

  function clearCaseResults() {
    setCaseResults({});
  }

  const workbenchTabs: WorkbenchTabItem[] = [
    { label: "概览", mode: "overview" },
    { label: "变体", mode: "variants" },
    { label: "测评", mode: "evals" },
    { label: "差异", mode: "diff", onActivate: () => openDiffMode() },
    { label: "历史", mode: "history" },
  ];
  if (mode === "audit") workbenchTabs.push({ label: "审计", mode: "audit" });
  if (mode === "promotion" || promotionReview) workbenchTabs.push({ label: "评审", mode: "promotion" });

  return (
    <div className="linearWorkbench">
      <CommandMenu commands={commandItems} scopeLabel={selectedDetail.skill.slug} />
      <SkillCatalog
        catalogQuery={catalogQuery}
        onCatalogQueryChange={setCatalogQuery}
        onCreateSkill={() => chooseAction("new-skill")}
        onImportSkill={() => chooseAction("import-skill")}
        onSelectSkill={(skillId) => {
          setSelectedSkillId(skillId);
          chooseAction("skill", { focusInspector: false });
          setSelectedCaseId(null);
        }}
        selectedSkillId={selectedDetail.skill.id}
        skills={skills}
        visibleSkills={visibleSkills}
      />

      <main className="linearMain">
        <header className="linearHeader">
          <div>
            <p>{selectedDetail.skill.owner_ref} / {selectedDetail.skill.lifecycle_status}</p>
            <h1>{selectedDetail.skill.slug}</h1>
          </div>
          <div className="linearHeaderActions">
            <WorkbenchTabs mode={mode} onModeChange={setMode} tabs={workbenchTabs} />
            <GlobalCommandButton />
          </div>
        </header>

        {notice ? (
          <div aria-live="polite" className={`linearNotice linearNotice-${notice.tone}`} role="status">
            {notice.message}
          </div>
        ) : null}

        <section
          aria-labelledby={workbenchTabId(mode)}
          className="workbenchTabPanel"
          id={workbenchPanelId(mode)}
          role="tabpanel"
        >
          {mode === "overview" ? (
            <WorkbenchOverviewPane
              actor={actor}
              assignSkillRole={assignSkillRole}
              busy={busy}
              caseCount={cases.length}
              createSkill={createSkill}
              defaultVariant={defaultVariant}
              hasPersistedSkill={hasPersistedSkill}
              importPreview={importPreview}
              importSkill={importSkill}
              latestRun={latestRun}
              onAction={chooseAction}
              onDiff={() => openDiffMode()}
              onOpenEvals={() => {
                setMode("evals");
                setActionMode("run");
              }}
              onOpenHistory={() => setMode("history")}
              onArchiveSkill={archiveSkill}
              onOpenAudit={() => setMode("audit")}
              primaryEvalSetVersion={currentEvalSetVersion?.version_number}
              refreshImportPreview={refreshImportPreview}
              revokeSkillRole={revokeSkillRole}
              score={score}
              selectedDetail={selectedDetail}
              updateSkill={updateSkill}
            />
          ) : null}

          {mode === "variants" ? (
            <VariantsPane
              busy={busy}
              defaultVariant={defaultVariant}
              onAction={chooseAction}
              onCreateVariant={createVariant}
              onCreateVersion={createVariantVersion}
              onDiff={() => openDiffMode()}
              onPromotionReview={openPromotionReview}
              variants={selectedDetail.variants}
            />
          ) : null}

          {mode === "diff" ? (
            <WorkbenchDiffPane
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
            <WorkbenchHistoryPane
              busy={busy}
              compareBaselineRunId={compareBaselineRunId}
              compareCandidateRunId={compareCandidateRunId}
              evalSets={selectedDetail.eval_sets}
              filters={runFilters}
              loading={runHistoryLoading}
              onAcceptComparison={acceptComparisonCandidate}
              onAction={chooseAction}
              onApplySavedView={applySavedView}
              onChooseComparisonRun={chooseComparisonRun}
              onDeleteSavedView={deleteSavedRunView}
              onFilterChange={updateRunFilter}
              onMatrixControlChange={updateRunMatrixControl}
              onSaveView={createSavedRunView}
              onSavedViewNameChange={setSavedViewName}
              onSelectRun={setSelectedRunId}
              runComparison={runComparison}
              runComparisonLoading={runComparisonLoading}
              runDetail={selectedRunDetail}
              runHistory={runHistory}
              runMatrix={runMatrix}
              runMatrixControls={runMatrixControls}
              runMatrixLoading={runMatrixLoading}
              savedViewName={savedViewName}
              savedViews={savedViews}
              savedViewsLoading={savedViewsLoading}
              selectedSavedViewId={selectedSavedViewId}
              selectedRunId={selectedRunId}
              variants={selectedDetail.variants}
            />
          ) : null}

          {mode === "audit" ? (
            <SkillAuditExplorer
              events={auditEvents}
              filters={auditFilters}
              loading={auditLoading}
              onClearFilters={clearAuditFilters}
              onFilterChange={updateAuditFilter}
              onOpenOverview={() => setMode("overview")}
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
            <WorkbenchEvalsPane
              busy={busy}
              caseHistory={caseHistory}
              caseHistoryCaseId={caseHistoryCaseId}
              caseHistoryLoading={caseHistoryLoading}
              caseResults={caseResults}
              cases={cases}
              confirmedDraft={confirmedDraft}
              currentEvalSetVersion={currentEvalSetVersion?.version_number}
              evalTargetVersionId={evalTargetVersion?.id ?? ""}
              evalTargetOption={evalTargetOption}
              evalTargetVersions={variantVersionOptions}
              failedDraft={failedDraft}
              onCreateCases={createCases}
              onAction={chooseAction}
              onArchiveCase={archiveCase}
              onCloseCaseHistory={() => {
                setCaseHistory(null);
                setCaseHistoryCaseId(null);
              }}
              onClearDraft={clearCaseResults}
              onEditCase={(caseId) => {
                setSelectedCaseId(caseId);
                chooseAction("edit-case");
              }}
              onHistoryCase={loadCaseHistory}
              onPromotionReview={openPromotionReview}
              onRecord={recordEvalRun}
              onRestoreCaseVersion={restoreCaseVersion}
              onSelectCase={setSelectedCaseId}
              onSelectEvalTargetVersion={selectEvalTargetVersion}
              onToggle={(caseVersionId, passed) => {
                setCaseResults((current) => ({ ...current, [caseVersionId]: passed }));
                setActionMode("run");
              }}
              onUpdateCase={updateCaseDraft}
              passedDraft={passedDraft}
              selectedCaseId={selectedCase?.case.id ?? null}
            />
          ) : null}
        </section>
      </main>

      <aside className="linearInspector" aria-label="Inspector">
        <WorkbenchInspector
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
          actor={actor}
          actionFocusRequest={inspectorFocusRequest}
          switchActor={switchActor}
        />
      </aside>
    </div>
  );
}

function VariantsPane({
  busy,
  defaultVariant,
  onAction,
  onCreateVariant,
  onCreateVersion,
  onDiff,
  onPromotionReview,
  variants,
}: {
  busy: boolean;
  defaultVariant: VariantDetail | null;
  onAction: (mode: ActionMode) => void;
  onCreateVariant: (event: FormEvent<HTMLFormElement>) => void;
  onCreateVersion: (event: FormEvent<HTMLFormElement>) => void;
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
      <VariantCreationComposer
        busy={busy}
        hasBaseVersion={Boolean(defaultVariant?.current_version)}
        onCreateVariant={onCreateVariant}
      />
      <WorkspaceVersionComposer
        busy={busy}
        defaultVariantId={defaultVariant?.id}
        onCreateVersion={onCreateVersion}
        variants={variants}
      />
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

function runFilterConfig(filters: RunFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== "all"));
}

function runMatrixControlConfig(controls: RunMatrixControls) {
  return Object.fromEntries(
    Object.entries(controls).filter(([key, value]) => value !== DEFAULT_RUN_MATRIX_CONTROLS[key as keyof RunMatrixControls]),
  );
}

function runFiltersFromConfig(config: SavedView["config"]): Partial<RunFilters> {
  return {
    ...(config.variant_version_id ? { variant_version_id: config.variant_version_id } : {}),
    ...(config.eval_set_version_id ? { eval_set_version_id: config.eval_set_version_id } : {}),
    ...(config.strategy ? { strategy: config.strategy } : {}),
    ...(config.status ? { status: config.status } : {}),
  };
}

function runMatrixControlsFromConfig(config: SavedView["config"]): Partial<RunMatrixControls> {
  return {
    ...(config.matrix_group_by === "impact" || config.matrix_group_by === "none" ? { matrix_group_by: config.matrix_group_by } : {}),
    ...(isMatrixImpactConfig(config.matrix_impact) ? { matrix_impact: config.matrix_impact } : {}),
    ...(config.matrix_show_score === "true" || config.matrix_show_score === "false" ? { matrix_show_score: config.matrix_show_score } : {}),
  };
}

function isMatrixImpactConfig(value: string | undefined): value is RunMatrixControls["matrix_impact"] {
  return value === "all" || value === "waiting" || value === "fixed" || value === "regressed" || value === "stable_pass" || value === "stable_fail" || value === "missing";
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

function command(
  id: string,
  title: string,
  group: string,
  detail: string,
  run: () => void,
  shortcut?: string,
  disabled = false,
  disabledReason = "",
): CommandMenuItem {
  return {
    id,
    title,
    group,
    detail,
    run,
    shortcut,
    disabled,
    disabledReason,
  };
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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(await responseText(response));
  return response.json() as Promise<T>;
}

async function apiSend<T = unknown>(path: string, options: { method: string; body?: unknown }): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method,
    credentials: "include",
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
