"use client";

import { FormEvent, useState } from "react";

import { Badge } from "@/components/chrome";
import { ValidatedForm } from "@/components/forms/form-validation";
import { TextAreaField } from "@/components/forms/workbench-field";
import { canUseCapability, capabilityDeniedReason } from "@/lib/capabilities";
import { percent, shortId } from "@/lib/format";
import type { EvalRunComparison, SkillCapabilities } from "@/lib/types";

export function RunComparisonPanel({
  busy,
  capabilities,
  comparison,
  loading,
  onAccept,
}: {
  busy: boolean;
  capabilities: SkillCapabilities | null;
  comparison: EvalRunComparison | null;
  loading: boolean;
  onAccept: (note: string) => void | Promise<void>;
}) {
  const [note, setNote] = useState("");
  const canAcceptVerification = canUseCapability(capabilities, "verification.accept");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comparison || busy || comparison.candidate_accepted_verification || !canAcceptVerification) return;
    return onAccept(note.trim());
  }

  if (loading) {
    return (
      <section className="runComparePanel">
        <div className="runCompareEmpty">
          <strong>正在比较两次 run...</strong>
          <span>需要确认它们绑定同一个 EvalSetVersion。</span>
        </div>
      </section>
    );
  }

  if (!comparison) {
    return (
      <section className="runComparePanel">
        <div className="runCompareEmpty">
          <strong>选择对照和候选 run</strong>
          <span>同一个测试集快照下的两次结果，才有可信的修复/回退结论。</span>
        </div>
      </section>
    );
  }

  const accepted = comparison.candidate_accepted_verification;
  const delta = comparison.summary.delta;
  const acceptDisabled = busy || Boolean(accepted) || !canAcceptVerification;
  const acceptDeniedReason = !canAcceptVerification ? capabilityDeniedReason("verification.accept") : undefined;

  return (
    <section className="runComparePanel" data-testid="run-comparison-panel">
      <div className="runCompareHead">
        <div>
          <span>Run comparison</span>
          <strong>
            {comparison.eval_set.name} v{comparison.eval_set_version.version_number} · {deltaLabel(delta)}
          </strong>
        </div>
        <Badge tone={accepted ? "good" : "neutral"}>{accepted ? "Accepted" : "未接受"}</Badge>
      </div>

      <div className="runCompareScoreGrid">
        <RunScoreBox
          label="对照"
          rate={comparison.summary.baseline_pass_rate}
          runId={comparison.baseline.eval_run.id}
          title={`${comparison.baseline.variant.label} v${comparison.baseline.variant_version.version_number}`}
        />
        <RunScoreBox
          label="候选"
          rate={comparison.summary.candidate_pass_rate}
          runId={comparison.candidate.eval_run.id}
          title={`${comparison.candidate.variant.label} v${comparison.candidate.variant_version.version_number}`}
        />
        <RunScoreBox label="变化" rate={delta} runId={comparison.candidate.eval_run.id} title="Candidate - baseline" signed />
      </div>

      <div className="runCompareImpactChips">
        <ImpactChip change="fixed" count={comparison.summary.fixed} label="修复" />
        <ImpactChip change="regressed" count={comparison.summary.regressed} label="回退" />
        <ImpactChip change="stable_pass" count={comparison.summary.stable_pass} label="稳定通过" />
        <ImpactChip change="stable_fail" count={comparison.summary.stable_fail} label="仍未通过" />
      </div>

      <div className="runCompareCases">
        {comparison.case_comparisons.map((item) => (
          <article className={`runCompareCase runCompareCase-${item.change}`} key={item.case_version_id}>
            <div>
              <span>{item.change_label}</span>
              <strong>{item.case_title}</strong>
            </div>
            <div className="runCompareCaseResult">
              <b>{resultLabel(item.baseline_passed)}</b>
              <b>{resultLabel(item.candidate_passed)}</b>
            </div>
          </article>
        ))}
      </div>

      <ValidatedForm className="runCompareAcceptBar" onValidSubmit={submit}>
        <div>
          <span>Verification pointer</span>
          <strong>{accepted ? "候选 run 已是验证依据" : "把候选 run 接受为验证依据"}</strong>
          {!canAcceptVerification ? <small>{acceptDeniedReason}</small> : null}
        </div>
        <TextAreaField
          aria-label="Accepted verification note"
          characterLimit={1000}
          disabled={Boolean(accepted) || !canAcceptVerification}
          label="Verification note"
          name="note"
          onChange={(event) => setNote(event.currentTarget.value)}
          placeholder="可选：记录为什么接受这次测评"
          value={accepted ? accepted.note : note}
        />
        <button className="primaryAction" disabled={acceptDisabled} title={acceptDeniedReason} type="submit">
          接受为验证依据
        </button>
      </ValidatedForm>
    </section>
  );
}

function RunScoreBox({
  label,
  rate,
  runId,
  signed = false,
  title,
}: {
  label: string;
  rate: number | null;
  runId: string;
  signed?: boolean;
  title: string;
}) {
  return (
    <div className="runCompareScoreBox">
      <span>{label}</span>
      <strong>{signed ? deltaLabel(rate) : percent(rate)}</strong>
      <small>{title} · {shortId(runId)}</small>
    </div>
  );
}

function ImpactChip({ change, count, label }: { change: string; count: number; label: string }) {
  return <span className={`runCompareImpact runCompareImpact-${change}`}>{label} {count}</span>;
}

function deltaLabel(value: number | null) {
  if (value === null) return "n/a";
  if (value > 0) return `+${value}%`;
  return `${value}%`;
}

function resultLabel(value: boolean | null) {
  if (value === true) return "通过";
  if (value === false) return "不通过";
  return "缺失";
}
