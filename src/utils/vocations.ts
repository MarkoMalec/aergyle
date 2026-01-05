import type { VocationalActionType } from "~/generated/prisma/enums";

export function toVocationalActionTypeFromSkillName(
  skillName: string,
): VocationalActionType | null {
  const normalized = decodeURIComponent(skillName)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  const allowed: Record<string, VocationalActionType> = {
    WOODCUTTING: "WOODCUTTING",
    MINING: "MINING",
    FISHING: "FISHING",
    GATHERING: "GATHERING",
    ALCHEMY: "ALCHEMY",
    SMELTING: "SMELTING",
    COOKING: "COOKING",
    FORGE: "FORGE",
  };

  return allowed[normalized] ?? null;
}
