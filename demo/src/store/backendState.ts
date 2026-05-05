import { createInitialState } from "../domain/seed";
import { applyRouteToState } from "../domain/routes";
import type { AppData, AppState, ContentRef, EvalCase } from "../domain/types";

const API_BASE = "http://127.0.0.1:8788";

type StateOverrides = Partial<Omit<AppState, "data">>;

export type SkillBundleSnapshot = {
  metadata: { name: string; description: string };
  files: Array<{ path: string; content: string }>;
  fileMap: Record<string, string>;
};

export async function loadBackendState(overrides: StateOverrides = {}, routePath?: string): Promise<AppState> {
  const response = await fetch(`${API_BASE}/api/state`);
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  const raw = await response.json();
  const data = normalizeAppData(camelize(raw) as Partial<AppData>);
  const state = normalizeStateSelection({ ...createStateFromData(data), ...resolveSelectionOverrides(data, overrides) });
  return routePath ? applyRouteToState(state, routePath) : state;
}

export async function createBackendEvalCase(input: {
  skillId: string;
  title: string;
  input: string;
  expectedOutput: string;
  view?: AppState["view"];
}): Promise<AppState> {
  const result = await postJson("/api/eval-cases", {
    skill_id: input.skillId,
    title: input.title,
    input: input.input,
    expected_output: input.expectedOutput,
  });
  return loadBackendState({
    view: input.view ?? "workbench",
    selectedSkillRef: input.skillId,
    evalSetVersionRef: result?.eval_set_version?.id,
  });
}

export async function createBackendEvalCaseVersion(input: {
  caseId: string;
  input: string;
  expectedOutput: string;
  makeCurrent?: boolean;
  skillId?: string;
  evalSetVersionRef?: string;
  view?: AppState["view"];
}): Promise<AppState> {
  const result = await postJson("/api/eval-case-versions", {
    case_id: input.caseId,
    input: input.input,
    expected_output: input.expectedOutput,
    make_current: input.makeCurrent ?? true,
  });
  return loadBackendState({
    view: input.view ?? "workbench",
    selectedSkillRef: input.skillId,
    evalSetVersionRef: result?.eval_set_version?.id ?? input.evalSetVersionRef,
  });
}

export async function createBackendSkill(input: {
  slug: string;
  ownerRef: string;
  variantName: string;
  variantLabel: string;
  variantSummary: string;
  tags: string[];
  changeNote?: string;
  view?: AppState["view"];
}): Promise<AppState> {
  const result = await postJson("/api/skills", {
    slug: input.slug,
    owner_ref: input.ownerRef,
    default_variant: {
      name: input.variantName,
      label: input.variantLabel,
      summary: input.variantSummary,
      tags: input.tags,
      change_note: input.changeNote ?? "",
    },
  });
  const overrides: StateOverrides = { view: input.view ?? "workbench" };
  if (typeof result?.skill?.id === "string") overrides.selectedSkillRef = result.skill.id;
  if (typeof result?.variant?.id === "string") overrides.selectedVariantRef = result.variant.id;
  if (typeof result?.variant_version?.id === "string") overrides.selectedVersionRef = result.variant_version.id;
  if (typeof result?.eval_set_version?.id === "string") overrides.evalSetVersionRef = result.eval_set_version.id;
  return loadBackendState(overrides);
}

export async function updateBackendSkill(input: {
  skillId: string;
  slug?: string;
  ownerRef?: string;
  defaultVariantRef?: string;
  lifecycleStatus?: "active" | "archived";
  view?: AppState["view"];
}): Promise<AppState> {
  const result = await patchJson("/api/skills", {
    skill_id: input.skillId,
    slug: input.slug,
    owner_ref: input.ownerRef,
    default_variant_ref: input.defaultVariantRef,
    lifecycle_status: input.lifecycleStatus,
  });
  const selectedVariantRef = result?.skill?.default_variant_ref;
  const overrides: StateOverrides = {
    view: input.view ?? "workbench",
    selectedSkillRef: input.skillId,
  };
  if (typeof selectedVariantRef === "string") overrides.selectedVariantRef = selectedVariantRef;
  const next = await loadBackendState(overrides);
  const selectedVariant = next.data.variants.find((variant) => variant.id === selectedVariantRef);
  return {
    ...next,
    selectedVersionRef: selectedVariant?.currentVersionRef ?? next.selectedVersionRef,
  };
}

export async function createBackendVariant(input: {
  skillId: string;
  name: string;
  label: string;
  summary: string;
  tags: string[];
  changeNote?: string;
  view?: AppState["view"];
}): Promise<AppState> {
  const result = await postJson("/api/variants", {
    skill_id: input.skillId,
    name: input.name,
    label: input.label,
    summary: input.summary,
    tags: input.tags,
    change_note: input.changeNote ?? "",
  });
  const variantId = result?.variant?.id;
  const versionId = result?.variant_version?.id;
  const overrides: StateOverrides = { view: input.view ?? "workbench", selectedSkillRef: input.skillId };
  if (typeof variantId === "string") overrides.selectedVariantRef = variantId;
  if (typeof versionId === "string") overrides.selectedVersionRef = versionId;
  return loadBackendState(overrides);
}

