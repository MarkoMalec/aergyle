import "server-only";

import { cache } from "react";
import type { StatType } from "~/generated/prisma/enums";
import type { ActiveFoodEffect } from "~/hooks/use-active-food-effect";
import { MAX_BIO_LENGTH, playerName } from "~/game/players";
import { prisma } from "~/lib/prisma";
import { getCharacterVitalsFromSnapshot } from "~/server/combat";
import {
  getVocationSummaries,
  type VocationSummary,
} from "~/server/skills/overview";
import { getCharacterStatSnapshot } from "~/server/stats";
import type { EquipmentSlotsWithItems } from "~/types/inventory";
import type { ComputedStats } from "~/types/stats";
import { readEquipmentWithItems } from "~/utils/inventory";
import { getXpProgress } from "~/utils/leveling";
import type { LevelProgress } from "~/utils/xpCurve";
import { getPublicActivity, type PublicActivity } from "./activity";
import { getDailyActivity, type DailyActivityPoint } from "./dailyActivity";

type StatRecord = Record<StatType, number>;

/** A character sheet as the server resolved it, for a read-only view. */
export type PlayerSheetData = {
  base: StatRecord;
  gear: StatRecord;
  meal: Partial<StatRecord>;
  totals: StatRecord;
  computed: ComputedStats;
  mealEffect: ActiveFoodEffect | null;
};

export type PlayerProfile = {
  id: string;
  name: string;
  image: string | null;
  bio: string | null;
  createdAt: string;
  lastOnline: string;
  location: string | null;
  level: LevelProgress;
  currentHealth: number;
  sheet: PlayerSheetData;
  equipment: EquipmentSlotsWithItems;
  vocations: VocationSummary[];
  activity: PublicActivity | null;
  /** The last 30 days, oldest first. */
  history: DailyActivityPoint[];
};

const HISTORY_DAYS = 30;

/**
 * Everything another player may see of a character: worn gear but never the
 * inventory, and nothing that settles or changes the character's state.
 * Cached per request, so the page and its metadata share one read.
 */
export const getPlayerProfile = cache(async function getPlayerProfile(
  playerId: string,
): Promise<PlayerProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      createdAt: true,
      last_online: true,
      currentLocation: { select: { name: true } },
    },
  });
  if (!user) return null;

  const snapshotRead = getCharacterStatSnapshot(playerId);
  const [level, snapshot, vitals, equipment, vocations, activity, history] =
    await Promise.all([
      getXpProgress(playerId),
      snapshotRead,
      snapshotRead.then((snapshot) =>
        getCharacterVitalsFromSnapshot(playerId, snapshot),
      ),
      readEquipmentWithItems(playerId),
      getVocationSummaries(playerId),
      getPublicActivity(playerId),
      getDailyActivity(playerId, HISTORY_DAYS),
    ]);

  const effect = snapshot.activeEffect;
  const meal: Partial<StatRecord> = {};
  for (const stat of effect?.item.foodEffectStats ?? []) {
    meal[stat.statType] = (meal[stat.statType] ?? 0) + stat.value;
  }

  return {
    id: user.id,
    name: playerName(user.name),
    image: user.image,
    bio: user.bio,
    createdAt: user.createdAt.toISOString(),
    lastOnline: user.last_online.toISOString(),
    location: user.currentLocation?.name ?? null,
    level,
    currentHealth: vitals.currentHealth,
    sheet: {
      base: snapshot.baseStats,
      gear: snapshot.equipmentBonuses,
      meal,
      totals: snapshot.totals,
      computed: snapshot.finalStats,
      mealEffect: effect
        ? {
            ...effect,
            startedAt: effect.startedAt.toISOString(),
            endsAt: effect.endsAt.toISOString(),
          }
        : null,
    },
    equipment,
    vocations,
    activity,
    history,
  };
});

/** Sets or clears the player's own bio. */
export async function updateBio(userId: string, bio: string) {
  const text = bio.trim().replace(/\n{3,}/g, "\n\n");
  if (text.length > MAX_BIO_LENGTH) {
    throw new Error(`A bio is at most ${MAX_BIO_LENGTH} characters`);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { bio: text.length > 0 ? text : null },
  });
  return { bio: text.length > 0 ? text : null };
}
