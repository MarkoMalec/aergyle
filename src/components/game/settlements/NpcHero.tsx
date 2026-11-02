import Image from "next/image";
import { ScrollText, Store, UserRound } from "lucide-react";
import type { QuestMarkerKind } from "~/game/settlements";
import { cn } from "~/lib/utils";
import { QuestMarker } from "./QuestParts";

const fact =
  "inline-flex items-center gap-1.5 rounded-full bg-background/45 px-3 py-1 text-xs font-medium text-text-secondary backdrop-blur-sm transition-colors hover:bg-background/70 hover:text-foreground";

/**
 * The NPC standing in their settlement: its map, blurred, is the scene, the
 * figure is lit from behind, and the best quest on offer hovers over the head.
 */
export function NpcHero(props: {
  name: string;
  portrait: string | null;
  description: string | null;
  profession: string | null;
  /** The settlement's artwork, used as the backdrop. */
  scene: string | null;
  marker: QuestMarkerKind | null;
  wares: number;
  quests: { open: number; ready: number };
}) {
  return (
    <section
      aria-labelledby="npc-name"
      className="relative isolate overflow-hidden rounded-lg bg-card shadow-[var(--shadow-panel)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        {props.scene?.startsWith("/") ? (
          <Image
            src={props.scene}
            alt=""
            fill
            sizes="480px"
            className="scale-110 object-cover opacity-50 blur-[6px]"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-card/30 via-card/80 to-card/95" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/60 to-transparent" />
      </div>

      {/*
        Phones: the figure beside the name, the description underneath.
        From sm the figure spans both.
      */}
      <div className="grid grid-cols-[124px_minmax(0,1fr)] [grid-template-areas:'art_id'_'lore_lore'] sm:grid-cols-[220px_minmax(0,1fr)] sm:[grid-template-areas:'art_id'_'art_lore'] lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="relative min-h-[228px] [grid-area:art] sm:min-h-[300px] lg:min-h-[350px]">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 top-10 bg-[radial-gradient(closest-side,hsl(var(--primary)/0.26),transparent)]"
          />
          <div
            aria-hidden="true"
            className="absolute bottom-2.5 left-1/2 h-5 w-3/5 -translate-x-1/2 rounded-[50%] bg-black/60 blur-md"
          />
          <div className="absolute inset-x-2 bottom-3 top-14 sm:top-16">
            {props.portrait?.startsWith("/") ? (
              <Image
                src={props.portrait}
                alt={props.name}
                fill
                priority
                sizes="(max-width: 640px) 130px, 280px"
                className="pointer-events-none select-none object-contain object-bottom drop-shadow-[0_14px_24px_rgb(0_0_0/0.5)]"
              />
            ) : (
              <UserRound
                className="absolute left-1/2 top-1/3 h-16 w-16 -translate-x-1/2 text-muted-foreground/40"
                aria-hidden="true"
              />
            )}
          </div>
          {props.marker ? (
            <div className="absolute left-1/2 top-0 -translate-x-1/2">
              <a href="#quests" className="block motion-safe:animate-bob">
                <QuestMarker kind={props.marker} size={36} burst />
              </a>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 self-center py-5 pr-4 [grid-area:id] sm:self-end sm:pb-0 sm:pr-8 sm:pt-8">
          {props.profession ? (
            <p className="game-eyebrow truncate">{props.profession}</p>
          ) : null}
          <h1
            id="npc-name"
            className="mt-1 font-display text-[26px] font-[650] leading-[1.15] tracking-[-0.04em] text-foreground [overflow-wrap:anywhere] [text-shadow:0_1px_3px_hsl(var(--background)/0.9)] sm:text-[36px]"
          >
            {props.name}
          </h1>
          {props.wares > 0 || props.quests.open > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {props.wares > 0 ? (
                <a href="#wares" className={fact}>
                  <Store
                    className="h-3.5 w-3.5 text-primary"
                    aria-hidden="true"
                  />
                  {props.wares} for sale
                </a>
              ) : null}
              {props.quests.open > 0 ? (
                <a href="#quests" className={fact}>
                  <ScrollText
                    className="h-3.5 w-3.5 text-primary"
                    aria-hidden="true"
                  />
                  {props.quests.open}{" "}
                  {props.quests.open === 1 ? "quest" : "quests"}
                </a>
              ) : null}
              {props.quests.ready > 0 ? (
                <a
                  href="#quests"
                  className={cn(
                    fact,
                    "bg-success/15 text-success hover:bg-success/25 hover:text-success",
                  )}
                >
                  {props.quests.ready} ready to hand in
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        {props.description ? (
          <p className="max-w-[62ch] whitespace-pre-line px-4 pb-5 text-sm italic leading-relaxed text-text-secondary [grid-area:lore] sm:pb-8 sm:pl-0 sm:pr-8 sm:pt-4">
            {props.description}
          </p>
        ) : null}
      </div>
    </section>
  );
}