export async function importBackendSkillBundle(input: {
  name: string;
  files: Record<string, string>;
}): Promise<{ contentRef: ContentRef; metadata: { name: string; description: string }; files: string[] }> {
  const result = await postJson("/api/skill-bundles", {
    name: input.name,
    files: input.files,
  });
  return {
    contentRef: camelize(result.content_ref) as ContentRef,
    metadata: camelize(result.metadata) as { name: string; description: string },
    files: result.files ?? [],
  };
}

export async function loadBackendSkillBundle(artifactId: string): Promise<SkillBundleSnapshot> {
  const result = await getJson(`/api/skill-bundle?artifact_id=${encodeURIComponent(artifactId)}`);
  const metadata = camelize(result.metadata) as { name?: string; description?: string };
  const files: SkillBundleSnapshot["files"] = Array.isArray(result.files)
    ? result.files
        .filter((item: unknown): item is { path: string; content: string } => isBundleFile(item))
        .sort((a: { path: string }, b: { path: string }) => a.path.localeCompare(b.path))
    : [];
  return {
    metadata: {
      name: metadata.name ?? artifactId,
      description: metadata.description ?? "",
    },
    files,
    fileMap: Object.fromEntries(files.map((file) => [file.path, file.content])),
  };
}

export async function updateBackendVariant(input: {
  variantId: string;
  summary?: string;
  label?: string;
  lifecycleStatus?: "active" | "archived";
  view?: AppState["view"];
}): Promise<AppState> {
  await patchJson("/api/variants", {
    variant_id: input.variantId,
    summary: input.summary,
    label: input.label,
    lifecycle_status: input.lifecycleStatus,
  });
  return loadBackendState({
    view: input.view ?? "workbench",
    selectedVariantRef: input.variantId,
  });
}

export async function publishBackendVariantVersion(input: {
  variantId: string;
  skillId?: string;
  changeNote: string;
  contentRef?: ContentRef;
  makeCurrent?: boolean;
  view?: AppState["view"];
}): Promise<AppState> {
  const result = await postJson("/api/variant-versions", {
    variant_id: input.variantId,
    change_note: input.changeNote,
    content_ref: input.contentRef ? snakeize(input.contentRef) : undefined,
    make_current: input.makeCurrent ?? true,
  });
  const versionId = result?.variant_version?.id;
  const overrides: StateOverrides = {
    view: input.view ?? "workbench",
    selectedSkillRef: input.skillId,
    selectedVariantRef: input.variantId,
  };
  if (typeof versionId === "string") overrides.selectedVersionRef = versionId;
  return loadBackendState(overrides);
}

export async function publishBackendSkillBundleVersion(input: {
  variantId: string;
  skillId?: string;
  changeNote: string;
  bundleName: string;
  files: Record<string, string>;
  makeCurrent?: boolean;
  view?: AppState["view"];
}): Promise<AppState> {
  const bundle = await importBackendSkillBundle({ name: input.bundleName, files: input.files });
  return publishBackendVariantVersion({
    variantId: input.variantId,
    skillId: input.skillId,
    changeNote: input.changeNote,
    contentRef: bundle.contentRef,
    makeCurrent: input.makeCurrent,
    view: input.view,
  });
}

export async function recordBackendEvalRun(input: {
  variantVersionId: string;
  evalSetVersionId: string;
  results: Record<string, boolean>;
  skillId?: string;
  selectedVariantId: string;
  view?: AppState["view"];
}): Promise<AppState> {
  await postJson("/api/eval-runs", {
    variant_version_id: input.variantVersionId,
    eval_set_version_id: input.evalSetVersionId,
    results: input.results,
  });
  return loadBackendState({
    view: input.view ?? "workbench",
    selectedSkillRef: input.skillId,
    selectedVariantRef: input.selectedVariantId,
    selectedVersionRef: input.variantVersionId,
    evalSetVersionRef: input.evalSetVersionId,
  });
}

export async function resetBackendState(): Promise<AppState> {
  await postJson("/api/reset", {});
  return loadBackendState({ view: "hub" });
}

async function getJson(path: string): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  return response.json();
}

async function postJson(path: string, payload: unknown): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  return response.json();
}

