import "server-only";

import {
  ItemType,
  StatType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { getCharacterVitalsFromSnapshot } from "~/server/combat/health";
import { getCharacterStatSnapshot } from "~/server/stats";
import { calculateInventoryCapacity } from "~/utils/inventoryCapacity";
import { normalizeInventorySlots } from "~/utils/inventorySlots";
import { getLevelCurve } from "~/utils/leveling";
import { getTrackCurve } from "~/utils/progression";
import { levelProgress } from "~/utils/xpCurve";
import {
  itemPlacement,
  LIVE_ITEM_STATUSES,
  maxCurveLevel,
  type ItemPlacement,
} from "./playerRules";

/**
 * Everything /admin shows about player accounts. Values leave here
 * serializable (dates as ISO strings, BigInt as strings, gold as numbers) so
 * the pages can hand them straight to client components.
 */

const iso = (date: Date | null | undefined) => date?.toISOString() ?? null;

/* -------------------------------------------------------------- the list */

export type AdminPlayerRow = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  level: number;
  experience: string;
  gold: number;
  location: string | null;
  lastOnline: string;
  /** What the character is busy with, or null when idle. */
  activity: string | null;
  items: number;
  signIn: string[];
};

function activityLabel(user: {
  travelActivity: { cancelledAt: Date | null } | null;
  vocationalActivity: { actionType: VocationalActionType } | null;
  gardenHarvestActivity: { id: number } | null;
  gatheringExpedition: { claimedAt: Date | null } | null;
  huntingExpedition: { claimedAt: Date | null } | null;
  dungeonRun: { claimedAt: Date | null } | null;
}): string | null {
  if (user.travelActivity && !user.travelActivity.cancelledAt) return "Travel";
  if (user.vocationalActivity) {
    const type = user.vocationalActivity.actionType;
    return type.charAt(0) + type.slice(1).toLowerCase();
  }
  if (user.gardenHarvestActivity) return "Garden harvest";
  if (user.gatheringExpedition && !user.gatheringExpedition.claimedAt) {
    return "Gathering";
  }
  if (user.huntingExpedition && !user.huntingExpedition.claimedAt) {
    return "Hunting";
  }
  if (user.dungeonRun && !user.dungeonRun.claimedAt) return "Dungeon";
  return null;
}

export async function listAdminPlayers(): Promise<AdminPlayerRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { last_online: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      level: true,
      experience: true,
      gold: true,
      last_online: true,
      password: true,
      currentLocation: { select: { name: true } },
      accounts: { select: { provider: true } },
      travelActivity: { select: { cancelledAt: true } },
      vocationalActivity: { select: { actionType: true } },
      gardenHarvestActivity: { select: { id: true } },
      gatheringExpedition: { select: { claimedAt: true } },
      huntingExpedition: { select: { claimedAt: true } },
      dungeonRun: { select: { claimedAt: true } },
      _count: {
        select: {
          userItems: { where: { status: { in: [...LIVE_ITEM_STATUSES] } } },
        },
      },
    },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    level: user.level,
    experience: user.experience.toString(),
    gold: Number(user.gold),
    location: user.currentLocation?.name ?? null,
    lastOnline: user.last_online.toISOString(),
    activity: activityLabel(user),
    items: user._count.userItems,
    // The hash never leaves the server; only whether there is one.
    signIn: [
      ...(user.password ? ["password"] : []),
      ...user.accounts.map((account) => account.provider),
    ],
  }));
}

/* ------------------------------------------------------ one player's data */

