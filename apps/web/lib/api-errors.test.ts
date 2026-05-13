import { describe, expect, it } from "vitest";

import { apiErrorFromResponse, isApiError } from "./api-errors";

describe("apiErrorFromResponse", () => {
  it("preserves detail and field_errors from API failures", async () => {
    const error = await apiErrorFromResponse(
      new Response(
        JSON.stringify({
          detail: "Skill ID 已存在：code-reviewer",
          field_errors: [{ field: "slug", message: "Skill ID 已存在：code-reviewer", code: "skill.slug_conflict" }],
        }),
        { status: 400, statusText: "Bad Request" },
      ),
    );

    expect(isApiError(error)).toBe(true);
    expect(error.message).toBe("Skill ID 已存在：code-reviewer");
    expect(error.status).toBe(400);
    expect(error.fieldErrors).toEqual([
      { field: "slug", message: "Skill ID 已存在：code-reviewer", code: "skill.slug_conflict" },
    ]);
  });
});
