"use client";

import { useEffect, useMemo, useState } from "react";

import type { BundleDiff, BundleDiffFile } from "@/lib/types";

export function bundleDiffReviewKey(diff: BundleDiff | null) {
  if (!diff) return "empty";
  return `${diff.left.variant_version_id}:${diff.right.variant_version_id}:${diff.right.content_digest}`;
}

export function useFileReviewProgress(files: BundleDiffFile[], reviewKey: string) {
  const [viewedPaths, setViewedPaths] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setViewedPaths(new Set());
  }, [reviewKey]);

  const viewedCount = useMemo(
    () => files.reduce((count, file) => count + (viewedPaths.has(file.path) ? 1 : 0), 0),
    [files, viewedPaths],
  );

  function isViewed(path: string) {
    return viewedPaths.has(path) && files.some((file) => file.path === path);
  }

  function markViewed(path: string, viewed: boolean) {
    setViewedPaths((current) => {
      const next = new Set(current);
      if (viewed) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  }

  return {
    isViewed,
    markViewed,
    totalCount: files.length,
    viewedCount,
  };
}
