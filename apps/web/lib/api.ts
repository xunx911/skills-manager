import { emptySkillDetail } from "./empty-state";
import { codeReviewerDetail, evalRunDetail, evalSetVersionDetail } from "./mock-data";
import type { EvalRunDetail, EvalSetVersionDetail, SkillDetail, SkillSummary, VariantDetail } from "./types";

const API_BASE_URL = process.env.SKILLHUB_API_URL ?? "http://127.0.0.1:8000";

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return fallback;
    }
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export async function listSkills(): Promise<SkillSummary[]> {
  return getJson("/api/skills", []);
}

export async function getSkillDetail(skillId: string): Promise<SkillDetail> {
  if (skillId === emptySkillDetail.skill.id) return emptySkillDetail;
  const fallback = skillId === codeReviewerDetail.skill.id ? codeReviewerDetail : codeReviewerDetail;
  return getJson(`/api/skills/${skillId}`, fallback);
}

export async function getVariantDetail(variantId: string): Promise<{ skill: SkillDetail; variant: VariantDetail }> {
  const skill = await getSkillDetail(codeReviewerDetail.skill.id);
  const variant = skill.variants.find((item) => item.id === variantId) ?? skill.variants[0];
  return { skill, variant };
}

export async function getVariantVersionDetail(
  variantId: string,
  versionId: string,
): Promise<{ skill: SkillDetail; variant: VariantDetail; selectedVersionId: string }> {
  const result = await getVariantDetail(variantId);
  return {
    ...result,
    selectedVersionId: versionId,
  };
}

export async function getEvalSetVersionDetail(evalSetVersionId: string): Promise<EvalSetVersionDetail> {
  return getJson(`/api/eval-set-versions/${evalSetVersionId}`, evalSetVersionDetail);
}

export async function getEvalRunDetail(evalRunId: string): Promise<EvalRunDetail> {
  return getJson(`/api/eval-runs/${evalRunId}`, evalRunDetail);
}

export function verificationLabel(summary: SkillSummary): string {
  const run = summary.latest_accepted_eval_run;
  if (!summary.default_variant) return "No default variant";
  if (!summary.default_variant.current_version) return "No current version";
  if (!summary.primary_eval_set?.current_version) return "No eval set snapshot";
  if (!run) return "Unverified";
  const passed = run.summary.passed ?? 0;
  const total = run.summary.total ?? 0;
  return `${passed}/${total} passed`;
}

export function passRate(run: { summary: { passed?: number; total?: number } }): number | null {
  const passed = run.summary.passed;
  const total = run.summary.total;
  if (passed === undefined || !total) return null;
  return Math.round((passed / total) * 100);
}
