import "server-only";

import { npcQuestMarker, questMarkerKind } from "~/game/settlements";
import { VocationalActionType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { countItems, loadInventoryStacks } from "~/server/items/consumeItems";
import {
  getPresence,
  liveOfferWhere,
  unlockedWhere,
  visibleNpcWhere,
  visibleQuestWhere,
} from "./access";
import {
  getSettlementEffects,
  getSettlementProjects,
  settleProjectRounds,
} from "./projects";
import { findUserQuests, QUEST_VIEW_SELECT, toQuestView } from "./quests";
import { npcBuyPrice, shopPrice } from "./shop";
import { getStorageIcon } from "./storage";

const SETTLEMENT_SELECT = {
  id: true,
  name: true,
  kind: true,
  description: true,
  image: true,
  location: { select: { id: true, name: true } },
} as const;

const MAP_PIN_SELECT = { mapX: true, mapY: true } as const;

/**
 * The region the player stands in: its map and the settlements, dungeons and
 * hunting grounds on it, with whether the player may enter each yet.
 */
export async function getRegionPage(userId: string) {
  const presence = await getPresence(userId);
  if (!presence.locationId) {
    return { traveling: presence.traveling, location: null };
  }

  const byOrder = [{ sortOrder: "asc" as const }, { name: "asc" as const }];
  // A round that just ended may hide a WHILE_REACHED dungeon or ground.
  await settleProjectRounds({ enabled: true, settlement: { locationId: presence.locationId } });
  const [location, hunting] = await Promise.all([
    prisma.location.findUnique({
      where: { id: presence.locationId },
      select: {
        id: true,
        name: true,
        mapImage: true,
        settlements: {
          where: { enabled: true },
          orderBy: byOrder,
          select: { id: true, name: true, kind: true, ...MAP_PIN_SELECT },
        },
        dungeons: {
          where: { enabled: true, ...unlockedWhere() },
          orderBy: byOrder,
          select: {
            id: true,
            name: true,
            difficulty: true,
            requiredLevel: true,
            ...MAP_PIN_SELECT,
          },
        },
        huntingGrounds: {
          where: { enabled: true, ...unlockedWhere() },
          orderBy: byOrder,
          select: {
            id: true,
            name: true,
            requiredHuntingLevel: true,
            ...MAP_PIN_SELECT,
          },
        },
      },
    }),
    prisma.userTrackProgress.findUnique({
      where: {
        userId_trackType_trackKey: {
          userId,
          trackType: "SKILL",
          trackKey: VocationalActionType.HUNTING,
        },
      },
      select: { level: true },
    }),
  ]);
  if (!location) return { traveling: presence.traveling, location: null };

  const huntingLevel = hunting?.level ?? 1;
  return {
    traveling: presence.traveling,
    location: {
      ...location,
      dungeons: location.dungeons.map((dungeon) => ({
        ...dungeon,
        unlocked: presence.level >= dungeon.requiredLevel,
      })),
      huntingGrounds: location.huntingGrounds.map((ground) => ({
        ...ground,
        unlocked: huntingLevel >= ground.requiredHuntingLevel,
      })),
    },
  };
}

/** A settlement's NPCs, storage and projects; empty unless the player is there. */
export async function getSettlementPage(userId: string, settlementId: number) {
  const settlement = await prisma.settlement.findFirst({
    where: { id: settlementId, enabled: true },
    select: {
      ...SETTLEMENT_SELECT,
      mapImage: true,
      storage: {
        select: {
          name: true,
          slots: true,
          unlockCost: true,
          enabled: true,
          ...MAP_PIN_SELECT,
          // The player's own storage here, and how many slots it holds.
          players: {
            where: { userId },
            select: { _count: { select: { items: true } } },
          },
        },
      },
    },
  });
  if (!settlement) return null;

  const presence = await getPresence(userId);
  const present = presence.locationId === settlement.location.id;
  if (!present) {
    return {
      settlement,
      present,
      traveling: presence.traveling,
      npcs: [],
      storage: null,
      projects: [],
    };
  }

  const now = new Date();
  // Settle first: a new round can change which NPCs and quests show.
  await settleProjectRounds({ settlementId, enabled: true }, now);
  const [npcs, inventory, storageIcon, effects] = await Promise.all([
    prisma.npc.findMany({
      where: { settlementId, ...visibleNpcWhere() },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        portrait: true,
        headX: true,
        headY: true,
        headSize: true,
        ...MAP_PIN_SELECT,
        profession: { select: { name: true } },
        _count: { select: { offers: { where: liveOfferWhere(now) } } },
        quests: {
          where: visibleQuestWhere(presence.level),
          select: QUEST_VIEW_SELECT,
        },
      },
    }),
    loadInventoryStacks(prisma, userId, { lock: false }),
    getStorageIcon(),
    getSettlementEffects(settlementId),
  ]);
  const held = countItems(inventory.stacks);
  const [userQuests, projects] = await Promise.all([
    findUserQuests(
      userId,
      npcs.flatMap((npc) => npc.quests),
      now,
    ),
    getSettlementProjects(userId, settlementId, held, presence.level),
  ]);

  const storage = settlement.storage;
  return {
    settlement,
    present,
    traveling: presence.traveling,
    storage: storage?.enabled
      ? {
          name: storage.name,
          slots: storage.slots + effects.STORAGE_SLOTS,
          unlockCost: Number(storage.unlockCost),
          used: storage.players[0]?._count.items ?? null,
          icon: storageIcon,
          mapX: storage.mapX,
          mapY: storage.mapY,
        }
      : null,
    npcs: npcs.map(({ quests, _count, ...npc }) => {
      const views = quests.map((quest) =>
        toQuestView(quest, {
          userQuest: userQuests.get(quest.id),
          held,
          now,
          bonus: effects.QUEST_REWARD_BONUS,
        }),
      );
      return {
        ...npc,
        wares: _count.offers,
        questsAvailable: views.filter((view) => view.status === "AVAILABLE")
          .length,
        questsReady: views.filter((view) => view.ready).length,
        questMarker: npcQuestMarker(views.map(questMarkerKind)),
      };
    }),
    projects,
  };
}

