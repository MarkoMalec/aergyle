import { isVocationSkill, type BalanceContent, type Track } from "./content";

export type UnlockKind = "Location" | "Dungeon" | "Quest" | "Item" | "Resource" | "Expedition" | "Area";

/** One level-gated piece of content: what a player gets on reaching `level`. */
export type Unlock = {
  track: Track;
  level: number;
  kind: UnlockKind;
  name: string;
  href: string;
};

/** Every level gate in the content, for the character and for each skill. */
export function contentUnlocks(content: BalanceContent): Unlock[] {
  const unlocks: Unlock[] = [];
  const add = (unlock: Unlock) => unlocks.push(unlock);

  for (const location of content.locations) {
    add({ track: "CHARACTER", level: location.requiredLevel, kind: "Location", name: location.name, href: `/admin/locations/${location.id}` });
  }
  for (const dungeon of content.dungeons) {
    add({ track: "CHARACTER", level: dungeon.requiredLevel, kind: "Dungeon", name: dungeon.name, href: "/admin/dungeons" });
  }
  for (const quest of content.quests) {
    add({ track: "CHARACTER", level: quest.requiredLevel, kind: "Quest", name: quest.name, href: "/admin/settlements" });
  }
  for (const item of content.items) {
    add({ track: "CHARACTER", level: item.requiredLevel, kind: "Item", name: item.name, href: `/admin/items/${item.id}` });
  }
  for (const resource of content.resources) {
    if (!isVocationSkill(resource.skill) || resource.requiredCharacterLevel === null) continue;
    add({ track: resource.skill, level: resource.requiredSkillLevel, kind: "Resource", name: resource.name, href: `/admin/vocations/${resource.id}` });
  }
  for (const tier of content.expeditionTiers) {
    add({
      track: tier.skill,
      level: tier.requiredSkillLevel,
      kind: "Expedition",
      name: tier.label,
      href: tier.skill === "HUNTING" ? "/admin/hunting" : "/admin/gathering",
    });
  }
  for (const area of content.expeditionAreas) {
    add({
      track: area.skill,
      level: area.requiredSkillLevel,
      kind: "Area",
      name: `${area.name}${area.requiredCharacterLevel > 1 ? ` (character ${area.requiredCharacterLevel})` : ""}`,
      href: area.skill === "HUNTING" ? "/admin/hunting" : "/admin/gathering",
    });
  }
  return unlocks.sort((a, b) => a.level - b.level || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

/** Unlocks of one track grouped by level, lowest first. */
export function unlocksByLevel(unlocks: Unlock[], track: Track) {
  const levels = new Map<number, Unlock[]>();
  for (const unlock of unlocks) {
    if (unlock.track !== track) continue;
    const list = levels.get(unlock.level);
    if (list) list.push(unlock);
    else levels.set(unlock.level, [unlock]);
  }
  return [...levels].sort((a, b) => a[0] - b[0]);
}
