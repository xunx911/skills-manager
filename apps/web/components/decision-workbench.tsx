"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { passRate } from "@/lib/api";
import { formatDate, percent, shortId } from "@/lib/format";
import type {
  EvalRunRecord,
  EvalSetSummary,
  EvalSetVersionDetail,
  SkillDetail,
  SkillSummary,
  VariantDetail,
} from "@/lib/types";
import { Badge } from "./chrome";

const API_BASE_URL = process.env.NEXT_PUBLIC_SKILLHUB_API_URL ?? "http://127.0.0.1:8000";
const ACTOR = "product-operator";

type DecisionWorkbenchProps = {
  skills: SkillSummary[];
  featuredSkill: SkillDetail;
};

type Notice = { tone: "good" | "bad" | "neutral"; message: string } | null;

export function DecisionWorkbench({ skills: initialSkills, featuredSkill }: DecisionWorkbenchProps) {
  const [skills, setSkills] = useState(initialSkills);
  const [selectedSkillId, setSelectedSkillId] = useState(
    initialSkills[0]?.skill.id ?? featuredSkill.skill.id,
  );
  const [selectedDetail, setSelectedDetail] = useState<SkillDetail>(featuredSkill);
  const [evalSetDetail, setEvalSetDetail] = useState<EvalSetVersionDetail | null>(null);
  const [caseResults, setCaseResults] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const selectedSummary = useMemo(() => {
    return skills.find((summary) => summary.skill.id === selectedSkillId) ?? selectedDetail.summary;
  }, [selectedDetail.summary, selectedSkillId, skills]);

  const defaultVariant = selectedDetail.summary.default_variant ?? selectedSummary.default_variant;
  const primaryEvalSet = selectedDetail.eval_sets[0] ?? selectedSummary.primary_eval_set;
  const currentEvalSetVersion = primaryEvalSet?.current_version ?? null;
  const latestRun = selectedDetail.latest_eval_runs[0] ?? selectedSummary.latest_accepted_eval_run;
  const score = latestRun ? passRate(latestRun) : null;
  const cases = evalSetDetail?.cases ?? [];

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

  async function loadSkills(nextSelectedId = selectedSkillId) {
    const nextSkills = await apiGet<SkillSummary[]>("/api/skills");
    setSkills(nextSkills);
    if (nextSkills.some((item) => item.skill.id === nextSelectedId)) {
      setSelectedSkillId(nextSelectedId);
      await loadSkill(nextSelectedId);
      return;
    }
    const fallbackId = nextSkills[0]?.skill.id ?? featuredSkill.skill.id;
    setSelectedSkillId(fallbackId);
    await loadSkill(fallbackId);
  }

  async function loadSkill(skillId: string) {
    try {
      const detail = await apiGet<SkillDetail>(`/api/skills/${skillId}`);
      setSelectedDetail(detail);
    } catch {
      if (skillId === featuredSkill.skill.id) {
        setSelectedDetail(featuredSkill);
      }
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
    const form = formValues(event.currentTarget);
    await runCommand("Skill 已创建。", async () => {
      const summary = textValue(form, "summary");
      const digest = await digestText(summary + textValue(form, "slug"));
      const result = await apiSend<{ skill_id: string }>("/api/skills", {
        method: "POST",
        body: {
          slug: textValue(form, "slug"),
          owner_ref: textValue(form, "owner_ref"),
          variant_name: "Default",
          variant_label: textValue(form, "variant_label"),
          variant_summary: summary,
          tags: tagList(textValue(form, "tags")),
          content_ref: {
            kind: "skill_bundle",
            locator: `inline:${textValue(form, "slug")}`,
            digest,
          },
          change_summary: textValue(form, "change_summary"),
          actor: ACTOR,
        },
      });
      setSelectedSkillId(result.skill_id);
      event.currentTarget.reset();
      return "Skill 已创建，并自动生成 Primary eval set 与默认 variant。";
    });
  }

  async function updateSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formValues(event.currentTarget);
    await runCommand("Skill 已更新。", async () => {
      await apiSend(`/api/skills/${selectedDetail.skill.id}`, {
        method: "PATCH",
        body: {
          slug: textValue(form, "slug"),
          owner_ref: textValue(form, "owner_ref"),
        },
      });
    });
  }

  async function archiveSkill() {
    await runCommand("Skill 已归档。", async () => {
      await apiSend(`/api/skills/${selectedDetail.skill.id}`, { method: "DELETE" });
      return "Skill 已归档；历史版本和测评记录仍然保留。";
    });
  }

  async function createVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formValues(event.currentTarget);
    await runCommand("Variant 已创建。", async () => {
      const summary = textValue(form, "summary");
      const digest = await digestText(summary + textValue(form, "tags"));
      await apiSend("/api/variants", {
        method: "POST",
        body: {
          skill_id: selectedDetail.skill.id,
          name: textValue(form, "label"),
          label: textValue(form, "label"),
          summary,
          tags: tagList(textValue(form, "tags")),
          content_ref: {
            kind: "skill_bundle",
            locator: `inline:${selectedDetail.skill.slug}/${textValue(form, "label")}`,
            digest,
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
    const form = formValues(event.currentTarget);
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
    const form = formValues(event.currentTarget);
    await runCommand("测试用例已加入当前评测集。", async () => {
      await apiSend("/api/eval-cases", {
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
      event.currentTarget.reset();
    });
  }

  async function updateCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formValues(event.currentTarget);
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
    });
  }

  async function archiveCase(caseId: string) {
    await runCommand("测试用例已归档。", async () => {
      await apiSend(`/api/eval-cases/${caseId}`, { method: "DELETE" });
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

  return (
    <div className="decisionWorkbench productWorkbench">
      <nav className="screenNav" aria-label="Workbench screens">
        <a href="#screen-distribution">01 分发</a>
        <a href="#screen-variants">02 变体</a>
        <a href="#screen-evals">03 测评</a>
        <span>{busy ? "Saving..." : "Ready"}</span>
      </nav>

      {notice ? <div className={`notice notice-${notice.tone}`}>{notice.message}</div> : null}

      <section className="productScreen distributionScreen" id="screen-distribution">
        <div className="screenIntro">
          <p className="eyebrow">01 / Distribution</p>
          <h1>先像普通 SkillHub 一样找到 skill。</h1>
          <p>区别在于，默认 variant、当前版本和验证证据始终贴着选择动作出现。</p>
        </div>

        <div className="distributionGrid">
          <section className="catalogPane" aria-label="Skill catalog">
            <div className="paneHeader">
              <div>
                <span>Catalog</span>
                <strong>Skill index</strong>
              </div>
              <small>{skills.length} entries</small>
            </div>
            <div className="catalogList">
              {skills.map((summary) => {
                const isSelected = summary.skill.id === selectedDetail.skill.id;
                const run = summary.latest_accepted_eval_run;
                const rate = run ? passRate(run) : null;
                return (
                  <button
                    className={`catalogItem ${isSelected ? "catalogItemActive" : ""}`}
                    key={summary.skill.id}
                    onClick={() => setSelectedSkillId(summary.skill.id)}
                    type="button"
                  >
                    <span className="catalogItemTop">
                      <strong>{summary.skill.slug}</strong>
                      <StatusDot run={run} />
                    </span>
                    <span>{summary.default_variant?.summary ?? "还没有默认 variant。"}</span>
                    <span className="catalogMeta">
                      {summary.default_variant?.tags.join(" + ") ?? "no tags"}
                      <b>{run ? percent(rate) : "unverified"}</b>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="selectedPane selectedPaneLarge" aria-label="Selected skill">
            <div className="selectedHero">
              <div>
                <p className="eyebrow">{selectedDetail.skill.owner_ref}</p>
                <h2>{selectedDetail.skill.slug}</h2>
                <p>{defaultVariant?.summary ?? "这个 skill 还没有配置默认 variant。"}</p>
              </div>
              <div className="selectedActions">
                <Link className="workbenchButton workbenchButtonPrimary" href={`/skills/${selectedDetail.skill.id}`}>
                  打开详情
                </Link>
                {defaultVariant ? (
                  <Link className="workbenchButton" href={`/variants/${defaultVariant.id}`}>
                    当前 variant
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="proofStrip">
              <ProofMetric label="默认 variant" value={defaultVariant?.label ?? "none"} />
              <ProofMetric label="当前版本" value={defaultVariant?.current_version ? `v${defaultVariant.current_version.version_number}` : "none"} />
              <ProofMetric label="评测集" value={currentEvalSetVersion ? `v${currentEvalSetVersion.version_number}` : "none"} />
              <ProofMetric label="最新结果" value={latestRun ? percent(score) : "未测评"} tone={score === 100 ? "good" : latestRun ? "bad" : "neutral"} />
            </div>

            <div className="opsGrid opsGridTwo">
              <form className="opsCard" onSubmit={updateSkill}>
                <h3>编辑 Skill</h3>
                <input name="slug" defaultValue={selectedDetail.skill.slug} required />
                <input name="owner_ref" defaultValue={selectedDetail.skill.owner_ref} required />
                <div className="formActions">
                  <button disabled={busy} type="submit">保存</button>
                  <button className="dangerButton" disabled={busy} onClick={archiveSkill} type="button">归档</button>
                </div>
              </form>

              <form className="opsCard opsCardStrong" onSubmit={createSkill}>
                <h3>添加 Skill</h3>
                <input name="slug" placeholder="security-reviewer" required />
                <input name="owner_ref" placeholder="skillhub-lab" required />
                <input name="variant_label" placeholder="Baseline" required />
                <input name="tags" placeholder="codex, gpt5.4" required />
                <textarea name="summary" placeholder="这个 skill 用来做什么" required />
                <textarea name="change_summary" placeholder="初始版本说明" required />
                <button disabled={busy} type="submit">创建 skill</button>
              </form>
            </div>
          </section>
        </div>
      </section>

      <section className="productScreen" id="screen-variants">
        <div className="screenIntro">
          <p className="eyebrow">02 / Variants</p>
          <h1>变体是不同约束下的当前答案，不是血缘图。</h1>
          <p>维护者可以创建新约束 variant，也可以追加不可变版本，再决定是否成为 current。</p>
        </div>

        <div className="variantOpsGrid">
          <div className="variantLedger">
            {selectedDetail.variants.map((variant) => (
              <article className="variantLedgerRow" key={variant.id}>
                <div>
                  <span>{variant.tags.join(" + ")}</span>
                  <strong>{variant.label}</strong>
                  <p>{variant.summary}</p>
                </div>
                <div>
                  <Badge tone={variant.id === defaultVariant?.id ? "good" : "blue"}>
                    {variant.id === defaultVariant?.id ? "default" : "variant"}
                  </Badge>
                  <small>{variant.current_version ? `current v${variant.current_version.version_number}` : "no current"}</small>
                </div>
              </article>
            ))}
          </div>

          <div className="opsGrid">
            <form className="opsCard" onSubmit={createVariant}>
              <h3>添加 Variant</h3>
              <input name="label" placeholder="Codex + long-context" required />
              <input name="tags" placeholder="codex, long-context" required />
              <textarea name="summary" placeholder="这个约束组合下为什么需要独立最优解" required />
              <textarea name="change_summary" placeholder="初始版本说明" required />
              <label className="checkLine"><input name="make_default" type="checkbox" /> 设为默认 variant</label>
              <button disabled={busy} type="submit">创建 variant</button>
            </form>

            <form className="opsCard" onSubmit={createVariantVersion}>
              <h3>追加版本</h3>
              <select name="variant_id" required>
                {selectedDetail.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>{variant.label}</option>
                ))}
              </select>
              <textarea name="content" placeholder="新的 skill bundle 内容摘要或 locator 来源" required />
              <textarea name="change_summary" placeholder="这次更新带来了什么收益" required />
              <label className="checkLine"><input name="make_current" type="checkbox" defaultChecked /> 成为 current version</label>
              <button disabled={busy} type="submit">保存版本</button>
            </form>
          </div>
        </div>
      </section>

      <section className="productScreen evalScreen" id="screen-evals">
        <div className="screenIntro">
          <p className="eyebrow">03 / Evaluation</p>
          <h1>测评集管理和手工确认要像记账一样顺手。</h1>
          <p>每个 case 是 input + expected output + notes 的版本快照；每次运行绑定 exact variant version 和 exact eval set version。</p>
        </div>

        <div className="evalGrid">
          <section className="caseWorkbench">
            <div className="paneHeader">
              <div>
                <span>Eval set</span>
                <strong>{primaryEvalSet?.name ?? "Primary"}</strong>
              </div>
              <small>{currentEvalSetVersion ? `version ${currentEvalSetVersion.version_number}` : "no snapshot"}</small>
            </div>

            <div className="caseList">
              {cases.map((item) => (
                <article className="caseCard" key={item.case_version.id}>
                  <div>
                    <span>Case v{item.case_version.version_number}</span>
                    <strong>{item.case.title}</strong>
                    <p>{item.case_version.notes ?? "No notes"}</p>
                  </div>
                  <div className="casePreview">
                    <pre>{item.case_version.input_artifact.content_text ?? item.case_version.input_artifact.digest}</pre>
                    <pre>{item.case_version.expected_output_artifact.content_text ?? item.case_version.expected_output_artifact.digest}</pre>
                  </div>
                  <div className="caseActions">
                    <label className="passToggle">
                      <input
                        checked={caseResults[item.case_version.id] ?? false}
                        onChange={(event) =>
                          setCaseResults((current) => ({
                            ...current,
                            [item.case_version.id]: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      {caseResults[item.case_version.id] ? "通过" : "不通过"}
                    </label>
                    <button className="dangerButton" disabled={busy} onClick={() => archiveCase(item.case.id)} type="button">归档</button>
                  </div>
                </article>
              ))}
              {cases.length === 0 ? <div className="emptyState">还没有测试用例。先添加一个 case，再做手工评测。</div> : null}
            </div>
          </section>

          <aside className="evalOps">
            <form className="opsCard opsCardStrong" onSubmit={createCase}>
              <h3>添加测试用例</h3>
              <input name="title" placeholder="PR: 订单详情缺少 owner 校验" required />
              <textarea name="input_text" placeholder="输入：代码 diff、任务上下文、用户请求..." required />
              <textarea name="expected_output" placeholder="期望输出：应该指出什么、避免什么..." required />
              <textarea name="notes" placeholder="来源、bad case、维护说明" />
              <button disabled={busy} type="submit">加入评测集</button>
            </form>

            <form className="opsCard" onSubmit={updateCase}>
              <h3>编辑 Case 为新版本</h3>
              <select name="case_id" required>
                {cases.map((item) => (
                  <option key={item.case.id} value={item.case.id}>{item.case.title}</option>
                ))}
              </select>
              <input name="title" placeholder="新标题，可保持语义不变" required />
              <textarea name="input_text" placeholder="新的 input 内容" required />
              <textarea name="expected_output" placeholder="新的 expected output" required />
              <textarea name="notes" placeholder="为什么更新这个 case" />
              <button disabled={busy || cases.length === 0} type="submit">保存 case version</button>
            </form>

            <div className="opsCard runCard">
              <h3>手工确认结果</h3>
              <p>{defaultVariant?.current_version ? `VariantVersion ${shortId(defaultVariant.current_version.id)}` : "缺少 variant version"}</p>
              <p>{currentEvalSetVersion ? `EvalSetVersion ${shortId(currentEvalSetVersion.id)}` : "缺少 eval set version"}</p>
              <button
                className="workbenchButton workbenchButtonPrimary"
                disabled={busy || cases.length === 0 || !defaultVariant?.current_version || !currentEvalSetVersion}
                onClick={recordEvalRun}
                type="button"
              >
                记录本次测评
              </button>
              {latestRun ? (
                <Link className="workbenchButton" href={`/eval-runs/${latestRun.id}`}>
                  查看最近 run：{formatDate(latestRun.created_at)}
                </Link>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function ProofMetric({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "good" | "bad";
  value: string;
}) {
  return (
    <div className={`proofMetric proofMetric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusDot({ run }: { run: EvalRunRecord | null }) {
  return <span className={`catalogStatus ${run ? "catalogStatusOn" : ""}`} aria-hidden="true" />;
}

function formValues(form: HTMLFormElement) {
  return new FormData(form);
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

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(await responseText(response));
  return response.json() as Promise<T>;
}

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
