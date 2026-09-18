import "server-only";

import { CreatureKind } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { CREATURE_ATTACK_SELECT } from "~/server/creatures/attackProfile";

// Player-facing bestiary. Loot is listed by item only: drop chances and
// quantities stay server-side, as do dungeon population counts.

export function listBestiaryCreatures(kind: CreatureKind) {
  return prisma.creature.findMany({
    where: { kind, enabled: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, asset: true },
  });
}

export async function getCreatureProfile(kind: CreatureKind, id: number) {
  const creature = await prisma.creature.findFirst({
    where: { id, kind, enabled: true },
    select: {
      id: true,
      name: true,
      description: true,
      asset: true,
      ...CREATURE_ATTACK_SELECT,
      health: true,
      armor: true,
      magicResist: true,
      evasion: true,
      blockChance: true,
      drops: {
        where: { enabled: true },
        orderBy: [{ requiredLevel: "asc" }, { item: { name: "asc" } }],
        select: {
          requiredLevel: true,
          item: {
            select: { id: true, name: true, sprite: true, rarity: true },
          },
        },
      },
      huntingGrounds: {
        where: { enabled: true, ground: { enabled: true } },
        select: {
          ground: {
            select: {
              id: true,
              name: true,
              location: { select: { name: true } },
            },
          },
        },
      },
      dungeons: {
        where: { enabled: true, dungeon: { enabled: true } },
        select: {
          dungeon: {
            select: {
              id: true,
              name: true,
              location: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!creature) return null;

  const { drops, huntingGrounds, dungeons, ...profile } = creature;
  const places =
    kind === CreatureKind.ANIMAL
      ? huntingGrounds.map((row) => row.ground)
      : dungeons.map((row) => row.dungeon);
  return {
    ...profile,
    loot: drops.map((drop) => ({
      ...drop.item,
      requiredLevel: drop.requiredLevel,
    })),
    habitats: places.map((place) => ({
      id: place.id,
      name: place.name,
      locationName: place.location.name,
    })),
  };
}

export type CreatureProfileData = NonNullable<
  Awaited<ReturnType<typeof getCreatureProfile>>
>;
