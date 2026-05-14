import { describe, expect, test } from "vitest";

import { batchCaseErrorMessage, parseBatchCases } from "./quick-add-cases-parser";

describe("parseBatchCases", () => {
  test("returns row-level errors for invalid pasted cases", () => {
    const parsed = parseBatchCases(
      [
        "PR: missing tenant scope | Project.all() | Flag missing tenant scope.",
        "PR: token logging | console.log(token)",
        " | query | expected",
      ].join("\n"),
    );

    expect(parsed.valid).toHaveLength(1);
    expect(parsed.invalidRows).toEqual([
      { lineNumber: 2, message: "第 2 行缺少 Expected output。" },
      { lineNumber: 3, message: "第 3 行缺少标题。" },
    ]);
    expect(batchCaseErrorMessage(parsed.invalidRows)).toBe("第 2 行缺少 Expected output。 第 3 行缺少标题。");
  });
});
