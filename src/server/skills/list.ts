import { prisma } from "~/lib/prisma";
import type { NavigationSkill } from "~/components/game/ui/Sidebars/navigation-links";

/**
 * Every skill in the game, by name. Gardening and Gathering run without a
 * `skills` row, so they are added when the table lacks them.
 */
export async function getGameSkills(): Promise<NavigationSkill[]> {
  const skills = await prisma.skills.findMany({
    select: { skill_name: true, category: true },
    orderBy: [{ skill_name: "asc" }],
  });

  const entries: NavigationSkill[] = skills.map((skill) => ({
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
  return entries;
}
