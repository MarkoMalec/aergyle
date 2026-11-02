import Image from "next/image";
import { UserRound } from "lucide-react";
import { cn } from "~/lib/utils";

export type NpcSummaryData = {
  name: string;
  portrait: string | null;
  profession: { name: string } | null;
  enabled: boolean;
  requiredProject: { name: string } | null;
  _count: { offers: number; quests: number };
};

/** An NPC's portrait, name, shop and quest counts and status, for a flex row. */
export function NpcSummary({ npc }: { npc: NpcSummaryData }) {
  return (
    <>
      {npc.portrait?.startsWith("/") ? (
        <Image
          src={npc.portrait}
          alt=""
          width={56}
          height={84}
          draggable={false}
          className="h-[84px] w-14 shrink-0 rounded-lg bg-black/30 object-cover object-top"
        />
      ) : (
        <span className="grid h-[84px] w-14 shrink-0 place-items-center rounded-lg bg-black/30">
          <UserRound className="h-6 w-6 text-white/30" />
        </span>
      )}
      <span className="min-w-0 flex-1 space-y-0.5">
        <strong className="block truncate text-sm" title={npc.name}>
          {npc.name}
        </strong>
        <small
          className={cn(
            "block truncate text-xs",
            npc.profession ? "text-amber-200/80" : "text-white/30",
          )}
        >
          {npc.profession?.name ?? "No profession"}
        </small>
        <small className="block text-xs text-white/45">
          {npc._count.offers} for sale · {npc._count.quests} quests
        </small>
        <small className="block truncate text-xs">
          <span className={npc.enabled ? "text-emerald-300" : "text-white/35"}>
            {npc.enabled ? "Enabled" : "Disabled"}
          </span>
          {npc.requiredProject ? (
            <span
              className="text-amber-300/80"
              title={`Hidden until “${npc.requiredProject.name}” is complete`}
            >
              {" "}
              · Hidden until “{npc.requiredProject.name}”
            </span>
          ) : null}
        </small>
      </span>
    </>
  );
}
