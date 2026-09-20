import { NextResponse, type NextRequest } from "next/server";
import { CreatureKind } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PER_GROUP = 5;

export type SearchHit = {
  key: string;
  label: string;
  /** Where it lives: a settlement, a rarity, a creature kind. */
  detail?: string;
  href: string;
  image?: string | null;
};

export type SearchResults = {
  items: SearchHit[];
  creatures: SearchHit[];
  npcs: SearchHit[];
  settlements: SearchHit[];
};

/**
 * One lookup across everything a player can navigate to: items (opened in the
 * marketplace), beasts, NPCs and settlements. Pages are matched in the client
 * from the navigation itself.
 */
export async function GET(request: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 2) {
    return NextResponse.json({
      items: [],
      creatures: [],
      npcs: [],
      settlements: [],
    } satisfies SearchResults);
  }

  const [items, creatures, npcs, settlements] = await Promise.all([
    prisma.item.findMany({
      where: { name: { contains: query } },
      select: { id: true, name: true, sprite: true, itemType: true },
      orderBy: { name: "asc" },
      take: PER_GROUP,
    }),
    prisma.creature.findMany({
      where: { name: { contains: query }, enabled: true },
      select: { id: true, name: true, asset: true, kind: true },
      orderBy: { name: "asc" },
      take: PER_GROUP,
    }),
    // Locked NPCs stay hidden until their community project is finished.
    prisma.npc.findMany({
      where: {
        name: { contains: query },
        enabled: true,
        requiredProjectId: null,
        settlement: { enabled: true },
      },
      select: {
        id: true,
        name: true,
        portrait: true,
        settlementId: true,
        settlement: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: PER_GROUP,
    }),
    prisma.settlement.findMany({
      where: { name: { contains: query }, enabled: true },
      select: { id: true, name: true, image: true, kind: true },
      orderBy: { name: "asc" },
      take: PER_GROUP,
    }),
  ]);

  const results: SearchResults = {
    items: items.map((item) => ({
      key: `item-${item.id}`,
      label: item.name,
      detail: item.itemType ? titleCase(item.itemType) : undefined,
      href: `/marketplace?search=${encodeURIComponent(item.name)}`,
      image: item.sprite,
    })),
    creatures: creatures.map((creature) => ({
      key: `creature-${creature.id}`,
      label: creature.name,
      detail: creature.kind === CreatureKind.ANIMAL ? "Animal" : "Monster",
      href:
        creature.kind === CreatureKind.ANIMAL
          ? `/animals/${creature.id}`
          : `/monsters/${creature.id}`,
      image: creature.asset,
    })),
    npcs: npcs.map((npc) => ({
      key: `npc-${npc.id}`,
      label: npc.name,
      detail: npc.settlement.name,
      href: `/settlements/${npc.settlementId}/npcs/${npc.id}`,
      image: npc.portrait,
    })),
    settlements: settlements.map((settlement) => ({
      key: `settlement-${settlement.id}`,
      label: settlement.name,
      detail: titleCase(settlement.kind),
      href: `/settlements/${settlement.id}`,
      image: settlement.image,
    })),
  };

  return NextResponse.json(results);
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
}
