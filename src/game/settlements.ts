import type {
  QuestObjectiveType,
  QuestRepeat,
  SettlementKind,
} from "~/generated/prisma/enums";

export const SETTLEMENT_KIND_LABELS: Record<SettlementKind, string> = {
  VILLAGE: "Village",
  TOWN: "Town",
  CITY: "City",
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

/**
 * The classic quest-giver marks: "?" ready to hand in, a gold "!" for a
 * one-time quest to take, a blue "!" for a daily or weekly one, a grey "?"
 * while one is under way.
 */
export type QuestMarkerKind =
  | "ready"
  | "available"
  | "repeatable"
  | "active"
  | "completed";

export function questMarkerKind(quest: {
  ready: boolean;
  status: "AVAILABLE" | "ACTIVE" | "COMPLETED";
  repeat: QuestRepeat;
}): QuestMarkerKind {
  if (quest.ready) return "ready";
  if (quest.status === "AVAILABLE") {
    return quest.repeat === "ONCE" ? "available" : "repeatable";
  }
  return quest.status === "ACTIVE" ? "active" : "completed";
}

const MARKER_PRIORITY: QuestMarkerKind[] = [
  "ready",
  "available",
  "repeatable",
  "active",
];

/** The marker an NPC shows for all its quests: the most urgent one. */
export function npcQuestMarker(
  kinds: QuestMarkerKind[],
): QuestMarkerKind | null {
  return MARKER_PRIORITY.find((kind) => kinds.includes(kind)) ?? null;
}

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
