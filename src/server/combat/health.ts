import "server-only";

import type { PrismaClient } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";
import {
  getCharacterStatSnapshot,
  type CharacterStatSnapshot,
} from "~/server/stats";
import { resolveRegeneratedHealth } from "./healthMath";

export {
  calculateHealthAfterDamage,
  resolveRegeneratedHealth,
} from "./healthMath";

type HealthDb = Pick<PrismaClient, "characterHealth">;

export type CharacterVitals = {
  currentHealth: number;
  maxHealth: number;
  healthRegen: number;
  regeneratedAt: string;
  percent: number;
};

export async function getCharacterVitalsFromSnapshot(
  userId: string,
  character: Pick<CharacterStatSnapshot, "finalStats">,
  now = new Date(),
): Promise<CharacterVitals> {
  const stored = await prisma.characterHealth.findUnique({ where: { userId } });
  const maxHealth = character.finalStats.health;
  const healthRegen = character.finalStats.healthRegen;
  const currentHealth = stored
    ? resolveRegeneratedHealth({
        currentHealth: stored.currentHealth,
        maxHealth,
        healthRegen,
        regeneratedAt: stored.regeneratedAt,
        now,
      })
    : maxHealth;

  return {
    currentHealth,
    maxHealth,
    healthRegen,
    regeneratedAt: now.toISOString(),
    percent: maxHealth <= 0 ? 0 : (currentHealth / maxHealth) * 100,
  };
}

export async function getCharacterVitals(
  userId: string,
  now = new Date(),
): Promise<CharacterVitals> {
  const character = await getCharacterStatSnapshot(userId);
  return getCharacterVitalsFromSnapshot(userId, character, now);
}

export async function writeCharacterHealth(params: {
  db?: HealthDb;
  userId: string;
  currentHealth: number;
  at: Date;
}) {
  const db = params.db ?? prisma;
  return db.characterHealth.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      currentHealth: Math.max(0, params.currentHealth),
      regeneratedAt: params.at,
    },
    update: {
      currentHealth: Math.max(0, params.currentHealth),
      regeneratedAt: params.at,
    },
  });
}
