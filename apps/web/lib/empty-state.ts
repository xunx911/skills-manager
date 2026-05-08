import type { SkillDetail, SkillSummary } from "./types";

const now = "2026-05-05T10:00:00.000Z";

export const emptySkillDetail: SkillDetail = {
  skill: {
    id: "workspace-empty",
    slug: "no-skills-yet",
    owner_ref: "skillhub-lab",
    default_variant_id: null,
    lifecycle_status: "empty",
    created_at: now,
    updated_at: now,
  },
  summary: {} as SkillSummary,
  variants: [],
  eval_sets: [],
  latest_eval_runs: [],
};

emptySkillDetail.summary = {
  skill: emptySkillDetail.skill,
  default_variant: null,
  primary_eval_set: null,
  latest_accepted_eval_run: null,
};
