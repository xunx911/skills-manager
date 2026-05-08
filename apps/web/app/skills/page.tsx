import { DecisionWorkbench } from "@/components/decision-workbench";
import { getSkillDetail, listSkills } from "@/lib/api";
import { emptySkillDetail } from "@/lib/empty-state";

export default async function SkillsPage() {
  const skills = await listSkills();
  const featuredSkill = skills[0] ? await getSkillDetail(skills[0].skill.id) : emptySkillDetail;

  return <DecisionWorkbench featuredSkill={featuredSkill} skills={skills} />;
}
