import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { aggregateScore, artifactContent, casesForVersion, percent, resultCounts } from "../domain/scoring";
import type { AppState } from "../domain/types";
import {
  createBackendEvalCaseVersion,
  publishBackendSkillBundleVersion,
  publishBackendVariantVersion,
  recordBackendEvalRun,
} from "../store/backendState";
import { EvalMatrix } from "./EvalMatrix";

export function WorkbenchPage({
  state,
  setState,
}: {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
}) {
  const { data } = state;
  const versions = data.evalSetVersions
    .filter((version) => {
      const corpus = data.evalCorpora.find((item) => item.id === version.corpusRef);
      return corpus?.skillRef === state.selectedSkillRef;
    })
    .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
  const variants = data.variants.filter((item) => item.skillRef === state.selectedSkillRef);
  const variantIds = variants.map((variant) => variant.id).join("|");
  const evalSetVersionIds = versions.map((version) => version.id).join("|");
  const [backendError, setBackendError] = useState("");
  const [evalVariantRef, setEvalVariantRef] = useState(state.selectedVariantRef || variants[0]?.id || "");
  const [evalVariantVersionRef, setEvalVariantVersionRef] = useState(state.selectedVersionRef);
  const [evalSetVersionRef, setEvalSetVersionRef] = useState(state.evalSetVersionRef || versions.at(-1)?.id || "");
  const [manualResults, setManualResults] = useState<Record<string, boolean>>({});
  const [caseVersionForm, setCaseVersionForm] = useState({
    caseRef: "",
    input: "",
    expectedOutput: "",
  });
  const [versionForm, setVersionForm] = useState({
    variantRef: state.selectedVariantRef || variants[0]?.id || "",
    changeNote: "根据最新实验结果更新当前变体版本，简化输出并加强敏感信息检查。",
    makeCurrent: true,
  });
  const [bundleForm, setBundleForm] = useState({
    bundleName: "code-reviewer-bundle",
    skillMd:
      "---\n" +
      "name: code-reviewer\n" +
      "description: Review pull requests for bugs, regressions, security issues, and missing tests.\n" +
      "---\n\n" +
      "# Code Reviewer\n\n" +
      "Review the proposed change and report only findings that can affect correctness, security, or maintainability.\n",
    referencePath: "references/review-checklist.md",
    referenceContent: "- Check authorization filters.\n- Check nullability changes.\n- Check leaked secrets in logs or responses.\n",
  });

  useEffect(() => {
    const fallbackVariant = variants.find((variant) => variant.id === state.selectedVariantRef) ?? variants[0];
    const selectedVariant = variants.find((variant) => variant.id === evalVariantRef) ?? fallbackVariant;
    const selectedVariantVersions = selectedVariant
      ? data.variantVersions
          .filter((version) => version.variantRef === selectedVariant.id)
          .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
      : [];

    if (selectedVariant && selectedVariant.id !== evalVariantRef) {
      setEvalVariantRef(selectedVariant.id);
    }
    if (
      selectedVariant &&
      !selectedVariantVersions.some((version) => version.id === evalVariantVersionRef)
    ) {
      setEvalVariantVersionRef(selectedVariant.currentVersionRef || selectedVariantVersions[0]?.id || "");
    }
    if (!versions.some((version) => version.id === evalSetVersionRef)) {
      setEvalSetVersionRef(versions.find((version) => version.id === state.evalSetVersionRef)?.id ?? versions.at(-1)?.id ?? "");
    }
    if (!variants.some((variant) => variant.id === versionForm.variantRef)) {
      setVersionForm((prev) => ({ ...prev, variantRef: fallbackVariant?.id ?? "" }));
    }
  }, [
    data.variantVersions,
    evalSetVersionIds,
    evalSetVersionRef,
    evalVariantRef,
    evalVariantVersionRef,
    state.evalSetVersionRef,
    state.selectedVariantRef,
    variantIds,
    versionForm.variantRef,
  ]);

  const selectedVariant = variants.find((item) => item.id === evalVariantRef) ?? variants[0];
  const selectedVariantVersions = selectedVariant
    ? data.variantVersions
        .filter((version) => version.variantRef === selectedVariant.id)
        .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
    : [];
  const selectedVariantVersion =
    selectedVariantVersions.find((version) => version.id === evalVariantVersionRef) ??
    selectedVariantVersions.find((version) => version.id === selectedVariant?.currentVersionRef) ??
    selectedVariantVersions[0];
  const version = versions.find((item) => item.id === evalSetVersionRef) ?? versions.at(-1);
  const cases = version ? casesForVersion(data, version) : [];
  const selectedScore = selectedVariantVersion && version ? aggregateScore(data, selectedVariantVersion.id, version.id) : null;
  const selectedCounts =
    selectedVariantVersion && version
      ? resultCounts(data, selectedVariantVersion.id, version.id)
      : { passed: 0, failed: 0, missing: 0 };
  const resultState = useMemo(() => {
    const defaults = Object.fromEntries(cases.map((item) => [item.id, manualResults[item.id] ?? true]));
    return defaults as Record<string, boolean>;
  }, [cases, manualResults]);
  const selectedCase = cases.find((item) => item.id === caseVersionForm.caseRef) ?? cases[0];

  useEffect(() => {
    if (!selectedCase) return;
    if (caseVersionForm.caseRef && cases.some((item) => item.id === caseVersionForm.caseRef)) return;
    setCaseVersionForm({
      caseRef: selectedCase.id,
      input: artifactContent(data, selectedCase.inputArtifactRef),
      expectedOutput: artifactContent(data, selectedCase.expectationArtifactRef),
    });
  }, [caseVersionForm.caseRef, cases, data, selectedCase]);

  if (!version) return null;

  const runApiAction = (action: Promise<AppState>) => {
    setBackendError("");
    action.then(setState).catch((error) => {
      setBackendError(error instanceof Error ? error.message : "后端写入失败");
    });
  };

  return (
    <div className="workbench">
      {backendError && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>后端写入失败</h2>
              <p>{backendError}</p>
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>手工测评</h2>
            <p>选择被测变体、被测版本和测评集版本，再对每条用例手动确认通过或不通过。</p>
          </div>
          <button
            className="primary-button"
            type="button"
            disabled={!selectedVariant || !selectedVariantVersion}
            onClick={() => {
              if (!selectedVariant || !selectedVariantVersion) return;
              runApiAction(
                recordBackendEvalRun({
                  variantVersionId: selectedVariantVersion.id,
                  evalSetVersionId: version.id,
                  results: resultState,
                  skillId: state.selectedSkillRef,
                  selectedVariantId: selectedVariant.id,
                  view: "workbench",
                }),
              );
            }}
          >
            保存 EvalRun
          </button>
        </div>
        <div className="manual-eval-toolbar">
          <label className="field-block compact">
            <span>被测变体</span>
            <select
              value={selectedVariant?.id ?? ""}
              onChange={(event) => {
                const nextVariant = variants.find((variant) => variant.id === event.target.value);
                setEvalVariantRef(event.target.value);
                setEvalVariantVersionRef(nextVariant?.currentVersionRef ?? "");
              }}
            >
              {variants.map((variant) => (
                <option value={variant.id} key={variant.id}>
                  {variant.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-block compact">
            <span>被测版本</span>
            <select
              value={selectedVariantVersion?.id ?? ""}
              onChange={(event) => setEvalVariantVersionRef(event.target.value)}
            >
              {selectedVariantVersions.map((variantVersion) => (
                <option value={variantVersion.id} key={variantVersion.id}>
                  {variantVersion.version}
                  {variantVersion.id === selectedVariant?.currentVersionRef ? " · current" : " · history"}
                </option>
              ))}
            </select>
          </label>
          <label className="field-block compact">
            <span>测评集版本</span>
            <select value={version.id} onChange={(event) => setEvalSetVersionRef(event.target.value)}>
              {versions.map((evalSetVersion) => (
                <option value={evalSetVersion.id} key={evalSetVersion.id}>
                  {evalSetVersion.version} · {evalSetVersion.caseRefs.length} cases
                </option>
              ))}
            </select>
          </label>
          <div className="metric">
            <div className="metric-label">本次绑定</div>
            <div className="metric-value">{selectedVariantVersion?.version ?? "无"} / {version.version}</div>
            <div className="metric-note">{cases.length} 个用例</div>
          </div>
          <div className="metric">
            <div className="metric-label">本次选择结果</div>
            <div className="metric-value">{percent(selectedScore)}</div>
            <div className="metric-note">
              {selectedCounts.passed} 通过 / {selectedCounts.failed} 不通过 / {selectedCounts.missing} 未测
            </div>
          </div>
        </div>
        <div className="manual-case-list">
          {cases.map((item) => (
            <label className="manual-case-row" key={item.id}>
              <span>
                <strong>{item.title}</strong>
                <em>{item.expectation}</em>
              </span>
              <input
                type="checkbox"
                checked={resultState[item.id]}
                onChange={(event) => setManualResults({ ...resultState, [item.id]: event.target.checked })}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>修订测试用例</h2>
            <p>给已有 EvalCase 创建新的不可变版本，并生成新的 EvalSetVersion。旧测评结果仍绑定旧用例版本。</p>
          </div>
          <button
            className="primary-button"
            type="button"
            disabled={!selectedCase}
            onClick={() => {
              if (!selectedCase) return;
              runApiAction(
                createBackendEvalCaseVersion({
                  caseId: selectedCase.caseRef ?? selectedCase.id,
                  input: caseVersionForm.input,
                  expectedOutput: caseVersionForm.expectedOutput,
                  skillId: state.selectedSkillRef,
                  evalSetVersionRef: version.id,
                  view: "workbench",
                }),
              );
            }}
          >
            发布 case version
          </button>
        </div>
        <div className="form-grid">
          <label className="field-block">
            <span>EvalCase</span>
            <select
              value={selectedCase?.id ?? ""}
              onChange={(event) => {
                const nextCase = cases.find((item) => item.id === event.target.value);
                if (!nextCase) return;
                setCaseVersionForm({
                  caseRef: nextCase.id,
                  input: artifactContent(data, nextCase.inputArtifactRef),
                  expectedOutput: artifactContent(data, nextCase.expectationArtifactRef),
                });
              }}
            >
              {cases.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field-block wide">
            <span>Input</span>
            <textarea value={caseVersionForm.input} onChange={(event) => setCaseVersionForm({ ...caseVersionForm, input: event.target.value })} />
          </label>
          <label className="field-block wide">
            <span>Expected output</span>
            <textarea
              value={caseVersionForm.expectedOutput}
              onChange={(event) => setCaseVersionForm({ ...caseVersionForm, expectedOutput: event.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>发布新版本</h2>
            <p>同一个 Variant 维护线性历史。新版本可以先测评，再决定是否移动 current version。</p>
          </div>
          <div className="topbar-actions">
            <button
              className="ghost-button"
              type="button"
              disabled={!versionForm.variantRef}
              onClick={() =>
                runApiAction(
                  publishBackendVariantVersion({
                    variantId: versionForm.variantRef,
                    skillId: state.selectedSkillRef,
                    changeNote: versionForm.changeNote,
                    makeCurrent: versionForm.makeCurrent,
                    view: "workbench",
                  }),
                )
              }
            >
              发布 mock 版本
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={!versionForm.variantRef}
              onClick={() => {
                const files: Record<string, string> = { "SKILL.md": bundleForm.skillMd };
                const referencePath = bundleForm.referencePath.trim();
                if (referencePath && bundleForm.referenceContent.trim()) {
                  files[referencePath] = bundleForm.referenceContent;
                }
                runApiAction(
                  publishBackendSkillBundleVersion({
                    variantId: versionForm.variantRef,
                    skillId: state.selectedSkillRef,
                    changeNote: versionForm.changeNote,
                    bundleName: bundleForm.bundleName,
                    files,
                    makeCurrent: versionForm.makeCurrent,
                    view: "workbench",
                  }),
                );
              }}
            >
              导入 bundle 并发布
            </button>
          </div>
        </div>
        <div className="form-grid">
          <label className="field-block">
            <span>Variant</span>
            <select
              value={versionForm.variantRef}
              onChange={(event) => setVersionForm({ ...versionForm, variantRef: event.target.value })}
            >
              {variants.map((variant) => (
                <option value={variant.id} key={variant.id}>
                  {variant.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-block wide">
            <span>版本变更说明</span>
            <textarea
              value={versionForm.changeNote}
              onChange={(event) => setVersionForm({ ...versionForm, changeNote: event.target.value })}
            />
          </label>
          <label className="manual-case-row">
            <span>
              <strong>设为 current version</strong>
              <em>关闭后只创建可测评的新版本，不改变默认分发指针。</em>
            </span>
            <input
              type="checkbox"
              checked={versionForm.makeCurrent}
              onChange={(event) => setVersionForm({ ...versionForm, makeCurrent: event.target.checked })}
            />
          </label>
          <label className="field-block">
            <span>Bundle 名称</span>
            <input
              value={bundleForm.bundleName}
              onChange={(event) => setBundleForm({ ...bundleForm, bundleName: event.target.value })}
            />
          </label>
          <label className="field-block">
            <span>附加文件路径</span>
            <input
              value={bundleForm.referencePath}
              onChange={(event) => setBundleForm({ ...bundleForm, referencePath: event.target.value })}
            />
          </label>
          <label className="field-block wide">
            <span>SKILL.md</span>
            <textarea value={bundleForm.skillMd} onChange={(event) => setBundleForm({ ...bundleForm, skillMd: event.target.value })} />
          </label>
          <label className="field-block wide">
            <span>附加文件内容</span>
            <textarea
              value={bundleForm.referenceContent}
              onChange={(event) => setBundleForm({ ...bundleForm, referenceContent: event.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>当前版本矩阵</h2>
            <p>所有当前发布变体对所选 EvalSetVersion 的通过情况。升级有没有价值，看这里的指标变化。</p>
          </div>
        </div>
        <EvalMatrix data={data} variants={variants} version={version} />
      </section>
    </div>
  );
}
