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
  role_assignments: RoleAssignment[];
  audit_events: AuditEvent[];
};

export type AuditEvent = {
  id: string;
  actor_ref: string;
  action: string;
  resource_type: string;
  resource_id: string;
  payload: JsonObject;
  created_at?: string;
};

export type RoleAssignment = {
  id: string;
  subject_type: string;
  subject_id: string;
  resource_type: "skill";
  resource_id: string;
  role: "owner" | "maintainer" | "evaluator" | "viewer";
  created_at?: string;
  created_by: string;
};

export type SkillPermission = "role.manage" | "variant.promote" | "verification.accept";

export type SkillCapabilities = {
  actor: string;
  subject_type: string;
  roles: RoleAssignment["role"][];
  permissions: Record<SkillPermission, boolean>;
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
  bundle_artifact?: ArtifactRef | null;
  bundle_files?: BundleFile[];
};

export type ContentRef = {
  kind: string;
  locator: string;
  digest: string;
  path?: string | null;
};

export type BundleFile = {
  path: string;
  sha256?: string;
  size_bytes?: number;
  content_text?: string | null;
  content_base64?: string | null;
  binary?: boolean;
};

export type BundleDiffStatus = "added" | "removed" | "changed" | "unchanged";

export type BundleDiffLine = {
  kind: "context" | "added" | "removed";
  old_line: number | null;
  new_line: number | null;
  text: string;
};

export type BundleDiffHunk = {
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: BundleDiffLine[];
};

export type BundleDiffFile = {
  path: string;
  status: BundleDiffStatus;
  binary: boolean;
  left_digest: string | null;
  right_digest: string | null;
  left_size_bytes: number | null;
  right_size_bytes: number | null;
  hunks?: BundleDiffHunk[];
};

export type BundleDiff = {
  left: {
    variant_version_id: string;
    version_number: number;
    content_digest: string;
  };
  right: {
    variant_version_id: string;
    version_number: number;
    content_digest: string;
  };
  summary: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
    binary: number;
  };
  files: BundleDiffFile[];
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

export type AcceptedVerification = {
  id: string;
  skill_id: string;
  variant_id: string;
  variant_version_id: string;
  eval_set_version_id: string;
  eval_run_id: string;
  note: string;
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

export type EvalRunHistoryRow = {
  eval_run: EvalRunRecord;
  variant: Omit<VariantDetail, "current_version" | "versions"> & { tags: string[] };
  variant_version: VariantVersion;
  eval_set: Omit<EvalSetSummary, "current_version" | "versions">;
  eval_set_version: EvalSetVersion;
  accepted_verification: AcceptedVerification | null;
};

export type EvalRunHistory = {
  skill: SkillSummary["skill"];
  runs: EvalRunHistoryRow[];
};

export type EvalRunMatrixCase = {
  case: EvalSetCase["case"];
  versions: Array<{
    case_version_id: string;
    version_number: number;
  }>;
};

export type EvalRunMatrixCell = {
  run_id: string;
  case_id: string;
  case_version_id: string;
  passed: boolean;
  score: number;
};

export type EvalRunMatrix = {
  skill: SkillSummary["skill"];
  runs: Array<Omit<EvalRunHistoryRow, "accepted_verification">>;
  cases: EvalRunMatrixCase[];
  cells: EvalRunMatrixCell[];
};

export type SavedView = {
  id: string;
  skill_id: string;
  name: string;
  view_type: "run_history";
  config: Partial<Record<
    | "variant_version_id"
    | "eval_set_version_id"
    | "strategy"
    | "status"
    | "matrix_group_by"
    | "matrix_impact"
    | "matrix_show_impact"
    | "matrix_show_score",
    string
  >>;
  created_at?: string;
  created_by: string;
};

export type EvalCaseHistoryVersion = {
  case_version: EvalCaseVersionDetail;
  included_in_eval_set_versions: Array<{
    id: string;
    eval_set_id: string;
    version_number: number;
    position: number;
    created_at?: string;
    created_by: string;
  }>;
};

export type EvalCaseHistory = {
  case: EvalSetCase["case"];
  versions: EvalCaseHistoryVersion[];
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

export type EvalRunComparisonCase = {
  case_id: string;
  case_title: string;
  case_version_id: string;
  change: "fixed" | "regressed" | "stable_pass" | "stable_fail" | "missing_baseline" | "missing_candidate";
  change_label: string;
  baseline_passed: boolean | null;
  candidate_passed: boolean | null;
  input_text: string | null;
  expected_output_text: string | null;
};

export type EvalRunComparison = {
  skill: SkillSummary["skill"];
  eval_set: Omit<EvalSetSummary, "current_version" | "versions">;
  eval_set_version: EvalSetVersion;
  baseline: {
    eval_run: EvalRunRecord;
    variant: Omit<VariantDetail, "current_version" | "versions"> & { tags: string[] };
    variant_version: VariantVersion;
  };
  candidate: {
    eval_run: EvalRunRecord;
    variant: Omit<VariantDetail, "current_version" | "versions"> & { tags: string[] };
    variant_version: VariantVersion;
  };
  summary: Record<EvalRunComparisonCase["change"], number> & {
    baseline_pass_rate: number | null;
    candidate_pass_rate: number | null;
    delta: number | null;
  };
  case_comparisons: EvalRunComparisonCase[];
  candidate_accepted_verification: AcceptedVerification | null;
};

export type PromotionReadiness = {
  status: "ready" | "risky" | "unverified" | "blocked";
  label: string;
  reason: string;
  requires_note: boolean;
  risk_items: string[];
  blocking_items: string[];
  passing_items: string[];
};

export type PromotionCaseComparison = {
  case_id: string;
  case_title: string;
  case_version_id: string;
  change: "fixed" | "regressed" | "stable_pass" | "stable_fail" | "missing_baseline" | "missing_candidate";
  change_label: string;
  current_passed: boolean | null;
  candidate_passed: boolean | null;
  input_text: string | null;
  expected_output_text: string | null;
};

export type PromotionReview = {
  skill: SkillSummary["skill"];
  variant: Omit<VariantDetail, "current_version" | "versions"> & { tags: string[] };
  current_version: VariantVersion | null;
  candidate_version: VariantVersion;
  eval_set: Omit<EvalSetSummary, "current_version" | "versions">;
  eval_set_version: EvalSetVersion;
  candidate_run: EvalRunRecord | null;
  current_run: EvalRunRecord | null;
  readiness: PromotionReadiness;
  comparison_summary: Record<PromotionCaseComparison["change"], number>;
  case_comparisons: PromotionCaseComparison[];
  bundle_diff: BundleDiff | null;
};

export type PromotionDecision = {
  id: string;
  skill_id: string;
  variant_id: string;
  from_version_id: string | null;
  to_version_id: string;
  eval_set_version_id: string;
  evidence_eval_run_id: string;
  baseline_eval_run_id: string | null;
  readiness_status: PromotionReadiness["status"];
  decision_note: string | null;
  accepted_risk: boolean;
  created_at?: string;
  created_by: string;
};
