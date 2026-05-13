"use client";

import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";

import type { DiffFilter } from "@/components/diff/workbench-diff-pane";
import type { HistoryRunFilters } from "@/components/history/workbench-history-pane";
import type { RunMatrixControls } from "@/components/run-matrix/run-matrix-panel";
import type { AuditExplorerFilters } from "@/components/skills/skill-audit-explorer";
import type { WorkbenchMode } from "@/components/workbench-tabs";
import { emptySkillDetail } from "@/lib/empty-state";
import type { SkillSummary } from "@/lib/types";
import {
  parseWorkbenchUrlState,
  type PromotionUrlTarget,
  type WorkbenchUrlState,
  workbenchUrlForState,
} from "@/lib/workbench-url-state";

type WorkbenchUrlStateSyncArgs = {
  auditFilters: AuditExplorerFilters;
  compareBaselineRunId: string | null;
  compareCandidateRunId: string | null;
  diffFilter: DiffFilter;
  diffLeftVersionId: string | null;
  diffRightVersionId: string | null;
  evalTargetVersionId: string | null;
  mode: WorkbenchMode;
  promotionTarget: PromotionUrlTarget | null;
  runFilters: HistoryRunFilters;
  runMatrixControls: RunMatrixControls;
  selectedCaseId: string | null;
  selectedDiffPath: string | null;
  selectedRunId: string | null;
  selectedSkillId: string;
  selectedSkillUrlKey: string;
  setAuditFilters: Dispatch<SetStateAction<AuditExplorerFilters>>;
  setCompareBaselineRunId: Dispatch<SetStateAction<string | null>>;
  setCompareCandidateRunId: Dispatch<SetStateAction<string | null>>;
  setDiffFilter: Dispatch<SetStateAction<DiffFilter>>;
  setDiffLeftVersionId: Dispatch<SetStateAction<string | null>>;
  setDiffRightVersionId: Dispatch<SetStateAction<string | null>>;
  setEvalTargetVersionId: Dispatch<SetStateAction<string | null>>;
  setMode: Dispatch<SetStateAction<WorkbenchMode>>;
  setPromotionTarget: Dispatch<SetStateAction<PromotionUrlTarget | null>>;
  setRunFilters: Dispatch<SetStateAction<HistoryRunFilters>>;
  setRunMatrixControls: Dispatch<SetStateAction<RunMatrixControls>>;
  setSelectedCaseId: Dispatch<SetStateAction<string | null>>;
  setSelectedDiffPath: Dispatch<SetStateAction<string | null>>;
  setSelectedRunId: Dispatch<SetStateAction<string | null>>;
  setSelectedSkillId: Dispatch<SetStateAction<string>>;
  skills: SkillSummary[];
};

export function useWorkbenchUrlStateSync({
  auditFilters,
  compareBaselineRunId,
  compareCandidateRunId,
  diffFilter,
  diffLeftVersionId,
  diffRightVersionId,
  evalTargetVersionId,
  mode,
  promotionTarget,
  runFilters,
  runMatrixControls,
  selectedCaseId,
  selectedDiffPath,
  selectedRunId,
  selectedSkillId,
  selectedSkillUrlKey,
  setAuditFilters,
  setCompareBaselineRunId,
  setCompareCandidateRunId,
  setDiffFilter,
  setDiffLeftVersionId,
  setDiffRightVersionId,
  setEvalTargetVersionId,
  setMode,
  setPromotionTarget,
  setRunFilters,
  setRunMatrixControls,
  setSelectedCaseId,
  setSelectedDiffPath,
  setSelectedRunId,
  setSelectedSkillId,
  skills,
}: WorkbenchUrlStateSyncArgs) {
  const [hasHydratedUrlState, setHasHydratedUrlState] = useState(false);
  const hasSyncedUrlRef = useRef(false);
  const pendingUrlStateRef = useRef<WorkbenchUrlState | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasHydratedUrlState) {
      applyUrlStateFromLocation();
      setHasHydratedUrlState(true);
    }
    function handlePopState() {
      applyUrlStateFromLocation();
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydratedUrlState, skills]);

  useEffect(() => {
    const pending = pendingUrlStateRef.current;
    if (!pending) return;
    pendingUrlStateRef.current = null;
    applyDeepUrlState(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  useEffect(() => {
    if (typeof window === "undefined" || !hasHydratedUrlState) return;
    const nextUrl = workbenchUrlForState({
      hash: window.location.hash,
      pathname: window.location.pathname,
      state: {
        auditFilters,
        compareBaselineRunId,
        compareCandidateRunId,
        diffFilter,
        diffLeftVersionId,
        diffRightVersionId,
        evalTargetVersionId,
        mode,
        promotionTarget,
        runFilters,
        runMatrixControls,
        selectedCaseId,
        selectedDiffPath,
        selectedRunId,
        skill: selectedSkillUrlKey,
      },
    });
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) {
      hasSyncedUrlRef.current = true;
      return;
    }
    const method = hasSyncedUrlRef.current ? "pushState" : "replaceState";
    window.history[method](window.history.state, "", nextUrl);
    hasSyncedUrlRef.current = true;
  }, [
    auditFilters,
    compareBaselineRunId,
    compareCandidateRunId,
    diffFilter,
    diffLeftVersionId,
    diffRightVersionId,
    evalTargetVersionId,
    hasHydratedUrlState,
    mode,
    promotionTarget,
    runFilters,
    runMatrixControls,
    selectedCaseId,
    selectedDiffPath,
    selectedRunId,
    selectedSkillUrlKey,
  ]);

  function applyUrlStateFromLocation() {
    const state = parseWorkbenchUrlState(window.location.search);
    const nextSkill = state.skill
      ? skills.find((summary) => summary.skill.id === state.skill || summary.skill.slug === state.skill)
      : skills[0];
    const nextSkillId = nextSkill?.skill.id ?? emptySkillDetail.skill.id;
    if (nextSkillId === selectedSkillId) {
      pendingUrlStateRef.current = null;
      applyDeepUrlState(state);
    } else {
      pendingUrlStateRef.current = state;
    }
    setSelectedSkillId((current) => (current === nextSkillId ? current : nextSkillId));
  }

  function applyDeepUrlState(state: WorkbenchUrlState) {
    setMode(state.mode);
    setDiffLeftVersionId(state.diffLeftVersionId);
    setDiffRightVersionId(state.diffRightVersionId);
    setSelectedDiffPath(state.selectedDiffPath);
    setDiffFilter(state.diffFilter);
    setRunFilters(state.runFilters);
    setRunMatrixControls(state.runMatrixControls);
    setSelectedRunId(state.selectedRunId);
    setCompareBaselineRunId(state.compareBaselineRunId);
    setCompareCandidateRunId(state.compareCandidateRunId);
    setEvalTargetVersionId(state.evalTargetVersionId);
    setSelectedCaseId(state.selectedCaseId);
    setPromotionTarget(state.promotionTarget);
    setAuditFilters(state.auditFilters);
  }
}
