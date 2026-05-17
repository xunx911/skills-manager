import { describe, expect, it } from "vitest";

import type { EvalRunMatrix } from "@/lib/types";

import { buildRunMatrixCsv, type RunMatrixCsvRow } from "./run-matrix-export";

const matrix = {
  skill: {
    id: "skill-1",
    slug: "code-reviewer",
    owner_ref: "user:demo",
    default_variant_id: "variant-a",
    lifecycle_status: "active",
  },
  runs: [
    {
      eval_run: {
        id: "run-baseline",
        skill_id: "skill-1",
        variant_version_id: "version-a",
        eval_set_version_id: "eval-set-v3",
        strategy: "manual_pass_fail",
        status: "completed",
        summary: { failed: 1, passed: 1, total: 2 },
        result_artifact_id: null,
        created_by: "user:demo",
      },
      variant: {
        id: "variant-a",
        skill_id: "skill-1",
        name: "baseline",
        label: "Baseline",
        summary: "Baseline reviewer",
        tag_set_id: "tag-a",
        current_version_id: "version-a",
        lifecycle_status: "active",
        tags: ["codex"],
      },
      variant_version: {
        id: "version-a",
        skill_id: "skill-1",
        variant_id: "variant-a",
        version_number: 1,
        content_ref: { kind: "bundle", locator: "artifact:a", digest: "sha256:a" },
        content_digest: "sha256:a",
        change_summary: "Baseline",
        created_by: "user:demo",
      },
      eval_set: {
        id: "eval-set-1",
        skill_id: "skill-1",
        name: "Regression set",
        description: "Regression coverage",
        current_version_id: "eval-set-v3",
        lifecycle_status: "active",
      },
      eval_set_version: {
        id: "eval-set-v3",
        skill_id: "skill-1",
        eval_set_id: "eval-set-1",
        version_number: 3,
        created_by: "user:demo",
      },
    },
    {
      eval_run: {
        id: "run-candidate",
        skill_id: "skill-1",
        variant_version_id: "version-b",
        eval_set_version_id: "eval-set-v3",
        strategy: "manual_pass_fail",
        status: "completed",
        summary: { failed: 0, passed: 2, total: 2 },
        result_artifact_id: null,
        created_by: "user:demo",
      },
      variant: {
        id: "variant-a",
        skill_id: "skill-1",
        name: "baseline",
        label: "Candidate",
        summary: "Candidate reviewer",
        tag_set_id: "tag-a",
        current_version_id: "version-b",
        lifecycle_status: "active",
        tags: ["codex"],
      },
      variant_version: {
        id: "version-b",
        skill_id: "skill-1",
        variant_id: "variant-a",
        version_number: 2,
        content_ref: { kind: "bundle", locator: "artifact:b", digest: "sha256:b" },
        content_digest: "sha256:b",
        change_summary: "Candidate",
        created_by: "user:demo",
      },
      eval_set: {
        id: "eval-set-1",
        skill_id: "skill-1",
        name: "Regression set",
        description: "Regression coverage",
        current_version_id: "eval-set-v3",
        lifecycle_status: "active",
      },
      eval_set_version: {
        id: "eval-set-v3",
        skill_id: "skill-1",
        eval_set_id: "eval-set-1",
        version_number: 3,
        created_by: "user:demo",
      },
    },
  ],
  cases: [
    {
      case: {
        id: "case-1",
        skill_id: "skill-1",
        title: "PR: comma, \"quote\" leak",
        current_version_id: "case-1-v2",
        lifecycle_status: "active",
      },
      versions: [
        { case_version_id: "case-1-v1", version_number: 1 },
        { case_version_id: "case-1-v2", version_number: 2 },
      ],
    },
    {
      case: {
        id: "case-2",
        skill_id: "skill-1",
        title: "PR: missing new case",
        current_version_id: "case-2-v1",
        lifecycle_status: "active",
      },
      versions: [{ case_version_id: "case-2-v1", version_number: 1 }],
    },
  ],
  cells: [
    {
      run_id: "run-baseline",
      case_id: "case-1",
      case_version_id: "case-1-v2",
      passed: false,
      score: 0,
    },
    {
      run_id: "run-candidate",
      case_id: "case-1",
      case_version_id: "case-1-v2",
      passed: true,
      score: 1,
    },
    {
      run_id: "run-candidate",
      case_id: "case-2",
      case_version_id: "case-2-v1",
      passed: true,
      score: 1,
    },
  ],
} satisfies EvalRunMatrix;

const rows: RunMatrixCsvRow[] = [
  { impact: "fixed", row: matrix.cases[0] },
  { impact: "missing", row: matrix.cases[1] },
];

describe("buildRunMatrixCsv", () => {
  it("exports visible matrix rows with escaped values and missing cells", () => {
    const csv = buildRunMatrixCsv({
      cells: matrix.cells,
      rows,
      runs: matrix.runs,
      showImpact: true,
    });

    expect(csv).toBe([
      "Case,Versions,Impact,Baseline v1 / Regression set v3,Candidate v2 / Regression set v3",
      "\"PR: comma, \"\"quote\"\" leak\",\"v1, v2\",修复,不通过,通过",
      "PR: missing new case,v1,缺失,未覆盖,通过",
    ].join("\n"));
  });

  it("omits the Impact column when the current view hides it", () => {
    const csv = buildRunMatrixCsv({
      cells: matrix.cells,
      rows,
      runs: matrix.runs,
      showImpact: false,
    });

    expect(csv.split("\n")[0]).toBe("Case,Versions,Baseline v1 / Regression set v3,Candidate v2 / Regression set v3");
    expect(csv).not.toContain("Impact");
    expect(csv).not.toContain("修复");
  });
});
