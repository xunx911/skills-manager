import { DecisionWorkbench } from "@/components/decision-workbench";
import { getSkillDetail, listSkills } from "@/lib/api";
import { emptySkillDetail } from "@/lib/empty-state";
import { parseWorkbenchUrlState } from "@/lib/workbench-url-state";

type SkillsSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SkillsPage({ searchParams }: { searchParams?: SkillsSearchParams }) {
  const skills = await listSkills();
  const query = searchParams ? await searchParams : {};
  const urlState = parseWorkbenchUrlState(searchParamsToString(query));
  const requestedSkill = urlState.skill;
  const selectedSummary =
    skills.find((summary) => summary.skill.id === requestedSkill || summary.skill.slug === requestedSkill) ?? skills[0];
  const featuredSkill = selectedSummary ? await getSkillDetail(selectedSummary.skill.id) : emptySkillDetail;

  return (
    <DecisionWorkbench
      featuredSkill={featuredSkill}
      initialMode={urlState.mode}
      initialSkillId={selectedSummary?.skill.id}
      skills={skills}
    />
  );
}

function searchParamsToString(query: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  return params.toString();
}
