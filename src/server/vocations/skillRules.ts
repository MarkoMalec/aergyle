import { ItemType } from "~/generated/prisma/enums";
import { type SkillItemRules, sortItemTypes } from "~/game/crafting";
import { prisma } from "~/lib/prisma";

const ITEM_TYPES: ReadonlySet<string> = new Set(Object.values(ItemType));

// A stored value that is no longer an ItemType is dropped, not fatal.
function toItemTypes(value: unknown): ItemType[] {
  if (!Array.isArray(value)) return [];
  return sortItemTypes(
    value.filter(
      (entry): entry is ItemType =>
        typeof entry === "string" && ITEM_TYPES.has(entry),
    ),
  );
}

/** Every skill's admin-set item-type rules; a skill without a row accepts all. */
export async function getSkillItemRules(): Promise<SkillItemRules> {
  const rows = await prisma.vocationalSkillRule.findMany();
  const rules: SkillItemRules = {};
  for (const row of rows) {
    rules[row.actionType] = {
      outputTypes: toItemTypes(row.outputItemTypes),
      inputTypes: toItemTypes(row.inputItemTypes),
    };
  }
  return rules;
}
