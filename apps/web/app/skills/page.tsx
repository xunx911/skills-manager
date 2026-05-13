import { DecisionWorkbench } from "@/components/decision-workbench";
import type { WorkbenchMode } from "@/components/workbench-tabs";
import { getSkillDetail, listSkills } from "@/lib/api";
import { emptySkillDetail } from "@/lib/empty-state";

type SkillsSearchParams = Promise<Record<string, string | string[] | undefined>>;

const SHAREABLE_MODES: WorkbenchMode[] = ["overview", "variants", "evals", "diff", "history", "audit"];

export default async function SkillsPage({ searchParams }: { searchParams?: SkillsSearchParams }) {
  const skills = await listSkills();
  const query = searchParams ? await searchParams : {};
  const requestedSkill = singleValue(query.skill);
  const selectedSummary =
    skills.find((summary) => summary.skill.id === requestedSkill || summary.skill.slug === requestedSkill) ?? skills[0];
  const featuredSkill = selectedSummary ? await getSkillDetail(selectedSummary.skill.id) : emptySkillDetail;
  const initialMode = parseShareableMode(singleValue(query.mode));

  return (
    <DecisionWorkbench
      featuredSkill={featuredSkill}
      initialMode={initialMode}
      initialSkillId={selectedSummary?.skill.id}
      skills={skills}
    />
  );
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseShareableMode(value: string | undefined): WorkbenchMode {
  return SHAREABLE_MODES.includes(value as WorkbenchMode) ? (value as WorkbenchMode) : "overview";
}
