import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "~/generated/prisma/client";
import {
  ItemRarity,
  ProgressionTrackType,
  StatType,
  VocationalActionType,
  XpActionType,
} from "~/generated/prisma/enums";
import {
  emailSchema,
  newPasswordSchema,
  playerNameSchema,
} from "~/lib/auth-rules";
import { MARKET_MAX_GOLD_AMOUNT } from "~/lib/marketplace";
import { PlayerEditError } from "~/server/admin/playerEdits";

export { readBody } from "../settlements/schema";

export type PlayerContext = { params: { id: string } };

function values<T extends string>(record: Record<string, T>) {
  return Object.values(record) as [T, ...T[]];
}

const id = z.number().int().positive();
/** BigInt columns (XP, lifetime totals) travel as digit strings. */
const bigCount = z
  .string()
  .trim()
  .regex(/^\d{1,18}$/, "Enter a whole number")
  .transform((value) => BigInt(value));

export const playerSchema = z.object({
  name: playerNameSchema.optional(),
  email: emailSchema.optional(),
  password: newPasswordSchema.optional(),
  gold: z
    .number()
    .min(0)
    .max(MARKET_MAX_GOLD_AMOUNT)
    .transform((gold) => Math.round(gold * 100) / 100)
    .optional(),
  level: z.number().int().min(1).max(10_000).optional(),
  experience: bigCount.optional(),
  locationId: id.nullable().optional(),
  health: z.number().min(0).max(1_000_000_000).optional(),
});

export const grantSchema = z.object({
  itemId: id,
  rarity: z.enum(values(ItemRarity)),
  quantity: z.number().int().min(1).max(1_000_000),
});

const modifierSchema = z.object({
  statType: z.enum(values(StatType)),
  value: z.number().min(-1_000_000).max(1_000_000),
});

function uniqueStats(rows: Array<{ statType: StatType }>) {
  return new Set(rows.map((row) => row.statType)).size === rows.length;
}

export const itemSchema = z.object({
  quantity: z.number().int().min(1).max(1_000_000).optional(),
  rarity: z.enum(values(ItemRarity)).optional(),
  isTradeable: z.boolean().optional(),
  modifiers: z
    .array(modifierSchema)
    .max(50)
    .refine(uniqueStats, { message: "Each stat may appear only once" })
    .optional(),
});

export const statsSchema = z.object({
  stats: z
    .array(modifierSchema)
    .max(100)
    .refine(uniqueStats, { message: "Each stat may appear only once" }),
});

const trackSchema = z.object({
  trackType: z.enum(values(ProgressionTrackType)),
  trackKey: z.string().trim().min(1).max(191),
});

export const trackEditSchema = trackSchema.extend({
  level: z.number().int().min(1).max(10_000).optional(),
  experience: bigCount.optional(),
  itemsGathered: bigCount.optional(),
  secondsSpent: bigCount.optional(),
});

export const trackResetSchema = trackSchema;

export const activitySchema = z.object({
  kind: z.enum([
    "travel",
    "vocation",
    "garden",
    "gathering",
    "hunting",
    "dungeon",
  ]),
  action: z.enum(["complete", "cancel"]),
});

export const tileSchema = z.object({ tileId: id });

export const effectSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("food"),
    itemId: id,
    minutes: z.number().int().min(1).max(525_600),
  }),
  z.object({
    type: z.literal("multiplier"),
    name: z.string().trim().min(1, "Name the multiplier").max(191),
    multiplier: z.number().min(0).max(1_000),
    actionType: z.enum(values(XpActionType)).nullable(),
    vocationalActionType: z.enum(values(VocationalActionType)).nullable(),
    expiresAt: z
      .string()
      .datetime()
      .transform((value) => new Date(value))
      .nullable(),
    usesRemaining: z.number().int().min(1).max(1_000_000).nullable(),
    stackable: z.boolean(),
  }),
]);

export const effectRemoveSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("food") }),
  z.object({ type: z.literal("multiplier"), id }),
]);

export const questSchema = z.object({
  userQuestId: id,
  completed: z.boolean(),
});

export const questRemoveSchema = z.object({ userQuestId: id });

export const recipeSchema = z.object({ itemId: id });

export const storageGrantSchema = z.object({ storageId: id });

export const storageRemoveSchema = z.object({ userStorageId: id });

export const buyOrderSchema = z.object({ orderId: id, refund: z.boolean() });

export const notificationSchema = z.object({ id: id.optional() });

export const messageSchema = z.union([
  z.object({ conversationId: id }),
  z.object({ messageId: id }),
]);

export function parseItemId(value: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function errorResponse(error: unknown) {
  if (error instanceof PlayerEditError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
  if (code === "P2002") {
    return NextResponse.json(
      { error: "Another account already uses that" },
      { status: 409 },
    );
  }
  if (code === "P2003") {
    return NextResponse.json(
      { error: "Something this refers to no longer exists. Reload the page." },
      { status: 409 },
    );
  }
  if (code === "P2025") {
    return NextResponse.json(
      { error: "Not found. Reload the page." },
      { status: 404 },
    );
  }
  console.error("Admin player edit failed:", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Unable to save" },
    { status: 400 },
  );
}

/** Runs one player edit and turns its outcome into the response. */
export async function runEdit(work: () => Promise<unknown>) {
  try {
    const result = await work();
    return NextResponse.json({
      ok: true,
      ...(result && typeof result === "object" ? result : {}),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