async function loadItems(userId: string) {
  const [items, inventory, equipment] = await Promise.all([
    prisma.userItem.findMany({
      where: { userId, status: { in: [...LIVE_ITEM_STATUSES] } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        itemId: true,
        rarity: true,
        quantity: true,
        status: true,
        isTradeable: true,
        listedPrice: true,
        acquiredAt: true,
        itemTemplate: {
          select: {
            name: true,
            sprite: true,
            stackable: true,
            maxStackSize: true,
            itemType: true,
          },
        },
        statModifiers: { select: { statType: true, value: true } },
        storage: {
          select: { storage: { select: { settlement: { select: { name: true } } } } },
        },
      },
    }),
    prisma.inventory.findUnique({
      where: { userId },
      select: { slots: true, maxSlots: true, deleteSlotId: true },
    }),
    prisma.equipment.findUnique({ where: { userId } }),
  ]);

  const layout = {
    slots: normalizeInventorySlots(inventory?.slots, null),
    equipment: equipment ?? {},
    deleteSlotId: inventory?.deleteSlotId ?? null,
  };

  return {
    bag: {
      used: layout.slots.filter((slot) => slot.item).length,
      slots: inventory?.maxSlots ?? 0,
    },
    items: items.map((item) => ({
      id: item.id,
      itemId: item.itemId,
      name: item.itemTemplate.name,
      sprite: item.itemTemplate.sprite,
      itemType: item.itemTemplate.itemType,
      stackable: item.itemTemplate.stackable,
      maxStackSize: item.itemTemplate.maxStackSize,
      rarity: item.rarity,
      quantity: item.quantity,
      status: item.status,
      isTradeable: item.isTradeable,
      listedPrice: item.listedPrice,
      acquiredAt: item.acquiredAt.toISOString(),
      modifiers: item.statModifiers,
      placement: itemPlacement(item, layout) satisfies ItemPlacement,
      storageName: item.storage?.storage.settlement.name ?? null,
    })),
  };
}

async function loadActivities(userId: string) {
  const [travel, vocation, garden, gathering, hunting, dungeon] =
    await Promise.all([
      prisma.userTravelActivity.findUnique({
        where: { userId },
        select: {
          startedAt: true,
          endsAt: true,
          cancelledAt: true,
          fromLocation: { select: { name: true } },
          toLocation: { select: { name: true } },
        },
      }),
      prisma.userVocationalActivity.findUnique({
        where: { userId },
        select: {
          actionType: true,
          startedAt: true,
          endsAt: true,
          unitSeconds: true,
          unitsClaimed: true,
          resource: { select: { name: true } },
          location: { select: { name: true } },
        },
      }),
      prisma.userGardenHarvestActivity.findUnique({
        where: { userId },
        select: { startedAt: true, endsAt: true },
      }),
      prisma.userGatheringExpedition.findUnique({
        where: { userId },
        select: {
          startedAt: true,
          endsAt: true,
          claimedAt: true,
          location: { select: { name: true } },
        },
      }),
      prisma.userHuntingExpedition.findUnique({
        where: { userId },
        select: {
          startedAt: true,
          endsAt: true,
          claimedAt: true,
          ground: { select: { name: true } },
        },
      }),
      prisma.userDungeonRun.findUnique({
        where: { userId },
        select: {
          startedAt: true,
          endsAt: true,
          claimedAt: true,
          dungeon: { select: { name: true } },
        },
      }),
    ]);

  const rows: AdminActivity[] = [];
  const add = (
    kind: AdminActivityKind,
    label: string,
    detail: string,
    row: { startedAt: Date; endsAt: Date; claimedAt?: Date | null },
  ) =>
    rows.push({
      kind,
      label,
      detail,
      startedAt: row.startedAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      claimedAt: iso(row.claimedAt),
    });

  if (travel) {
    add(
      "travel",
      "Travel",
      `${travel.fromLocation?.name ?? "Somewhere"} → ${travel.toLocation.name}${travel.cancelledAt ? " (cancelled)" : ""}`,
      travel,
    );
  }
  if (vocation) {
    add(
      "vocation",
      vocation.actionType.charAt(0) + vocation.actionType.slice(1).toLowerCase(),
      `${vocation.resource.name}${vocation.location ? ` at ${vocation.location.name}` : ""} · ${vocation.unitsClaimed} done, ${vocation.unitSeconds}s each`,
      vocation,
    );
  }
  if (garden) add("garden", "Garden harvest", "Harvesting planted tiles", garden);
  if (gathering) {
    add("gathering", "Gathering", gathering.location.name, gathering);
  }
  if (hunting) add("hunting", "Hunting", hunting.ground.name, hunting);
  if (dungeon) add("dungeon", "Dungeon", dungeon.dungeon.name, dungeon);
  return rows;
}

