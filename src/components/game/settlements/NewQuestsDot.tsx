"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useUnseenQuests } from "./useUnseenQuests";

const LABEL = "New Quests available!";

/**
 * A dot in the top-right corner of its (positioned) parent while the player
 * has unseen one-time quests where they stand: at one settlement or NPC, or
 * anywhere when neither is given.
 */
export function NewQuestsDot(props: {
  settlementId?: number;
  npcId?: number;
  className?: string;
}) {
  const { data } = useUnseenQuests();
  const lit = data?.some(
    (quest) =>
      (props.settlementId === undefined ||
        quest.settlementId === props.settlementId) &&
      (props.npcId === undefined || quest.npcId === props.npcId),
  );
  if (!lit) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Wider than the dot, so it is easy to hover. */}
          <span
            className={cn(
              "absolute right-1 top-1 grid h-5 w-5 place-items-center",
              props.className,
            )}
          >
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_2px_hsl(var(--background)/0.6),0_0_8px_hsl(var(--primary)/0.7)]" />
            <span className="sr-only">{LABEL}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{LABEL}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
