"use client";

import { useMemo, useState } from "react";

import { bundleDiffReviewKey, useFileReviewProgress } from "@/components/diff/use-file-review-progress";
import type { BundleDiff, BundleDiffFile, BundleDiffStatus } from "@/lib/types";

type DiffFilter = "all" | BundleDiffStatus | "binary";

export function PromotionDiffViewer({ diff }: { diff: BundleDiff | null }) {
  const [filter, setFilter] = useState<DiffFilter>("all");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const allFiles = diff?.files ?? [];
  const reviewProgress = useFileReviewProgress(allFiles, bundleDiffReviewKey(diff));
  const filteredFiles = useMemo(() => filterFiles(allFiles, filter), [allFiles, filter]);
  const selectedFile = filteredFiles.find((file) => file.path === selectedPath) ?? filteredFiles[0] ?? null;

  if (!diff) {
    return (
      <section className="promotionDiffPanel">
        <div className="promotionPanelHead">
          <div>
            <span>Bundle diff</span>
            <strong>没有可审查的文件差异</strong>
          </div>
        </div>
        <div className="promotionDiffEmpty">候选版本缺少标准 Skill bundle 文件快照，或当前版本没有可对比内容。</div>
      </section>
    );
  }

  return (
    <section className="promotionDiffPanel">
      <div className="promotionPanelHead">
        <div>
          <span>Bundle diff</span>
          <strong>v{diff.left.version_number} {"->"} v{diff.right.version_number}</strong>
        </div>
        <div className="promotionDiffStats">
          <span className="promotionReviewedStat">{reviewProgress.viewedCount}/{reviewProgress.totalCount} reviewed</span>
          <span>+{diff.summary.added}</span>
          <span>~{diff.summary.changed}</span>
          <span>-{diff.summary.removed}</span>
        </div>
      </div>

      <div className="promotionDiffFilters" aria-label="Promotion diff filters">
        {[
          ["all", "全部"],
          ["changed", "修改"],
          ["added", "新增"],
          ["removed", "删除"],
          ["binary", "二进制"],
        ].map(([value, label]) => (
          <button
            className={filter === value ? "promotionDiffFilterActive" : ""}
            key={value}
            onClick={() => setFilter(value as DiffFilter)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="promotionDiffGrid">
        <aside className="promotionDiffFiles" aria-label="Promotion changed files">
          {filteredFiles.map((file) => (
            <button
              className={`promotionDiffFile ${selectedFile?.path === file.path ? "promotionDiffFileActive" : ""}`}
              key={file.path}
              onClick={() => setSelectedPath(file.path)}
              type="button"
            >
              <span>{file.path}</span>
              <small>{file.binary ? "binary" : file.status} · {reviewProgress.isViewed(file.path) ? "已查看" : "未看"}</small>
            </button>
          ))}
          {filteredFiles.length === 0 ? <div className="promotionDiffEmpty">这个筛选下没有文件变化。</div> : null}
        </aside>
        <div className="promotionDiffCodePanel">
          {selectedFile ? (
            <>
              <label className="promotionViewedControl">
                <input
                  aria-label="已查看此 promotion diff 文件"
                  checked={reviewProgress.isViewed(selectedFile.path)}
                  onChange={(event) => reviewProgress.markViewed(selectedFile.path, event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>已查看此文件</span>
              </label>
              <DiffFile file={selectedFile} />
            </>
          ) : (
            <div className="promotionDiffEmpty">选择文件查看行级变化。</div>
          )}
        </div>
      </div>
    </section>
  );
}

function DiffFile({ file }: { file: BundleDiffFile }) {
  if (file.binary) {
    return <div className="promotionDiffEmpty">二进制文件不展示文本 diff；仍保留 digest 和大小用于审查。</div>;
  }
  return (
    <div className="promotionDiffCode">
      {(file.hunks ?? []).flatMap((hunk, hunkIndex) =>
        hunk.lines.map((line, lineIndex) => (
          <div className={`promotionDiffLine promotionDiffLine-${line.kind}`} key={`${hunkIndex}-${lineIndex}`}>
            <span>{line.old_line ?? ""}</span>
            <span>{line.new_line ?? ""}</span>
            <code>{linePrefix(line.kind)}{line.text || " "}</code>
          </div>
        )),
      )}
      {(file.hunks ?? []).length === 0 ? <div className="promotionDiffEmpty">没有可展示的文本变化。</div> : null}
    </div>
  );
}

function filterFiles(files: BundleDiffFile[], filter: DiffFilter) {
  if (filter === "all") return files;
  if (filter === "binary") return files.filter((file) => file.binary);
  return files.filter((file) => file.status === filter);
}

function linePrefix(kind: "context" | "added" | "removed") {
  if (kind === "added") return "+ ";
  if (kind === "removed") return "- ";
  return "  ";
}
