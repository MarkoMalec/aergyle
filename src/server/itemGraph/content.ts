import "server-only";

import { VocationalActionType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import type { ItemGraphContent } from "~/game/itemGraph/content";
import { getSkillItemRules } from "~/server/vocations/skillRules";

/**
 * Everything the item graph needs, in one round of queries. "available"
 * mirrors what the game itself requires before a source pays out, so the
 * diagnostics agree with what players can actually do.
 */
export async function loadItemGraphContent(): Promise<ItemGraphContent> {
  const now = new Date();
  const [items, resources, drops, offers, rewards, deliveries, needs, locations, skillRules] =
    await Promise.all([
      prisma.item.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          sprite: true,
          rarity: true,
          itemType: true,
          equipTo: true,
          requiredLevel: true,
          price: true,
          seedYieldItemId: true,
          seedYieldMin: true,
          seedYieldMax: true,
          seedGrowSeconds: true,
          seedHarvestSeconds: true,
        },
      }),
      prisma.vocationalResource.findMany({
        orderBy: [{ actionType: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          actionType: true,
          name: true,
          itemId: true,
          requiredRecipeItemId: true,
          requiredSkillLevel: true,
          defaultSeconds: true,
          yieldPerUnit: true,
          xpPerUnit: true,
          rarity: true,
          requirements: {
            orderBy: { id: "asc" },
            select: { itemId: true, quantityPerUnit: true },
          },
          locations: {
            where: { enabled: true },
            select: {
              locationId: true,
              gatheringBaseChance: true,
              location: { select: { gatheringEnabled: true } },
            },
          },
        },
      }),
      prisma.creatureDrop.findMany({
        select: {
          itemId: true,
          enabled: true,
          baseChance: true,
          minQuantity: true,
          maxQuantity: true,
          requiredLevel: true,
          creature: {
            select: {
              id: true,
              name: true,
              kind: true,
              enabled: true,
              huntingGrounds: {
                where: { enabled: true, ground: { enabled: true } },
                select: { ground: { select: { name: true } } },
              },
              dungeons: {
                where: { enabled: true, dungeon: { enabled: true } },
                select: { dungeon: { select: { name: true } } },
              },
            },
          },
        },
      }),
      prisma.npcOffer.findMany({
        select: {
          itemId: true,
          price: true,
          enabled: true,
          availableFrom: true,
          availableUntil: true,
          requiredProjectId: true,
          npc: {
            select: {
              id: true,
              name: true,
              enabled: true,
              requiredProjectId: true,
              settlement: { select: { name: true, enabled: true } },
            },
          },
        },
      }),
      prisma.questRewardItem.findMany({
        select: {
          itemId: true,
          quantity: true,
          quest: {
            select: {
              id: true,
              name: true,
              enabled: true,
              npc: { select: { id: true, enabled: true, settlement: { select: { enabled: true } } } },
            },
          },
        },
      }),
      prisma.questObjective.findMany({
        where: { itemId: { not: null } },
        select: {
          itemId: true,
          quantity: true,
          quest: {
            select: {
              id: true,
              name: true,
              enabled: true,
              npc: { select: { id: true, enabled: true, settlement: { select: { enabled: true } } } },
            },
          },
        },
      }),
      prisma.communityProjectRequirement.findMany({
        select: {
          itemId: true,
          quantity: true,
          project: {
            select: {
              id: true,
              name: true,
              enabled: true,
              settlementId: true,
              settlement: { select: { enabled: true } },
            },
          },
        },
      }),
      prisma.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      getSkillItemRules(),
    ]);

  const questLink = (row: (typeof rewards)[number]) => ({
    itemId: row.itemId,
    questId: row.quest.id,
    questName: row.quest.name,
    npcId: row.quest.npc.id,
    quantity: row.quantity,
    available: row.quest.enabled && row.quest.npc.enabled && row.quest.npc.settlement.enabled,
  });

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      sprite: item.sprite,
      rarity: item.rarity,
      itemType: item.itemType,
      equippable: item.equipTo !== null,
      requiredLevel: item.requiredLevel ?? 1,
      price: item.price,
      seed:
        item.seedYieldItemId === null
          ? null
          : {
              yieldItemId: item.seedYieldItemId,
              min: item.seedYieldMin ?? 1,
              max: item.seedYieldMax ?? item.seedYieldMin ?? 1,
              growSeconds: item.seedGrowSeconds ?? 0,
              plantable: (item.seedGrowSeconds ?? 0) > 0 && (item.seedHarvestSeconds ?? 0) > 0,
            },
    })),
    recipes: resources.map((resource) => ({
      id: resource.id,
      itemId: resource.itemId,
      skill: resource.actionType,
      name: resource.name,
      requiredSkillLevel: Math.max(1, resource.requiredSkillLevel),
      defaultSeconds: resource.defaultSeconds,
      yieldPerUnit: Math.max(1, resource.yieldPerUnit),
      xpPerUnit: resource.xpPerUnit,
      rarity: resource.rarity,
      unlockItemId: resource.requiredRecipeItemId,
      inputs: resource.requirements.map((input) => ({
        itemId: input.itemId,
        quantity: input.quantityPerUnit,
      })),
      // Gathering only rolls finds at gathering-enabled locations, and only
      // those with a chance above zero.
      locationIds: resource.locations
        .filter(
          (row) =>
            resource.actionType !== VocationalActionType.GATHERING ||
            (row.location.gatheringEnabled && row.gatheringBaseChance > 0),
        )
        .map((row) => row.locationId),
    })),
    drops: drops.map((drop) => {
      const places = [
        ...drop.creature.huntingGrounds.map((row) => row.ground.name),
        ...drop.creature.dungeons.map((row) => row.dungeon.name),
      ];
      return {
        itemId: drop.itemId,
        creatureId: drop.creature.id,
        creatureName: drop.creature.name,
        creatureKind: drop.creature.kind,
        chance: drop.baseChance,
        min: drop.minQuantity,
        max: drop.maxQuantity,
        requiredLevel: drop.requiredLevel,
        places,
        available:
          drop.enabled && drop.creature.enabled && drop.baseChance > 0 && places.length > 0,
      };
    }),
    offers: offers.map((offer) => ({
      itemId: offer.itemId,
      npcId: offer.npc.id,
      npcName: offer.npc.name,
      settlementName: offer.npc.settlement.name,
      price: Number(offer.price),
      limited: offer.availableFrom !== null || offer.availableUntil !== null,
      gated: offer.requiredProjectId !== null || offer.npc.requiredProjectId !== null,
      // A rare find whose window has closed sells nothing any more.
      available:
        offer.enabled &&
        offer.npc.enabled &&
        offer.npc.settlement.enabled &&
        (offer.availableUntil === null || offer.availableUntil > now),
    })),
    questRewards: rewards.map(questLink),
    questDeliveries: deliveries.map((row) => questLink({ ...row, itemId: row.itemId! })),
    projectNeeds: needs.map((need) => ({
      itemId: need.itemId,
      projectId: need.project.id,
      projectName: need.project.name,
      settlementId: need.project.settlementId,
      quantity: need.quantity,
      available: need.project.enabled && need.project.settlement.enabled,
    })),
    locations,
    skillRules,
  };
}
