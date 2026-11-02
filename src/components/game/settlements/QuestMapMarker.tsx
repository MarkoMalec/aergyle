"use client";

import type { QuestMarkerKind } from "~/game/settlements";
import { cn } from "~/lib/utils";
import { QuestMarker } from "./QuestParts";
import { useUnseenQuests } from "./useUnseenQuests";

/**
 * A quest marker over a map pin ("pin"), at the end of a list row ("row") or
 * on the list's toggle ("badge"). It pulses while the player has unseen
 * one-time quests there: at one NPC, or anywhere in one settlement.
 */
export function QuestMapMarker(props: {
  kind: QuestMarkerKind;
  size: "pin" | "row" | "badge";
  npcId?: number;
  settlementId?: number;
}) {
  const { data } = useUnseenQuests();
  const unseen =
    data?.some(
      (quest) =>
        (props.npcId === undefined || quest.npcId === props.npcId) &&
        (props.settlementId === undefined ||
          quest.settlementId === props.settlementId),
    ) ?? false;
  const pin = props.size === "pin";
  // Lit markers over the map get a light burst and bob out of step, so the
  // map feels alive; the grey "in progress" one stays plain and still.
  const lively = pin && props.kind !== "active";

  return (
    <span
      // The burst around the glyph reaches below it; tuck it in.
      className={cn("block", lively && "-mb-3 motion-safe:animate-bob")}
      style={
        lively
          ? { animationDelay: `${-((props.npcId ?? 0) % 6) * 0.4}s` }
          : undefined
      }
    >
      <QuestMarker
        kind={props.kind}
        size={pin ? 32 : props.size === "row" ? 22 : 16}
        burst={lively}
        pulse={unseen}
        label={unseen ? "New Quests available!" : undefined}
      />
    </span>
  );
}
