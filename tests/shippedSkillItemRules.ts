import { readFileSync } from "node:fs";
import type {
  ItemType,
  VocationalActionType,
} from "../src/generated/prisma/enums";
import {
  getResourceSkillConflict,
  type SkillItemRules,
} from "../src/game/crafting";

// The item-type rules every skill ships with are the rows the migration
// inserts; admins change them on /admin/vocations/rules afterwards. Read from
// the SQL so the seed-content tests check against the one real default.
const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260924180000_vocational_skill_rules/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

export const SHIPPED_SKILL_ITEM_RULES: SkillItemRules = {};
for (const [, actionType, outputs, inputs] of migration.matchAll(
  /\('(\w+)',\s*'(\[[^']*\])',\s*'(\[[^']*\])',/g,
)) {
  SHIPPED_SKILL_ITEM_RULES[actionType as VocationalActionType] = {
    outputTypes: JSON.parse(outputs!) as ItemType[],
    inputTypes: JSON.parse(inputs!) as ItemType[],
  };
}

/** Why the shipped rules would refuse this craft, or null when they accept it. */
export function shippedCraftConflict(params: {
  actionType: VocationalActionType;
  outputType: ItemType | null | undefined;
  inputTypes: ReadonlyArray<ItemType | null | undefined>;
}) {
  return getResourceSkillConflict({
    actionType: params.actionType,
    outputType: params.outputType,
    requirementTypes: params.inputTypes,
    hasRecipeGate: false,
    itemRules: SHIPPED_SKILL_ITEM_RULES,
  });
}