export type AdminActivityKind =
  | "travel"
  | "vocation"
  | "garden"
  | "gathering"
  | "hunting"
  | "dungeon";

export type AdminActivity = {
  kind: AdminActivityKind;
  label: string;
  detail: string;
  startedAt: string;
  endsAt: string;
  /** Expeditions and dungeon runs keep their journal after the claim. */
  claimedAt: string | null;
};

async function loadSkills(userId: string) {
  const [tracks, metrics, curve] = await Promise.all([
    prisma.userTrackProgress.findMany({
      where: { userId },
      orderBy: [{ trackType: "asc" }, { trackKey: "asc" }],
      select: { trackType: true, trackKey: true, level: true, experience: true },
    }),
    prisma.userSkillMetric.findMany({ where: { userId } }),
    getTrackCurve("SKILL"),
  ]);
  const trackByKey = new Map(
    tracks
      .filter((track) => track.trackType === "SKILL")
      .map((track) => [track.trackKey, track]),
  );
  const metricByType = new Map(metrics.map((row) => [row.actionType, row]));

  // Every skill, including ones the player never used (level 1, no row yet).
  const skills = Object.values(VocationalActionType).map((actionType) => {
    const track = trackByKey.get(actionType);
    const metric = metricByType.get(actionType);
    const experience = track?.experience ?? 0n;
    return {
      actionType,
      level: track?.level ?? 1,
      experience: experience.toString(),
      progress: levelProgress(curve, track?.level ?? 1, experience),
      itemsGathered: (metric?.itemsGathered ?? 0n).toString(),
      secondsSpent: (metric?.secondsSpent ?? 0n).toString(),
    };
  });

  return {
    skills,
    maxSkillLevel: maxCurveLevel(curve),
    otherTracks: tracks
      .filter((track) => track.trackType !== "SKILL")
      .map((track) => ({
        trackType: track.trackType,
        trackKey: track.trackKey,
        level: track.level,
        experience: track.experience.toString(),
      })),
  };
}

