import { prisma } from "~/lib/prisma";
import GameNavigation from "./GameNavigation";

export default async function SidebarLeft() {
  const skills = await prisma.skills.findMany({
    select: { skill_name: true, category: true },
    orderBy: [{ skill_name: "asc" }],
  });
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
  return <GameNavigation skills={entries} />;
}
