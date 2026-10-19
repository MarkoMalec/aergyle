import { listPublicArt } from "~/server/publicAssets";

export type SkillArt = {
  /** Painted icon from public/assets/skills/icons, when one exists. */
  icon: string | null;
  /** The skill page's banner art, when one exists. */
  banner: string | null;
};

/**
 * Finds each skill's art among the files in public/, named after the skill
 * ("Woodcutting" → woodcutting.webp, woodcutting-header.webp).
 */
export async function loadSkillArt(): Promise<(skillName: string) => SkillArt> {
  const [icons, banners] = await Promise.all([
    listPublicArt("assets/skills/icons"),
    listPublicArt("assets/skills"),
  ]);
  return (skillName) => {
    const slug = skillName.trim().toLowerCase().replace(/\s+/g, "-");
    return {
      icon: icons.includes(slug) ? `/assets/skills/icons/${slug}.webp` : null,
      banner: banners.includes(`${slug}-header`)
        ? `/assets/skills/${slug}-header.webp`
        : null,
    };
  };
}
