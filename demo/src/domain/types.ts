export type View = "hub" | "skill" | "eval" | "result" | "workbench" | "manage";

export type EvalCaseSource = "manual" | "bad_case" | "imported" | "generated";
export type EvalRunStatus = "queued" | "running" | "finished" | "failed";
export type LifecycleStatus = "active" | "archived";

export interface Skill {
  id: string;
  slug: string;
  ownerRef: string;
  defaultVariantRef: string;
  createdAt: string;
  lifecycleStatus?: LifecycleStatus;
  archivedAt?: string;
}

export interface TagSet {
  id: string;
  tagsHash: string;
  tags: string[];
}

export interface ContentRef {
  kind: "inline_bundle" | "skill_bundle" | "artifact" | "git" | "external_repo";
  locator: string;
  digest: string;
  path?: string;
}

export interface Variant {
  id: string;
  skillRef: string;
  name: string;
  label: string;
  summary: string;
  tagSetRef: string;
  currentVersionRef: string;
  createdAt: string;
  lifecycleStatus?: LifecycleStatus;
  archivedAt?: string;
}

export interface VariantVersion {
  id: string;
  variantRef: string;
  version: string;
  contentRef: ContentRef;
  changeRef?: string;
  changeNote?: string;
  createdAt: string;
}

export interface EvalCorpus {
  id: string;
  skillRef: string;
  createdAt: string;
}

export interface EvalCase {
  id: string;
  corpusRef: string;
  title: string;
  sourceType: EvalCaseSource;
  originRef?: string;
  currentVersionRef?: string;
  caseRef?: string;
  caseVersion?: string;
  inputArtifactRef: string;
  expectationArtifactRef: string;
  graderRef: string;
  expectation: string;
  createdAt: string;
}

export interface EvalCaseVersion {
  id: string;
  caseRef: string;
  version: string;
  inputArtifactRef: string;
  expectationArtifactRef: string;
  graderRef: string;
  expectation: string;
  createdAt: string;
}

export interface EvalSetVersion {
  id: string;
  corpusRef: string;
  version: string;
  caseRefs: string[];
  caseVersionRefs?: string[];
  createdAt: string;
}

export interface EvalRun {
  id: string;
  variantVersionRef: string;
  evalSetVersionRef: string;
  strategyRef: string;
  runConfigHash: string;
  status: EvalRunStatus;
  resultArtifactRef?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface CaseResult {
  runRef: string;
  caseRef: string;
  caseVersionRef?: string;
  passed: boolean;
  score: number;
  evidenceArtifactRef?: string;
  errorArtifactRef?: string;
}

export interface SourceFeedback {
  id: string;
  skillRef: string;
  variantVersionRef?: string;
  tagSetRef?: string;
  title: string;
  failureType: string;
  rawInput: string;
  rawOutput?: string;
  convertedEvalCaseRef?: string;
  createdAt: string;
}

export interface Artifact {
  id: string;
  kind: string;
  content: string;
  contentHash: string;
  mediaType: string;
  createdAt: string;
}

export interface AppData {
  skills: Skill[];
  tagSets: TagSet[];
  variants: Variant[];
  variantVersions: VariantVersion[];
  evalCorpora: EvalCorpus[];
  evalCases: EvalCase[];
  evalCaseVersions: EvalCaseVersion[];
  evalSetVersions: EvalSetVersion[];
  evalRuns: EvalRun[];
  caseResults: CaseResult[];
  sourceFeedback: SourceFeedback[];
  artifacts: Artifact[];
}

export interface AppState {
  view: View;
  selectedSkillRef: string;
  requestedTags: string[];
  evalSetVersionRef: string;
  selectedVariantRef: string;
  selectedVersionRef: string;
  data: AppData;
}

export interface VariantEvalSummary {
  variant: Variant;
  version: VariantVersion;
  evalScore: number | null;
  tagMatchScore: number;
}
