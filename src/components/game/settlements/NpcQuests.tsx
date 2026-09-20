"use client";

import { ChevronDown, CircleCheck, ScrollText } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { formatGold } from "~/lib/marketplace";
import { cn } from "~/lib/utils";
import type { QuestView } from "~/server/settlements";
import {
  formatTimeLeft,
  QuestObjectiveChips,
  QuestProgressBar,
  QuestRepeatBadge,
  QuestRewards,
  QuestStatusChip,
} from "./QuestParts";
import { useSettlementAction } from "./useSettlementAction";
import { useMarkQuestsSeen } from "./useUnseenQuests";

// Ready to hand in first, finished ones last.
function questOrder(quest: QuestView) {
  if (quest.ready) return 0;
  return { ACTIVE: 1, AVAILABLE: 2, COMPLETED: 3 }[quest.status];
}

function rewardSummary(result: Record<string, unknown>) {
  const parts: string[] = [];
  if (typeof result.gold === "number" && result.gold > 0) {
    parts.push(`${formatGold(result.gold)} gold`);
  }
  if (typeof result.xp === "number" && result.xp > 0)
    parts.push(`${result.xp} XP`);
  return parts.length > 0 ? ` +${parts.join(", ")}` : "";
}

const label =
  "w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground";

export function NpcQuests({
  npcId,
  quests,
}: {
  npcId: number;
  quests: QuestView[];
}) {
  const { run, pending } = useSettlementAction();
  useMarkQuestsSeen(npcId);
  if (quests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No quests right now.</p>
    );
  }

  const act = (action: "accept" | "complete" | "abandon", quest: QuestView) =>
    run(
      `${action}:${quest.id}`,
      `/api/settlements/quests/${action}`,
      { questId: quest.id },
      (result) =>
        action === "accept"
          ? `Quest accepted: ${quest.name}`
          : action === "complete"
            ? `Quest complete: ${quest.name}.${rewardSummary(result)}`
            : `Quest abandoned: ${quest.name}`,
    );
  const busy = (action: string, quest: QuestView) =>
    pending === `${action}:${quest.id}`;

  return (
    <div className="space-y-2">
      {[...quests]
        .sort((a, b) => questOrder(a) - questOrder(b))
        .map((quest) => (
          <Collapsible
            key={quest.id}
            defaultOpen={quest.ready}
            className={cn(
              "group/quest rounded-xl",
              quest.ready ? "bg-success/10" : "bg-secondary/25",
              quest.status === "COMPLETED" && "opacity-70",
            )}
          >
            <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-secondary/30">
              <ScrollText
                className={cn(
                  "h-4 w-4 shrink-0",
                  quest.ready ? "text-success" : "text-primary",
                )}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 space-y-1.5">
                <strong className="block truncate text-sm">{quest.name}</strong>
                <span className="flex flex-wrap gap-1.5">
                  <QuestStatusChip quest={quest} />
                  <QuestRepeatBadge quest={quest} />
                </span>
                <QuestProgressBar quest={quest} />
              </span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/quest:rotate-180"
                aria-hidden="true"
              />
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-3 px-3 pb-3">
              {quest.description ? (
                <p className="whitespace-pre-line text-xs italic text-text-secondary">
                  {quest.description}
                </p>
              ) : null}
              {quest.objectives.length > 0 ? (
                <div className="flex items-center gap-2">
                  <span className={label}>Needs</span>
                  <QuestObjectiveChips quest={quest} />
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <span className={label}>Rewards</span>
                <QuestRewards rewards={quest.rewards} />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {quest.status === "COMPLETED" ? (
                  <p
                    className="mr-auto text-xs text-muted-foreground"
                    suppressHydrationWarning
                  >
                    {quest.resetsAt
                      ? `Available again in ${formatTimeLeft(quest.resetsAt)}`
                      : "You have completed this quest."}
                  </p>
                ) : null}
                {quest.status === "AVAILABLE" ? (
                  <Button
                    size="sm"
                    onClick={() => void act("accept", quest)}
                    disabled={pending !== null}
                  >
                    {busy("accept", quest) ? "Accepting…" : "Accept quest"}
                  </Button>
                ) : null}
                {quest.status === "ACTIVE" ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Abandon ${quest.name}? Your progress on it is lost.`,
                          )
                        ) {
                          void act("abandon", quest);
                        }
                      }}
                      disabled={pending !== null}
                    >
                      {busy("abandon", quest) ? "Abandoning…" : "Abandon"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void act("complete", quest)}
                      disabled={pending !== null || !quest.ready}
                    >
                      <CircleCheck className="mr-1.5 h-4 w-4" />
                      {busy("complete", quest)
                        ? "Handing in…"
                        : "Complete quest"}
                    </Button>
                  </>
                ) : null}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
    </div>
  );
}
