import { getServerSession } from "next-auth";
import { prisma } from "~/lib/prisma";
import { authOptions } from "~/server/auth";
import { getSkillLevels } from "~/server/skills/levels";
import GameNavigation from "./GameNavigation";

export default async function SidebarLeft() {
  const session = await getServerSession(authOptions);
  const [skills, skillLevels] = await Promise.all([
    prisma.skills.findMany({
      select: { skill_name: true, category: true },
      orderBy: [{ skill_name: "asc" }],
    }),
    session?.user?.id ? getSkillLevels(session.user.id) : Promise.resolve({}),
  ]);

  const entries = skills.map((skill) => ({
    name: skill.skill_name,
    category: skill.category,
  }));
  for (const fallback of ["Gardening", "Gathering"]) {
    if (
      !entries.some(({ name }) => name.toLowerCase() === fallback.toLowerCase())
    ) {
      entries.push({ name: fallback, category: "VOCATION" });
    }
  }
  return (
    <GameNavigation skills={entries} initialSkillLevels={skillLevels} />
  );
}
