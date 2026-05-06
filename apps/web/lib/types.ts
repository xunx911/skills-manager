export type JsonObject = Record<string, unknown>;

export type SkillSummary = {
  skill: {
    id: string;
    slug: string;
    owner_ref: string;
    default_variant_id: string | null;
    lifecycle_status: string;
    created_at?: string;
    updated_at?: string;
  };
  default_variant: VariantDetail | null;
  primary_eval_set: EvalSetSummary | null;
  latest_accepted_eval_run: EvalRunRecord | null;
};

export type SkillDetail = {
  skill: SkillSummary["skill"];
  summary: SkillSummary;
  variants: VariantDetail[];
  eval_sets: EvalSetSummary[];
  latest_eval_runs: EvalRunRecord[];
};

export type VariantDetail = {
  id: string;
  skill_id: string;
  name: string;
  label: string;
  summary: string;
  tag_set_id: string;
  current_version_id: string | null;
  lifecycle_status: string;
  created_at?: string;
  updated_at?: string;
  tags: string[];
  current_version: VariantVersion | null;
  versions: VariantVersion[];
};

export type VariantVersion = {
  id: string;
  skill_id: string;
  variant_id: string;
  version_number: number;
  content_ref: ContentRef;
  content_digest: string;
  change_summary: string;
  created_at?: string;
  created_by: string;
};

export type ContentRef = {
  kind: string;
  locator: string;
  digest: string;
  path?: string | null;
};

export type EvalSetSummary = {
  id: string;
  skill_id: string;
  name: string;
  description: string;
  current_version_id: string | null;
  lifecycle_status: string;
  created_at?: string;
  updated_at?: string;
  current_version: EvalSetVersion | null;
  versions: EvalSetVersion[];
};

export type EvalSetVersion = {
  id: string;
  skill_id: string;
  eval_set_id: string;
  version_number: number;
  created_at?: string;
  created_by: string;
};

export type EvalSetVersionDetail = {
  eval_set_version: EvalSetVersion;
  eval_set: Omit<EvalSetSummary, "current_version" | "versions">;
  cases: EvalSetCase[];
};

export type EvalSetCase = {
  position: number;
  case: {
    id: string;
    skill_id: string;
    title: string;
    current_version_id: string | null;
    lifecycle_status: string;
    created_at?: string;
    updated_at?: string;
  };
  case_version: EvalCaseVersionDetail;
};

export type EvalCaseVersionDetail = {
  id: string;
  skill_id: string;
  case_id: string;
  version_number: number;
  input_artifact_id: string;
  expected_output_artifact_id: string;
  notes: string | null;
  created_at?: string;
  created_by: string;
  input_artifact: ArtifactRef;
  expected_output_artifact: ArtifactRef;
};

export type ArtifactRef = {
  id: string;
  kind: string;
  namespace: string;
  locator: string;
  digest: string;
  media_type: string;
  size_bytes: number;
  content_text?: string | null;
  created_at?: string;
  created_by: string;
};

export type EvalRunRecord = {
  id: string;
  skill_id: string;
  variant_version_id: string;
  eval_set_version_id: string;
  strategy: string;
  status: string;
  summary: {
    passed?: number;
    failed?: number;
    total?: number;
  };
  result_artifact_id: string | null;
  created_at?: string;
  created_by: string;
};

export type EvalRunDetail = {
  eval_run: EvalRunRecord;
  skill: SkillSummary["skill"];
  variant_version: VariantVersion;
  eval_set_version: EvalSetVersion;
  case_results: CaseResultDetail[];
};

export type CaseResultDetail = {
  result: {
    run_id: string;
    skill_id: string;
    case_version_id: string;
    passed: boolean;
    score: number;
    result_artifact_id: string | null;
    created_at?: string;
  };
  case: EvalSetCase["case"];
  case_version: EvalCaseVersionDetail;
};
