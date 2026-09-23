import type {
  NpcProfession,
  QuestObjectiveType,
  QuestRepeat,
  SettlementKind,
} from "~/generated/prisma/enums";

export const SETTLEMENT_KIND_LABELS: Record<SettlementKind, string> = {
  VILLAGE: "Village",
  TOWN: "Town",
  CITY: "City",
};

// A profession only grants services (blacksmith: rarity upgrades, later
// repairs); NPCs are always presented by name.
export const NPC_PROFESSION_LABELS: Record<NpcProfession, string> = {
  BLACKSMITH: "Blacksmith",
};

export const QUEST_REPEAT_LABELS: Record<QuestRepeat, string> = {
  ONCE: "One-time",
  DAILY: "Daily",
  WEEKLY: "Weekly",
};

export const QUEST_OBJECTIVE_LABELS: Record<QuestObjectiveType, string> = {
  DELIVER: "Deliver",
  HUNT: "Defeat",
  CLEAR: "Clear",
};

export function settlementHref(settlementId: number) {
  return `/settlements/${settlementId}`;
}

export function npcHref(settlementId: number, npcId: number) {
  return `/settlements/${settlementId}/npcs/${npcId}`;
}

// A settlement has one storage, so its page needs no id of its own.
export function storageHref(settlementId: number) {
  return `/settlements/${settlementId}/storage`;
}