async function loadMessages(userId: string) {
  const threads = await prisma.conversationParticipant.findMany({
    where: { userId },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    select: {
      hidden: true,
      unread: true,
      conversation: {
        select: {
          id: true,
          system: true,
          lastMessageAt: true,
          participants: {
            where: { userId: { not: userId } },
            select: { user: { select: { id: true, name: true } } },
          },
          messages: {
            orderBy: { id: "asc" },
            select: {
              id: true,
              body: true,
              createdAt: true,
              senderId: true,
              sender: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return threads.map(({ hidden, unread, conversation }) => ({
    id: conversation.id,
    system: conversation.system,
    with: conversation.system
      ? null
      : (conversation.participants[0]?.user ?? null),
    hidden,
    unread,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    messages: conversation.messages.map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      mine: message.senderId === userId,
      sender: message.senderId
        ? (message.sender?.name ?? "Deleted player")
        : "Aergyle",
    })),
  }));
}

export async function getAdminPlayer(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      password: true,
      last_online: true,
      last_action: true,
      level: true,
      experience: true,
      gold: true,
      currentLocationId: true,
      currentLocation: { select: { name: true } },
      accounts: { select: { provider: true, providerAccountId: true } },
      baseStats: { select: { statType: true, value: true } },
    },
  });
  if (!user) return null;

  const [
    snapshot,
    capacity,
    levelCurve,
    items,
    activities,
    skills,
    gardenTiles,
    xpMultipliers,
    quests,
    recipes,
    storages,
    buyOrders,
    transactions,
    contributions,
    notifications,
    messages,
    xpHistory,
  ] = await Promise.all([
    getCharacterStatSnapshot(userId),
    calculateInventoryCapacity(userId),
    getLevelCurve(),
    loadItems(userId),
    loadActivities(userId),
    loadSkills(userId),
    prisma.userGardenTile.findMany({
      where: { userId },
      orderBy: { tileIndex: "asc" },
      select: {
        id: true,
        tileIndex: true,
        plantedAt: true,
        readyAt: true,
        seedItem: { select: { name: true, sprite: true } },
        yieldItem: { select: { name: true } },
      },
    }),
    prisma.xpMultiplier.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userQuest.findMany({
      where: { userId },
      orderBy: { acceptedAt: "desc" },
      select: {
        id: true,
        period: true,
        acceptedAt: true,
        completedAt: true,
        quest: {
          select: {
            name: true,
            repeat: true,
            npc: { select: { name: true, settlement: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.userLearnedRecipe.findMany({
      where: { userId },
      orderBy: { learnedAt: "desc" },
      select: {
        recipeItemId: true,
        learnedAt: true,
        recipeItem: { select: { name: true, sprite: true } },
      },
    }),
    prisma.userStorage.findMany({
      where: { userId },
      select: {
        id: true,
        unlockedAt: true,
        storage: {
          select: {
            id: true,
            name: true,
            slots: true,
            settlement: { select: { name: true } },
          },
        },
        _count: { select: { items: { where: { status: "IN_STORAGE" } } } },
      },
    }),
    prisma.marketBuyOrder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        rarity: true,
        quantity: true,
        remainingQuantity: true,
        pricePerItem: true,
        reservedGold: true,
        status: true,
        createdAt: true,
        item: { select: { name: true, sprite: true } },
      },
    }),
    prisma.marketTransaction.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      orderBy: { executedAt: "desc" },
      take: 100,
      select: {
        id: true,
        buyerId: true,
        rarity: true,
        quantity: true,
        unitPrice: true,
        grossAmount: true,
        netAmount: true,
        source: true,
        executedAt: true,
        item: { select: { name: true, sprite: true } },
        buyer: { select: { name: true } },
        seller: { select: { name: true } },
      },
    }),
    prisma.communityProjectContribution.findMany({
      where: { userId },
      select: {
        id: true,
        quantity: true,
        requirement: {
          select: {
            item: { select: { name: true, sprite: true } },
            project: {
              select: { name: true, settlement: { select: { name: true } } },
            },
          },
        },
      },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { id: "desc" },
      select: {
        id: true,
        category: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
    loadMessages(userId),
    prisma.xpTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        actionType: true,
        vocationalActionType: true,
        amount: true,
        finalAmount: true,
        levelBefore: true,
        levelAfter: true,
        description: true,
        createdAt: true,
      },
    }),
  ]);

  const vitals = await getCharacterVitalsFromSnapshot(userId, snapshot);
  const bonuses = new Map(user.baseStats.map((row) => [row.statType, row.value]));

  return {
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: iso(user.emailVerified),
      image: user.image,
      hasPassword: Boolean(user.password),
      providers: user.accounts,
      lastOnline: user.last_online.toISOString(),
      lastAction: user.last_action,
    },
    character: {
      level: user.level,
      experience: user.experience.toString(),
      progress: levelProgress(levelCurve, user.level, user.experience),
      maxLevel: maxCurveLevel(levelCurve),
      gold: Number(user.gold),
      locationId: user.currentLocationId,
      locationName: user.currentLocation?.name ?? null,
      health: {
        current: vitals.currentHealth,
        max: vitals.maxHealth,
        regen: vitals.healthRegen,
      },
    },
    stats: Object.values(StatType).map((statType) => {
      const bonus = bonuses.get(statType) ?? 0;
      return {
        statType,
        // snapshot.baseStats already includes the bonus.
        fromLevel: snapshot.baseStats[statType] - bonus,
        bonus,
        equipment: snapshot.equipmentBonuses[statType],
        food: snapshot.temporaryBonuses[statType],
        total: snapshot.totals[statType],
      };
    }),
    foodEffect: snapshot.activeEffect
      ? {
          itemId: snapshot.activeEffect.item.id,
          name: snapshot.activeEffect.item.name,
          sprite: snapshot.activeEffect.item.sprite,
          endsAt: snapshot.activeEffect.endsAt.toISOString(),
        }
      : null,
    xpMultipliers: xpMultipliers.map((row) => ({
      id: row.id,
      name: row.name,
      multiplier: row.multiplier,
      actionType: row.actionType,
      vocationalActionType: row.vocationalActionType,
      expiresAt: iso(row.expiresAt),
      usesRemaining: row.usesRemaining,
      isActive: row.isActive,
      stackable: row.stackable,
    })),
    bag: { ...items.bag, capacity },
    items: items.items,
    activities,
    gardenTiles: gardenTiles.map((tile) => ({
      id: tile.id,
      tileIndex: tile.tileIndex,
      seed: tile.seedItem,
      yieldName: tile.yieldItem.name,
      plantedAt: tile.plantedAt.toISOString(),
      readyAt: tile.readyAt.toISOString(),
    })),
    ...skills,
    quests: quests.map((row) => ({
      id: row.id,
      name: row.quest.name,
      repeat: row.quest.repeat,
      npc: row.quest.npc.name,
      settlement: row.quest.npc.settlement.name,
      period: row.period,
      acceptedAt: row.acceptedAt.toISOString(),
      completedAt: iso(row.completedAt),
    })),
    recipes: recipes.map((row) => ({
      itemId: row.recipeItemId,
      name: row.recipeItem.name,
      sprite: row.recipeItem.sprite,
      learnedAt: row.learnedAt.toISOString(),
    })),
    storages: storages.map((row) => ({
      id: row.id,
      storageId: row.storage.id,
      name: row.storage.name,
      settlement: row.storage.settlement.name,
      slots: row.storage.slots,
      used: row._count.items,
      unlockedAt: row.unlockedAt.toISOString(),
    })),
    buyOrders: buyOrders.map((row) => ({
      id: row.id,
      item: row.item,
      rarity: row.rarity,
      quantity: row.quantity,
      remaining: row.remainingQuantity,
      pricePerItem: Number(row.pricePerItem),
      reservedGold: Number(row.reservedGold),
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
    transactions: transactions.map((row) => {
      const bought = row.buyerId === userId;
      return {
        id: row.id,
        side: bought ? ("BOUGHT" as const) : ("SOLD" as const),
        item: row.item,
        rarity: row.rarity,
        quantity: row.quantity,
        unitPrice: Number(row.unitPrice),
        // What the player paid, or what reached them after tax.
        amount: Number(bought ? row.grossAmount : row.netAmount),
        with: (bought ? row.seller?.name : row.buyer?.name) ?? null,
        source: row.source,
        executedAt: row.executedAt.toISOString(),
      };
    }),
    contributions: contributions.map((row) => ({
      id: row.id,
      quantity: row.quantity,
      item: row.requirement.item,
      project: row.requirement.project.name,
      settlement: row.requirement.project.settlement.name,
    })),
    notifications: notifications.map((row) => ({
      ...row,
      readAt: iso(row.readAt),
      createdAt: row.createdAt.toISOString(),
    })),
    conversations: messages,
    xpHistory: xpHistory.map((row) => ({
      ...row,
      amount: row.amount.toString(),
      finalAmount: row.finalAmount.toString(),
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export type AdminPlayer = NonNullable<Awaited<ReturnType<typeof getAdminPlayer>>>;

/** What the player editor's pickers choose from. */
export async function getAdminPlayerOptions() {
  const [items, locations, storages] = await Promise.all([
    prisma.item.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sprite: true,
        rarity: true,
        itemType: true,
        stackable: true,
        maxStackSize: true,
        foodEffectSeconds: true,
      },
    }),
    prisma.location.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.settlementStorage.findMany({
      orderBy: { settlement: { name: "asc" } },
      select: {
        id: true,
        name: true,
        settlement: { select: { name: true } },
      },
    }),
  ]);

  return {
    items: items.map(({ foodEffectSeconds, ...item }) => ({
      ...item,
      isRecipe: item.itemType === ItemType.RECIPE,
      isFood: foodEffectSeconds !== null && foodEffectSeconds > 0,
    })),
    locations,
    storages: storages.map((storage) => ({
      id: storage.id,
      name: `${storage.settlement.name} · ${storage.name}`,
    })),
  };
}

export type AdminPlayerOptions = Awaited<ReturnType<typeof getAdminPlayerOptions>>;
