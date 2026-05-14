export type QuickEvalCaseDraft = {
  title: string;
  input_text: string;
  expected_output: string;
  notes?: string;
};
export type BatchCaseRowError = {
  lineNumber: number;
  message: string;
};

export type BatchCaseParseResult = {
  valid: QuickEvalCaseDraft[];
  invalidRows: BatchCaseRowError[];
  invalidCount: number;
};

const FIELD_LABELS = {
  title: "标题",
  input_text: "Input",
  expected_output: "Expected output",
};

export function parseBatchCases(text: string): BatchCaseParseResult {
  const valid: QuickEvalCaseDraft[] = [];
  const invalidRows: BatchCaseRowError[] = [];

  text.split(/\r?\n/).forEach((line, index) => {
    const row = line.trim();
    if (!row) return;

    const separator = row.includes("\t") ? "\t" : "|";
    const [title, inputText, expectedOutput, notes] = row.split(separator).map((part) => part.trim());
    const missing = missingFields({ title, input_text: inputText, expected_output: expectedOutput });

    if (missing.length > 0) {
      invalidRows.push({ lineNumber: index + 1, message: rowErrorMessage(index + 1, missing) });
      return;
    }

    valid.push({
      title,
      input_text: inputText,
      expected_output: expectedOutput,
      notes: notes || undefined,
    });
  });

  return { valid, invalidRows, invalidCount: invalidRows.length };
}

export function batchCaseErrorMessage(invalidRows: BatchCaseRowError[]) {
  const visibleRows = invalidRows.slice(0, 3).map((row) => row.message).join(" ");
  const hiddenCount = invalidRows.length - 3;
  return hiddenCount > 0 ? `${visibleRows} 还有 ${hiddenCount} 行需要修正。` : visibleRows;
}

function missingFields(fields: Record<keyof typeof FIELD_LABELS, string | undefined>) {
  return Object.entries(fields)
    .filter(([, value]) => !value)
    .map(([field]) => FIELD_LABELS[field as keyof typeof FIELD_LABELS]);
}

function rowErrorMessage(lineNumber: number, missing: string[]) {
  const fieldList = missing.length === 1 ? missing[0] : missing.join("、");
  const separator = /^[A-Za-z]/.test(fieldList) ? " " : "";
  return `第 ${lineNumber} 行缺少${separator}${fieldList}。`;
}