/** One NPC's shop and quests; empty unless the player is there. */
export async function getNpcPage(
  userId: string,
  settlementId: number,
  npcId: number,
) {
  const now = new Date();
  const presence = await getPresence(userId);
  const npc = await prisma.npc.findFirst({
    where: { id: npcId, settlementId, ...visibleNpcWhere() },
    select: {
      id: true,
      name: true,
      portrait: true,
      profession: { select: { name: true } },
      description: true,
      settlement: { select: { ...SETTLEMENT_SELECT, mapImage: true } },
      offers: {
        where: liveOfferWhere(now),
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          price: true,
          item: {
            select: { id: true, name: true, sprite: true, rarity: true },
          },
        },
      },
      quests: {
        where: visibleQuestWhere(presence.level),
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: QUEST_VIEW_SELECT,
      },
    },
  });
  if (!npc?.settlement) return null;

  const { offers, quests, settlement, ...rest } = npc;
  const profile = { ...rest, settlement };
  const present = presence.locationId === settlement.location.id;
  if (!present) {
    return {
      npc: profile,
      present,
      traveling: presence.traveling,
      gold: 0,
      offers: [],
      quests: [],
      inventory: [],
    };
  }

  const [user, inventory, userQuests, effects] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { gold: true } }),
    loadInventoryStacks(prisma, userId, { lock: false }),
    findUserQuests(userId, quests, now),
    getSettlementEffects(settlementId),
  ]);
  const held = countItems(inventory.stacks);
  const templates = new Map(
    (
      await prisma.item.findMany({
        where: { id: { in: [...held.keys()] } },
        select: { id: true, name: true, sprite: true, price: true },
      })
    ).map((item) => [item.id, item]),
  );

  return {
    npc: profile,
    present,
    traveling: presence.traveling,
    gold: Number(user?.gold ?? 0),
    // Rare finds are listed like any other ware; their window stays hidden.
    offers: offers.map((offer) => ({
      id: offer.id,
      price: shopPrice(Number(offer.price), effects.SHOP_DISCOUNT),
      item: offer.item,
    })),
    quests: quests.map((quest) =>
      toQuestView(quest, {
        userQuest: userQuests.get(quest.id),
        held,
        now,
        bonus: effects.QUEST_REWARD_BONUS,
      }),
    ),
    // Every NPC buys anything in the inventory, in slot order.
    inventory: inventory.stacks.flatMap((stack) => {
      const item = templates.get(stack.itemId);
      return item
        ? [
            {
              userItemId: stack.id,
              rarity: stack.rarity,
              quantity: stack.quantity,
              price: npcBuyPrice(item.price, effects.SELL_BONUS),
              item: { id: item.id, name: item.name, sprite: item.sprite },
            },
          ]
        : [];
    }),
  };
}
