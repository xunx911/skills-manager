import { DecisionWorkbench } from "@/components/decision-workbench";
import { getSkillDetail, listSkills } from "@/lib/api";

export default async function SkillsPage() {
  const skills = await listSkills();
  const defaultSkillId = skills[0]?.skill.id ?? "skill-code-reviewer";
  const featuredSkill = await getSkillDetail(defaultSkillId);

  return <DecisionWorkbench featuredSkill={featuredSkill} skills={skills} />;
}
