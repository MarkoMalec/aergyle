import type { VocationalActionType } from "~/generated/prisma/enums";

/** "WOODCUTTING" → "Woodcutting": the skill page name for an action type. */
export function toSkillNameFromActionType(actionType: string): string {
  return actionType
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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
    GARDENING: "GARDENING",
    GATHERING: "GATHERING",
    HUNTING: "HUNTING",
    ALCHEMY: "ALCHEMY",
    BLACKSMITHING: "BLACKSMITHING",
    WEAPONSMITHING: "WEAPONSMITHING",
    CARPENTRY: "CARPENTRY",
    COOKING: "COOKING",
    TAILORING: "TAILORING",
    FORGE: "FORGE",
  };

  return allowed[normalized] ?? null;
}
