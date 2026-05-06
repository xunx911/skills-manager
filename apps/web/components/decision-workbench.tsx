"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { passRate, verificationLabel } from "@/lib/api";
import { formatDate, percent, shortId } from "@/lib/format";
import type { EvalRunRecord, EvalSetSummary, SkillDetail, SkillSummary, VariantDetail } from "@/lib/types";
import { Badge } from "./chrome";

type DecisionWorkbenchProps = {
  skills: SkillSummary[];
  featuredSkill: SkillDetail;
};

export function DecisionWorkbench({ skills, featuredSkill }: DecisionWorkbenchProps) {
  const [selectedSkillId, setSelectedSkillId] = useState(skills[0]?.skill.id ?? featuredSkill.skill.id);

  const selectedSummary = useMemo(() => {
    return skills.find((summary) => summary.skill.id === selectedSkillId) ?? skills[0] ?? featuredSkill.summary;
  }, [featuredSkill.summary, selectedSkillId, skills]);

  const selectedDetail = selectedSummary.skill.id === featuredSkill.skill.id ? featuredSkill : null;
  const defaultVariant = selectedDetail?.summary.default_variant ?? selectedSummary.default_variant;
  const variants = selectedDetail?.variants ?? (defaultVariant ? [defaultVariant] : []);
  const evalSets = selectedDetail?.eval_sets ?? (selectedSummary.primary_eval_set ? [selectedSummary.primary_eval_set] : []);
  const latestRun = selectedSummary.latest_accepted_eval_run ?? selectedDetail?.latest_eval_runs[0] ?? null;
  const currentVersion = defaultVariant?.current_version ?? null;
  const primaryEvalSet = selectedSummary.primary_eval_set ?? evalSets[0] ?? null;
  const primaryEvalSetVersion = primaryEvalSet?.current_version ?? null;
  const score = latestRun ? passRate(latestRun) : null;

  return (
    <div className="decisionWorkbench">
      <header className="workbenchMasthead">
        <div>
          <p className="eyebrow">Decision Workbench</p>
          <h1>选择 skill 时，证据必须同时在场。</h1>
          <p>
            首页保留 skillhub 的查找体验，但默认把 variant、版本、测评集快照和最新测评结果放进同一个决策界面。
          </p>
        </div>
        <div className="workbenchStats" aria-label="Workspace summary">
          <Stat label="Skills" value={String(skills.length)} />
          <Stat label="Verified" value={String(skills.filter((skill) => skill.latest_accepted_eval_run).length)} tone="good" />
          <Stat label="Default" value={percent(score)} tone={score === 100 ? "good" : score === null ? "quiet" : "risk"} />
        </div>
      </header>

      <div className="workbenchFrame">
        <section className="catalogPane" aria-label="Skill catalog">
          <div className="paneHeader">
            <div>
              <span>Catalog</span>
              <strong>Skill index</strong>
            </div>
            <small>{skills.length} entries</small>
          </div>
          <label className="workbenchSearch">
            <span>Search</span>
            <input placeholder="skill / tag / owner" />
          </label>
          <div className="catalogList">
            {skills.map((summary) => {
              const isSelected = summary.skill.id === selectedSummary.skill.id;
              const variant = summary.default_variant;
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
                  <span>{variant?.summary ?? "还没有默认 variant。"}</span>
                  <span className="catalogMeta">
                    {variant?.tags.join(" + ") ?? "no tags"}
                    <b>{run ? percent(rate) : "unverified"}</b>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <main className="selectedPane" aria-label="Selected skill">
          <div className="selectedHero">
            <div>
              <p className="eyebrow">{selectedSummary.skill.owner_ref}</p>
              <h2>{selectedSummary.skill.slug}</h2>
              <p>{defaultVariant?.summary ?? "这个 skill 还没有配置默认 variant，因此暂时只能作为草稿查看。"}</p>
            </div>
            <div className="selectedActions">
              <Link className="workbenchButton workbenchButtonPrimary" href={`/skills/${selectedSummary.skill.id}`}>
                打开 skill
              </Link>
              {defaultVariant ? (
                <Link className="workbenchButton" href={`/variants/${defaultVariant.id}`}>
                  查看 variant
                </Link>
              ) : null}
            </div>
          </div>

          <div className="variantBrief">
            <div>
              <span>Default variant</span>
              <strong>{defaultVariant?.label ?? "No default variant"}</strong>
              <p>{defaultVariant ? "普通用户默认使用这个 variant；其它 variant 是不同约束下的可见答案。" : "需要先创建 variant。"}</p>
            </div>
            <div className="tagCluster">
              {defaultVariant?.tags.map((tag) => (
                <Badge key={tag} tone="blue">{tag}</Badge>
              )) ?? <Badge>draft</Badge>}
            </div>
          </div>

          <div className="bundlePreview">
            <div className="bundleTree">
              <strong>skill bundle</strong>
              <span>SKILL.md</span>
              <span>examples/review-input.md</span>
              <span>tests/manual-pass-fail.json</span>
            </div>
            <pre>{formatBundlePreview(defaultVariant)}</pre>
          </div>
        </main>

        <EvidenceRail
          evalSet={primaryEvalSet}
          latestRun={latestRun}
          selectedVariant={defaultVariant}
          score={score}
        />
      </div>

      <section className="matrixPreview" aria-label="Variant and evaluation matrix preview">
        <div className="matrixHeader">
          <div>
            <span>Variant / Eval Matrix</span>
            <strong>不同约束下的当前答案</strong>
          </div>
          <p>这里先展示轻量矩阵，后续再替换成多维查询表格。</p>
        </div>
        <div className="matrixTable">
          <div className="matrixRow matrixRowHead">
            <span>Variant</span>
            <span>Tags</span>
            <span>Current version</span>
            <span>Primary eval set</span>
            <span>Latest result</span>
          </div>
          {variants.map((variant) => (
            <MatrixVariantRow
              evalSet={primaryEvalSet}
              isDefault={variant.id === defaultVariant?.id}
              key={variant.id}
              run={findRunForVariant(selectedDetail, variant) ?? latestRun}
              variant={variant}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function EvidenceRail({
  evalSet,
  latestRun,
  selectedVariant,
  score,
}: {
  evalSet: EvalSetSummary | null;
  latestRun: EvalRunRecord | null;
  selectedVariant: VariantDetail | null;
  score: number | null;
}) {
  const currentVersion = selectedVariant?.current_version ?? null;
  const evalSetVersion = evalSet?.current_version ?? null;

  return (
    <aside className="evidenceRail" aria-label="Evidence rail">
      <div className="paneHeader paneHeaderLight">
        <div>
          <span>Evidence</span>
          <strong>可靠性证据</strong>
        </div>
        <Badge tone={latestRun ? (score === 100 ? "good" : "bad") : "neutral"}>
          {latestRun ? "verified" : "unverified"}
        </Badge>
      </div>

      <Link className="scorePlate" href={latestRun ? `/eval-runs/${latestRun.id}` : "#"}>
        <span>Latest accepted run</span>
        <strong>{latestRun ? percent(score) : "未测评"}</strong>
        <small>{latestRun ? `${latestRun.summary.passed ?? 0}/${latestRun.summary.total ?? 0} passed · ${latestRun.strategy}` : "暂无测评记录"}</small>
      </Link>

      <div className="bindingStack">
        <BindingLine label="VariantVersion" value={currentVersion ? `v${currentVersion.version_number}` : "none"} href={selectedVariant ? `/variants/${selectedVariant.id}` : "#"} hint={shortId(currentVersion?.id)} />
        <BindingLine label="EvalSetVersion" value={evalSetVersion ? `v${evalSetVersion.version_number}` : "none"} href={evalSetVersion ? `/eval-set-versions/${evalSetVersion.id}` : "#"} hint={evalSet?.name ?? "no eval set"} />
        <BindingLine label="Run status" value={latestRun?.status ?? "none"} href={latestRun ? `/eval-runs/${latestRun.id}` : "#"} hint={latestRun?.created_at ? formatDate(latestRun.created_at) : "no run"} />
      </div>

      <div className="evidenceNote">
        <strong>判断规则</strong>
        <p>{selectedVariant ? verificationLabel({
          skill: {
            id: selectedVariant.skill_id,
            slug: selectedVariant.name,
            owner_ref: "",
            default_variant_id: selectedVariant.id,
            lifecycle_status: selectedVariant.lifecycle_status,
          },
          default_variant: selectedVariant,
          primary_eval_set: evalSet,
          latest_accepted_eval_run: latestRun,
        }) : "No default variant"}</p>
      </div>
    </aside>
  );
}

function MatrixVariantRow({
  evalSet,
  isDefault,
  run,
  variant,
}: {
  evalSet: EvalSetSummary | null;
  isDefault: boolean;
  run: EvalRunRecord | null;
  variant: VariantDetail;
}) {
  const rate = run ? passRate(run) : null;
  return (
    <Link className="matrixRow" href={`/variants/${variant.id}`}>
      <span>
        <strong>{variant.label}</strong>
        {isDefault ? <Badge tone="good">default</Badge> : null}
      </span>
      <span>{variant.tags.join(" + ")}</span>
      <span>{variant.current_version ? `v${variant.current_version.version_number}` : "no current"}</span>
      <span>{evalSet?.current_version ? `${evalSet.name} v${evalSet.current_version.version_number}` : "no eval set"}</span>
      <span>{run ? percent(rate) : "unverified"}</span>
    </Link>
  );
}

function BindingLine({ href, hint, label, value }: { href: string; hint: string; label: string; value: string }) {
  return (
    <Link className="bindingLine" href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </Link>
  );
}

function Stat({ label, value, tone = "quiet" }: { label: string; value: string; tone?: "quiet" | "good" | "risk" }) {
  return (
    <div className={`workbenchStat workbenchStat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusDot({ run }: { run: EvalRunRecord | null }) {
  return <span className={`catalogStatus ${run ? "catalogStatusOn" : ""}`} aria-hidden="true" />;
}

function findRunForVariant(skill: SkillDetail | null, variant: VariantDetail): EvalRunRecord | null {
  if (!skill || !variant.current_version) return null;
  return skill.latest_eval_runs.find((run) => run.variant_version_id === variant.current_version?.id) ?? null;
}

function formatBundlePreview(variant: VariantDetail | null): string {
  if (!variant?.current_version) {
    return "No current version yet.";
  }

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
