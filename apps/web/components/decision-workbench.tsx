"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { passRate } from "@/lib/api";
import { formatDate, percent, shortId } from "@/lib/format";
import type { EvalRunRecord, EvalSetVersionDetail, SkillDetail, SkillSummary, VariantDetail } from "@/lib/types";
import { Badge } from "./chrome";

const API_BASE_URL = process.env.NEXT_PUBLIC_SKILLHUB_API_URL ?? "http://127.0.0.1:8000";
const ACTOR = "product-operator";

type DecisionWorkbenchProps = {
  skills: SkillSummary[];
  featuredSkill: SkillDetail;
};

type Mode = "overview" | "variants" | "evals";
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

export function DecisionWorkbench({ skills: initialSkills, featuredSkill }: DecisionWorkbenchProps) {
  const [skills, setSkills] = useState(initialSkills);
  const [selectedSkillId, setSelectedSkillId] = useState(initialSkills[0]?.skill.id ?? featuredSkill.skill.id);
  const [selectedDetail, setSelectedDetail] = useState<SkillDetail>(featuredSkill);
  const [evalSetDetail, setEvalSetDetail] = useState<EvalSetVersionDetail | null>(null);
  const [caseResults, setCaseResults] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<Mode>("overview");
  const [actionMode, setActionMode] = useState<ActionMode>("skill");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
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
  const cases = evalSetDetail?.cases ?? [];
  const selectedCase = cases.find((item) => item.case.id === selectedCaseId) ?? cases[0] ?? null;
  const passedDraft = cases.filter((item) => caseResults[item.case_version.id]).length;

  useEffect(() => {
    void loadSkill(selectedSkillId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSkillId]);

  useEffect(() => {
    if (!currentEvalSetVersion) {
      setEvalSetDetail(null);
      setCaseResults({});
      return;
    }
    void loadEvalSetVersion(currentEvalSetVersion.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvalSetVersion?.id]);

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
    const nextId = nextSkills.some((item) => item.skill.id === nextSelectedId)
      ? nextSelectedId
      : nextSkills[0]?.skill.id ?? featuredSkill.skill.id;
    setSelectedSkillId(nextId);
    await loadSkill(nextId);
  }

  async function loadSkill(skillId: string) {
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
      setCaseResults(Object.fromEntries(detail.cases.map((item) => [item.case_version.id, true])));
    } catch {
      setEvalSetDetail(null);
      setCaseResults({});
    }
  }

  async function runCommand(message: string, command: () => Promise<string | void>) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await command();
      await loadSkills(selectedSkillId);
      setNotice({ tone: "good", message: result || message });
    } catch (error) {
      setNotice({ tone: "bad", message: error instanceof Error ? error.message : "操作失败" });
    } finally {
      setBusy(false);
    }
  }

  async function createSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
      setSelectedSkillId(result.skill_id);
      setCatalogQuery("");
      chooseAction("skill");
      event.currentTarget.reset();
    });
  }

  async function importSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const zipInput = event.currentTarget.elements.namedItem("zip_file") as HTMLInputElement | null;
    const folderInput = event.currentTarget.elements.namedItem("folder_files") as HTMLInputElement | null;
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
      const source = zipFile && zipFile.size > 0
        ? {
            kind: "zip",
            name: zipFile.name,
            zip_base64: await fileToBase64(zipFile),
          }
        : {
            kind: "files",
            name: folderFiles[0]?.webkitRelativePath?.split("/")[0] || folderFiles[0]?.name || "skill-folder",
            files: await Promise.all(
              folderFiles.map(async (file) => ({
                path: file.webkitRelativePath || file.name,
                content_text: await file.text(),
              })),
            ),
          };
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
      setSelectedSkillId(result.skill_id);
      setCatalogQuery("");
      chooseAction("skill");
      event.currentTarget.reset();
      return `已导入 ${result.slug}，包含 ${result.file_count} 个文件。`;
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
    const form = new FormData(event.currentTarget);
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
      event.currentTarget.reset();
    });
  }

  async function createVariantVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runCommand("Variant 版本已创建。", async () => {
      const variantId = textValue(form, "variant_id");
      const content = textValue(form, "content");
      await apiSend("/api/variant-versions", {
        method: "POST",
        body: {
          variant_id: variantId,
          content_ref: {
            kind: "skill_bundle",
            locator: `inline:${variantId}/${Date.now()}`,
            digest: await digestText(content),
          },
          change_summary: textValue(form, "change_summary"),
          actor: ACTOR,
          make_current: form.get("make_current") === "on",
        },
      });
      event.currentTarget.reset();
    });
  }

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
      event.currentTarget.reset();
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
    if (!defaultVariant?.current_version || !currentEvalSetVersion) return;
    await runCommand("手工测评已记录。", async () => {
      const result = await apiSend<{ passed: number; total: number }>("/api/eval-runs", {
        method: "POST",
        body: {
          variant_version_id: defaultVariant.current_version?.id,
          eval_set_version_id: currentEvalSetVersion.id,
          strategy: "manual_pass_fail",
          results: caseResults,
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
          <span>SkillHub</span>
          <button onClick={() => chooseAction("new-skill")} type="button">新建</button>
        </div>
        <label className="linearSearch">
          <span>搜索</span>
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
                <span>{summary.default_variant?.tags.join(" + ") ?? "draft"}</span>
              </button>
            );
          })}
          {visibleSkills.length === 0 ? <div className="linearCatalogEmpty">没有匹配的 skill</div> : null}
        </div>
      </aside>

      <main className="linearMain">
        <header className="linearHeader">
          <div>
            <p>{selectedDetail.skill.owner_ref}</p>
            <h1>{selectedDetail.skill.slug}</h1>
          </div>
          <nav className="linearTabs" aria-label="Workbench modes">
            <button className={mode === "overview" ? "linearTabActive" : ""} onClick={() => setMode("overview")} type="button">概览</button>
            <button className={mode === "variants" ? "linearTabActive" : ""} onClick={() => setMode("variants")} type="button">变体</button>
            <button className={mode === "evals" ? "linearTabActive" : ""} onClick={() => setMode("evals")} type="button">测评</button>
          </nav>
        </header>

        {notice ? <div className={`linearNotice linearNotice-${notice.tone}`}>{notice.message}</div> : null}

        {mode === "overview" ? (
          <OverviewPane
            defaultVariant={defaultVariant}
            latestRun={latestRun}
            onAction={chooseAction}
            primaryEvalSetVersion={currentEvalSetVersion?.version_number}
            score={score}
            selectedDetail={selectedDetail}
          />
        ) : null}

        {mode === "variants" ? (
          <VariantsPane
            defaultVariant={defaultVariant}
            onAction={chooseAction}
            variants={selectedDetail.variants}
          />
        ) : null}

        {mode === "evals" ? (
          <EvalsPane
            busy={busy}
            caseResults={caseResults}
            cases={cases}
            currentEvalSetVersion={currentEvalSetVersion?.version_number}
            onAction={chooseAction}
            onArchiveCase={archiveCase}
            onEditCase={(caseId) => {
              setSelectedCaseId(caseId);
              chooseAction("edit-case");
            }}
            onRecord={recordEvalRun}
            onSetAll={setAllCases}
            onToggle={(caseVersionId, passed) =>
              setCaseResults((current) => ({ ...current, [caseVersionId]: passed }))
            }
            passedDraft={passedDraft}
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
          recordEvalRun={recordEvalRun}
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
  latestRun,
  onAction,
  primaryEvalSetVersion,
  score,
  selectedDetail,
}: {
  defaultVariant: VariantDetail | null;
  latestRun: EvalRunRecord | null;
  onAction: (mode: ActionMode) => void;
  primaryEvalSetVersion?: number;
  score: number | null;
  selectedDetail: SkillDetail;
}) {
  return (
    <div className="linearPane">
      <section className="linearHero">
        <div>
          <span>默认分发对象</span>
          <h2>{defaultVariant?.label ?? "暂无默认 variant"}</h2>
          <p>{defaultVariant?.summary ?? "这个 skill 还没有默认 variant。"}</p>
        </div>
        <div className="linearHeroActions">
          <button onClick={() => onAction("skill")} type="button">编辑 skill</button>
          <button onClick={() => onAction("new-skill")} type="button">添加 skill</button>
        </div>
      </section>

      <div className="linearMetrics">
        <Metric label="变体数" value={String(selectedDetail.variants.length)} />
        <Metric label="当前版本" value={defaultVariant?.current_version ? `v${defaultVariant.current_version.version_number}` : "暂无"} />
        <Metric label="测评集版本" value={primaryEvalSetVersion ? `v${primaryEvalSetVersion}` : "暂无"} />
        <Metric label="最近分数" tone={latestRun ? (score === 100 ? "good" : "bad") : "neutral"} value={latestRun ? percent(score) : "未测"} />
      </div>

      <section className="linearSection">
        <div className="linearSectionHeader">
          <h3>Skill bundle</h3>
          <Link href={defaultVariant ? `/variants/${defaultVariant.id}` : "#"}>打开 variant</Link>
        </div>
        <div className="linearBundle">
          <span>SKILL.md</span>
          <pre>{formatBundlePreview(defaultVariant)}</pre>
        </div>
      </section>
    </div>
  );
}

function VariantsPane({
  defaultVariant,
  onAction,
  variants,
}: {
  defaultVariant: VariantDetail | null;
  onAction: (mode: ActionMode) => void;
  variants: VariantDetail[];
}) {
  return (
    <div className="linearPane">
      <div className="linearToolbar">
        <div>
          <h2>变体空间</h2>
          <p>每个 variant 是一组 tags 约束下维护者认可的当前答案。</p>
        </div>
        <div>
          <button onClick={() => onAction("new-variant")} type="button">添加 variant</button>
          <button onClick={() => onAction("new-version")} type="button">追加版本</button>
        </div>
      </div>
      <div className="linearTable">
        <div className="linearTableHead linearVariantGrid">
          <span>Variant</span>
          <span>Tags</span>
          <span>当前版本</span>
          <span>状态</span>
        </div>
        {variants.map((variant) => (
          <Link className="linearTableRow linearVariantGrid" href={`/variants/${variant.id}`} key={variant.id}>
            <strong>{variant.label}</strong>
            <span>{variant.tags.join(" + ")}</span>
            <span>{variant.current_version ? `v${variant.current_version.version_number}` : "暂无"}</span>
            <span>{variant.id === defaultVariant?.id ? <Badge tone="good">默认</Badge> : <Badge tone="blue">有效</Badge>}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function EvalsPane({
  busy,
  caseResults,
  cases,
  currentEvalSetVersion,
  onAction,
  onArchiveCase,
  onEditCase,
  onRecord,
  onSetAll,
  onToggle,
  passedDraft,
}: {
  busy: boolean;
  caseResults: Record<string, boolean>;
  cases: EvalSetVersionDetail["cases"];
  currentEvalSetVersion?: number;
  onAction: (mode: ActionMode) => void;
  onArchiveCase: (caseId: string) => void;
  onEditCase: (caseId: string) => void;
  onRecord: () => void;
  onSetAll: (passed: boolean) => void;
  onToggle: (caseVersionId: string, passed: boolean) => void;
  passedDraft: number;
}) {
  return (
    <div className="linearPane">
      <div className="linearToolbar">
        <div>
          <h2>手工测评</h2>
          <p>EvalSetVersion {currentEvalSetVersion ? `v${currentEvalSetVersion}` : "暂无"} · 当前草稿 {passedDraft}/{cases.length} 通过</p>
        </div>
        <div>
          <button onClick={() => onAction("new-case")} type="button">添加 case</button>
          <button disabled={cases.length === 0} onClick={() => onAction("edit-case")} type="button">编辑选中 case</button>
        </div>
      </div>

      <div className="evalRunBar">
        <button onClick={() => onSetAll(true)} type="button">全部通过</button>
        <button onClick={() => onSetAll(false)} type="button">全部不通过</button>
        <button disabled={busy || cases.length === 0} onClick={onRecord} type="button">记录本次测评</button>
      </div>

      <div className="linearTable">
        <div className="linearTableHead linearEvalGrid">
          <span>结果</span>
          <span>用例</span>
          <span>输入</span>
          <span>期望</span>
          <span />
        </div>
        {cases.map((item) => {
          const passed = caseResults[item.case_version.id] ?? false;
          return (
            <div className="linearTableRow linearEvalGrid" key={item.case_version.id}>
              <div className="resultSwitch">
                <button className={passed ? "resultOn" : ""} onClick={() => onToggle(item.case_version.id, true)} type="button">通过</button>
                <button className={!passed ? "resultOff" : ""} onClick={() => onToggle(item.case_version.id, false)} type="button">不通过</button>
              </div>
              <div>
                <strong>{item.case.title}</strong>
                <small>case v{item.case_version.version_number}</small>
              </div>
              <pre>{item.case_version.input_artifact.content_text ?? item.case_version.input_artifact.digest}</pre>
              <pre>{item.case_version.expected_output_artifact.content_text ?? item.case_version.expected_output_artifact.digest}</pre>
              <div className="caseRowActions">
                <button onClick={() => onEditCase(item.case.id)} type="button">编辑</button>
                <button onClick={() => onArchiveCase(item.case.id)} type="button">归档</button>
              </div>
            </div>
          );
        })}
        {cases.length === 0 ? <div className="linearEmpty">还没有测试用例。先从右侧添加一个 case。</div> : null}
      </div>
    </div>
  );
}

function Inspector({
  actionMode,
  busy,
  cases,
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
  recordEvalRun,
  score,
  selectedCase,
  selectedDetail,
  updateCase,
  updateSkill,
}: {
  actionMode: ActionMode;
  busy: boolean;
  cases: EvalSetVersionDetail["cases"];
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
  recordEvalRun: () => void;
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
          <span>证据</span>
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
          ["skill", "编辑 Skill"],
          ["new-skill", "新建 skill"],
          ["import-skill", "导入 bundle"],
          ["new-variant", "新建 variant"],
          ["new-version", "追加版本"],
          ["new-case", "新增 case"],
          ["edit-case", "编辑 case"],
          ["run", "提交测评"],
        ].map(([value, label]) => (
          <button
            className={actionMode === value ? "actionMenuActive" : ""}
            key={value}
            onClick={() => onAction(value as ActionMode)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {actionMode === "skill" ? (
        <form className="inspectorForm" onSubmit={updateSkill}>
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
        <form className="inspectorForm" onSubmit={importSkill}>
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
          <button disabled={busy} type="submit">导入并创建 skill</button>
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
          <textarea name="content" placeholder="新的 skill bundle 内容摘要或 locator 来源" required />
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
          <p>结果在中栏逐条切换，这里只负责提交 exact binding。</p>
          <button disabled={busy || cases.length === 0} onClick={recordEvalRun} type="button">提交 eval run</button>
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

function formatBundlePreview(variant: VariantDetail | null): string {
  if (!variant?.current_version) return "还没有 current version。";
  const importedSkill = skillMdFromBundleArtifact(variant.current_version.bundle_artifact?.content_text);
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
  const bytes = new Uint8Array(await file.arrayBuffer());
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
