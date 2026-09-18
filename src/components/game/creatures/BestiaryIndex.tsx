import Image from "next/image";
import Link from "next/link";
import type { CreatureKind } from "~/generated/prisma/enums";
import { bestiaryHref } from "~/game/creatures";
import PageHeading from "~/components/game/ui/PageHeading";
import { listBestiaryCreatures } from "~/server/creatures/catalogue";

const COPY = {
  ANIMAL: {
    title: "Animals",
    description:
      "Wildlife tracked in hunting grounds across the realm. Open an entry to learn how it fights and what a hunt can bring home.",
    empty: "No animals have been recorded yet.",
  },
  MONSTER: {
    title: "Monsters",
    description:
      "Creatures that lurk in dungeons. Know their strengths before you step inside.",
    empty: "No monsters have been recorded yet.",
  },
} as const;

export default async function BestiaryIndex({ kind }: { kind: CreatureKind }) {
  const copy = COPY[kind];
  const creatures = await listBestiaryCreatures(kind);
  return (
    <main>
      <PageHeading
        eyebrow="Bestiary"
        title={copy.title}
        description={copy.description}
      />
      {creatures.length === 0 ? (
        <div className="game-empty-state rounded-2xl bg-card">{copy.empty}</div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {creatures.map((creature) => (
            <li key={creature.id}>
              <Link
                href={bestiaryHref(kind, creature.id)}
                className="flex h-full flex-col items-center gap-3 rounded-2xl bg-card p-4 text-center shadow-[var(--shadow-panel)] transition-colors hover:bg-accent"
              >
                <span
                  className="flex aspect-square w-full items-center justify-center rounded-xl"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 55%, hsl(var(--primary) / 0.1), transparent 70%)",
                  }}
                >
                  <Image
                    src={creature.asset}
                    alt=""
                    width={160}
                    height={160}
                    className="h-full w-full object-contain p-2"
                  />
                </span>
                <span className="text-sm font-semibold">{creature.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
