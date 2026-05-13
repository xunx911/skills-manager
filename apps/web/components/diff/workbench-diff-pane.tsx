"use client";

import { Metric } from "@/components/workbench-metric";
import { bundleDiffReviewKey, useFileReviewProgress } from "@/components/diff/use-file-review-progress";
import { SelectField } from "@/components/forms/workbench-field";
import { formatBytes } from "@/lib/format";
import type { BundleDiff, BundleDiffFile, BundleDiffStatus, VariantDetail, VariantVersion } from "@/lib/types";

export type DiffFilter = "all" | BundleDiffStatus | "binary";

type WorkbenchDiffPaneProps = {
  diff: BundleDiff | null;
  filter: DiffFilter;
  leftVersionId: string | null;
  loading: boolean;
  onPairChange: (leftVariantVersionId: string, rightVariantVersionId: string) => void;
  onPromotionReview: (variantId: string, candidateVersionId: string) => void;
  onSelectFile: (path: string) => void;
  onSetFilter: (filter: DiffFilter) => void;
  rightVersionId: string | null;
  selectedPath: string | null;
  variant: VariantDetail | null;
};

export function WorkbenchDiffPane({
  diff,
  filter,
  leftVersionId,
  loading,
  onPairChange,
  onPromotionReview,
  onSelectFile,
  onSetFilter,
  rightVersionId,
  selectedPath,
  variant,
}: WorkbenchDiffPaneProps) {
  const versions = sortedVersions(variant?.versions ?? []);
  const rightVersion = versions.find((version) => version.id === rightVersionId) ?? null;
  const canReviewRight = Boolean(variant && rightVersion && rightVersion.id !== variant.current_version?.id);
  const allFiles = diff?.files ?? [];
  const reviewProgress = useFileReviewProgress(allFiles, bundleDiffReviewKey(diff));
  const filteredFiles = filterDiffFiles(allFiles, filter);
  const selectedFile = filteredFiles.find((file) => file.path === selectedPath) ?? filteredFiles[0] ?? null;

  if (!variant || versions.length < 2) {
    return (
      <div className="linearPane diffPane">
        <div className="linearToolbar">
          <div>
            <h2>版本差异</h2>
            <p>至少需要两个不可变 VariantVersion，才能比较标准 Skill bundle 的文件变化。</p>
          </div>
        </div>
        <div className="linearEmpty">当前默认 variant 还没有可比较的历史版本。先从右侧追加一个版本。</div>
      </div>
    );
  }

  return (
    <div className="linearPane diffPane">
      <div className="linearToolbar">
        <div>
          <h2>版本差异</h2>
          <p>{variant.label} · {diff ? `v${diff.left.version_number} -> v${diff.right.version_number}` : "选择两个版本后加载 diff"}</p>
        </div>
        <div className="diffSelectors">
          <SelectField
            label="From"
            onChange={(event) => updatePairFromSelect(event.currentTarget.value, rightVersionId, onPairChange)}
            value={leftVersionId ?? ""}
          >
            {versions.map((version) => (
              <option disabled={version.id === rightVersionId} key={version.id} value={version.id}>
                v{version.version_number}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="To"
            onChange={(event) => updatePairFromSelect(leftVersionId, event.currentTarget.value, onPairChange)}
            value={rightVersionId ?? ""}
          >
            {versions.map((version) => (
              <option disabled={version.id === leftVersionId} key={version.id} value={version.id}>
                v{version.version_number}
              </option>
            ))}
          </SelectField>
          <button
            disabled={!canReviewRight}
            onClick={() => {
              if (variant && rightVersion) onPromotionReview(variant.id, rightVersion.id);
            }}
            type="button"
          >
            设为当前版本评审
          </button>
        </div>
      </div>

      <section className="diffWorkbench" aria-busy={loading}>
        <div className="diffSummary">
          <Metric label="Changed" value={String(diff?.summary.changed ?? 0)} />
          <Metric label="Added" tone="good" value={String(diff?.summary.added ?? 0)} />
          <Metric label="Removed" tone="bad" value={String(diff?.summary.removed ?? 0)} />
          <Metric label="Binary" value={String(diff?.summary.binary ?? 0)} />
          <Metric label="Reviewed" value={`${reviewProgress.viewedCount}/${reviewProgress.totalCount}`} />
        </div>

        <div className="diffFilterBar" aria-label="Diff filters">
          {[
            ["all", "全部"],
            ["changed", "修改"],
            ["added", "新增"],
            ["removed", "删除"],
            ["binary", "二进制"],
          ].map(([value, label]) => (
            <button
              className={filter === value ? "diffFilterActive" : ""}
              key={value}
              onClick={() => onSetFilter(value as DiffFilter)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="diffGrid">
          <aside className="diffFileRail" aria-label="Changed files">
            {loading ? <div className="linearEmpty">正在加载 diff...</div> : null}
            {!loading && filteredFiles.length === 0 ? <div className="linearEmpty">这个筛选下没有文件变化。</div> : null}
            {filteredFiles.map((file) => (
              <button
                className={`diffFileRow ${selectedFile?.path === file.path ? "diffFileRowActive" : ""}`}
                key={file.path}
                onClick={() => onSelectFile(file.path)}
                type="button"
              >
                <span>{file.path}</span>
                <small>{file.binary ? "binary" : file.status} · {reviewProgress.isViewed(file.path) ? "已查看" : "未看"}</small>
              </button>
            ))}
          </aside>

          <section className="diffDetail">
            {selectedFile ? (
              <>
                <div className="diffDetailHead">
                  <div>
                    <span>{selectedFile.status}</span>
                    <strong>{selectedFile.path}</strong>
                  </div>
                  <div className="diffDetailMeta">
                    <small>{diffFileSizeLabel(selectedFile)}</small>
                    <label className="diffViewedControl">
                      <input
                        aria-label="已查看此 diff 文件"
                        checked={reviewProgress.isViewed(selectedFile.path)}
                        onChange={(event) => reviewProgress.markViewed(selectedFile.path, event.currentTarget.checked)}
                        type="checkbox"
                      />
                      <span>已查看此文件</span>
                    </label>
                  </div>
                </div>
                {selectedFile.binary ? (
                  <div className="diffBinaryNotice">二进制文件不展示文本 diff；仍保留 digest 和大小用于审查。</div>
                ) : (
                  <div className="diffCode">
                    {(selectedFile.hunks ?? []).flatMap((hunk, hunkIndex) =>
                      hunk.lines.map((line, lineIndex) => (
                        <div className={`diffLine diffLine-${line.kind}`} key={`${hunkIndex}-${lineIndex}`}>
                          <span>{line.old_line ?? ""}</span>
                          <span>{line.new_line ?? ""}</span>
                          <code>{diffLinePrefix(line.kind)}{line.text || " "}</code>
                        </div>
                      )),
                    )}
                    {(selectedFile.hunks ?? []).length === 0 ? <div className="diffBinaryNotice">没有可展示的文本变化。</div> : null}
                  </div>
                )}
              </>
            ) : (
              <div className="evalCaseDetailEmpty">
                <strong>等待 diff</strong>
                <span>选择两个 bundle 版本后，这里会显示文件级和行级变化。</span>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function sortedVersions(versions: VariantVersion[]) {
  return [...versions].sort((left, right) => left.version_number - right.version_number);
}

function updatePairFromSelect(
  leftVariantVersionId: string | null,
  rightVariantVersionId: string | null,
  onPairChange: (leftVariantVersionId: string, rightVariantVersionId: string) => void,
) {
  if (!leftVariantVersionId || !rightVariantVersionId || leftVariantVersionId === rightVariantVersionId) return;
  onPairChange(leftVariantVersionId, rightVariantVersionId);
}

function filterDiffFiles(files: BundleDiffFile[], filter: DiffFilter) {
  if (filter === "all") return files;
  if (filter === "binary") return files.filter((file) => file.binary);
  return files.filter((file) => file.status === filter);
}

function diffLinePrefix(kind: "context" | "added" | "removed") {
  if (kind === "added") return "+ ";
  if (kind === "removed") return "- ";
  return "  ";
}

function diffFileSizeLabel(file: BundleDiffFile) {
  const left = typeof file.left_size_bytes === "number" ? formatBytes(file.left_size_bytes) : "missing";
  const right = typeof file.right_size_bytes === "number" ? formatBytes(file.right_size_bytes) : "missing";
  return `${left} -> ${right}`;
}