async function patchJson(path: string, payload: unknown): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}`);
  return response.json();
}

function createStateFromData(data: AppData): AppState {
  const fallback = createInitialState();
  const skill = data.skills[0];
  const defaultVariant = skill ? data.variants.find((variant) => variant.id === skill.defaultVariantRef) : undefined;
  const corpus = skill ? data.evalCorpora.find((item) => item.skillRef === skill.id) : undefined;
  const evalSetVersion = corpus
    ? data.evalSetVersions
        .filter((item) => item.corpusRef === corpus.id)
        .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }))
        .at(-1)
    : undefined;

  return {
    view: "hub",
    selectedSkillRef: skill?.id ?? fallback.selectedSkillRef,
    requestedTags: ["codex"],
    evalSetVersionRef: evalSetVersion?.id ?? fallback.evalSetVersionRef,
    selectedVariantRef: defaultVariant?.id ?? fallback.selectedVariantRef,
    selectedVersionRef: defaultVariant?.currentVersionRef ?? fallback.selectedVersionRef,
    data,
  };
}

function resolveSelectionOverrides(data: AppData, overrides: StateOverrides): StateOverrides {
  if (!overrides.selectedSkillRef || overrides.selectedVariantRef) return overrides;

  const skill = data.skills.find((item) => item.id === overrides.selectedSkillRef);
  const variants = data.variants.filter((item) => item.skillRef === skill?.id);
  const defaultVariant = variants.find((item) => item.id === skill?.defaultVariantRef) ?? variants[0];

  if (!defaultVariant) return overrides;

  return {
    ...overrides,
    selectedVariantRef: defaultVariant.id,
    selectedVersionRef: overrides.selectedVersionRef ?? defaultVariant.currentVersionRef,
  };
}

function normalizeStateSelection(state: AppState): AppState {
  const variantFromSelection = state.data.variants.find((item) => item.id === state.selectedVariantRef);
  const skill =
    state.data.skills.find((item) => item.id === state.selectedSkillRef && item.id === variantFromSelection?.skillRef) ??
    state.data.skills.find((item) => item.id === state.selectedSkillRef && !variantFromSelection) ??
    state.data.skills.find((item) => item.id === variantFromSelection?.skillRef) ??
    state.data.skills[0];
  if (!skill) return state;

  const variants = state.data.variants.filter((item) => item.skillRef === skill.id);
  const defaultVariant = variants.find((item) => item.id === skill.defaultVariantRef) ?? variants[0];
  const selectedVariant = variants.find((item) => item.id === state.selectedVariantRef) ?? defaultVariant;
  const selectedVersion =
    state.data.variantVersions.find((item) => item.id === state.selectedVersionRef && item.variantRef === selectedVariant?.id) ??
    state.data.variantVersions.find((item) => item.id === selectedVariant?.currentVersionRef);
  const corpus = state.data.evalCorpora.find((item) => item.skillRef === skill.id);
  const evalSetVersion = corpus
    ? state.data.evalSetVersions
        .filter((item) => item.corpusRef === corpus.id)
        .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }))
        .find((item) => item.id === state.evalSetVersionRef) ??
      state.data.evalSetVersions
        .filter((item) => item.corpusRef === corpus.id)
        .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }))
        .at(-1)
    : undefined;

  return {
    ...state,
    selectedSkillRef: skill.id,
    selectedVariantRef: selectedVariant?.id ?? state.selectedVariantRef,
    selectedVersionRef: selectedVersion?.id ?? state.selectedVersionRef,
    evalSetVersionRef: evalSetVersion?.id ?? state.evalSetVersionRef,
  };
}

function normalizeAppData(data: Partial<AppData>): AppData {
  const projectedEvalCases = projectEvalCaseVersions(data);
  return {
    skills: data.skills ?? [],
    tagSets: data.tagSets ?? [],
    variants: data.variants ?? [],
    variantVersions: data.variantVersions ?? [],
    evalCorpora: data.evalCorpora ?? [],
    evalCases: projectedEvalCases.length > 0 ? projectedEvalCases : data.evalCases ?? [],
    evalCaseVersions: data.evalCaseVersions ?? [],
    evalSetVersions: (data.evalSetVersions ?? []).map((version) => ({
      ...version,
      caseRefs: version.caseVersionRefs ?? version.caseRefs ?? [],
    })),
    evalRuns: data.evalRuns ?? [],
    caseResults: (data.caseResults ?? []).map((result) => ({
      ...result,
      caseRef: result.caseVersionRef ?? result.caseRef,
    })),
    sourceFeedback: data.sourceFeedback ?? [],
    artifacts: data.artifacts ?? [],
  };
}

function projectEvalCaseVersions(data: Partial<AppData>): EvalCase[] {
  const stableCases = data.evalCases ?? [];
  const caseVersions = data.evalCaseVersions ?? [];
  if (caseVersions.length === 0) return [];
  return caseVersions.map((version) => {
    const stableCase = stableCases.find((item) => item.id === version.caseRef);
    return {
      id: version.id,
      corpusRef: stableCase?.corpusRef ?? "",
      title: stableCase?.title ?? version.caseRef,
      sourceType: stableCase?.sourceType ?? "manual",
      originRef: stableCase?.originRef,
      currentVersionRef: stableCase?.currentVersionRef,
      caseRef: stableCase?.id ?? version.caseRef,
      caseVersion: version.version,
      inputArtifactRef: version.inputArtifactRef,
      expectationArtifactRef: version.expectationArtifactRef,
      graderRef: version.graderRef,
      expectation: version.expectation,
      createdAt: version.createdAt,
    };
  });
}

function camelize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [toCamelCase(key), camelize(item)]),
  );
}

function toCamelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function snakeize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(snakeize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [toSnakeCase(key), snakeize(item)]),
  );
}

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function isBundleFile(value: unknown): value is { path: string; content: string } {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as { path?: unknown }).path === "string" &&
    typeof (value as { content?: unknown }).content === "string"
  );
}
