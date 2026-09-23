import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "~/generated/prisma/client";
import {
  NpcProfession,
  QuestObjectiveType,
  QuestRepeat,
  SettlementKind,
} from "~/generated/prisma/enums";
import { MARKET_MAX_GOLD_AMOUNT } from "~/lib/marketplace";

function values<T extends string>(record: Record<string, T>) {
  return Object.values(record) as [T, ...T[]];
}

const id = z.number().int().positive();
const name = z.string().trim().min(1, "Name is required").max(120);
const description = z.string().trim().max(4_000).nullable();
// Asset paths live in VARCHAR(191) columns.
export const assetPath = z.string().trim().max(191);
const sortOrder = z.number().int().min(-10_000).max(10_000);
const gold = z.number().min(0).max(MARKET_MAX_GOLD_AMOUNT);
const fraction = z.number().min(0).max(1);

function unique<T>(rows: T[], key: (row: T) => unknown) {
  return new Set(rows.map(key)).size === rows.length;
}

export const settlementSchema = z.object({
  locationId: id,
  name,
  kind: z.enum(values(SettlementKind)),
  description,
  image: assetPath.nullable(),
  enabled: z.boolean(),
  sortOrder,
});

const offerSchema = z
  .object({
    id: id.optional(),
    itemId: id,
    price: gold,
    availableFrom: z.string().datetime().nullable(),
    availableUntil: z.string().datetime().nullable(),
    requiredProjectId: id.nullable(),
    enabled: z.boolean(),
    sortOrder,
  })
  .refine(
    (offer) =>
      (offer.availableFrom === null) === (offer.availableUntil === null) &&
      (offer.availableFrom === null ||
        new Date(offer.availableUntil!) > new Date(offer.availableFrom)),
    { message: "A rare find needs a start and a duration" },
  );

export const npcSchema = z.object({
  settlementId: id,
  name,
  description,
  portrait: assetPath.nullable(),
  // The head crop on the portrait; see Npc.headX.
  headX: fraction.nullable(),
  headY: fraction.nullable(),
  headSize: fraction.nullable(),
  profession: z.enum(values(NpcProfession)).nullable(),
  requiredProjectId: id.nullable(),
  enabled: z.boolean(),
  sortOrder,
  offers: z.array(offerSchema).max(500),
});

const objectiveSchema = z
  .object({
    type: z.enum(values(QuestObjectiveType)),
    itemId: id.nullable(),
    creatureId: id.nullable(),
    dungeonId: id.nullable(),
    quantity: z.number().int().min(1).max(1_000_000),
  })
  .refine(
    (row) =>
      row.type === "DELIVER"
        ? row.itemId !== null
        : row.type === "HUNT"
          ? row.creatureId !== null
          : row.dungeonId !== null,
    { message: "Every objective needs a target" },
  )
  // Keep only the target that matches the type.
  .transform((row) => ({
    type: row.type,
    quantity: row.quantity,
    itemId: row.type === "DELIVER" ? row.itemId : null,
    creatureId: row.type === "HUNT" ? row.creatureId : null,
    dungeonId: row.type === "CLEAR" ? row.dungeonId : null,
  }));

export const questSchema = z.object({
  npcId: id,
  name,
  description,
  repeat: z.enum(values(QuestRepeat)),
  requiredLevel: z.number().int().min(1).max(10_000),
  rewardGold: gold,
  rewardXp: z.number().int().min(0).max(10_000_000),
  requiredProjectId: id.nullable(),
  enabled: z.boolean(),
  sortOrder,
  objectives: z
    .array(objectiveSchema)
    .max(20)
    .refine(
      (rows) =>
        unique(rows, (row) =>
          [row.type, row.itemId, row.creatureId, row.dungeonId].join(":"),
        ),
      { message: "Each objective target may appear only once" },
    ),
  rewardItems: z
    .array(
      z.object({ itemId: id, quantity: z.number().int().min(1).max(100_000) }),
    )
    .max(20)
    .refine((rows) => unique(rows, (row) => row.itemId), {
      message: "Each reward item may appear only once",
    }),
});

export const projectSchema = z.object({
  settlementId: id,
  name,
  description,
  image: assetPath.nullable(),
  enabled: z.boolean(),
  sortOrder,
  requirements: z
    .array(
      z.object({
        itemId: id,
        quantity: z.number().int().min(1).max(100_000_000),
      }),
    )
    .max(50)
    .refine((rows) => unique(rows, (row) => row.itemId), {
      message: "Each item may be required only once",
    }),
});

// One storage per settlement; its slots are the stacks it holds.
export const storageSchema = z.object({
  settlementId: id,
  name,
  description,
  unlockCost: gold,
  slots: z.number().int().min(1).max(500),
  enabled: z.boolean(),
});

// The chest artwork every storage shares.
export const storageConfigSchema = z.object({ icon: assetPath.nullable() });

export function parseId(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Validated request body, or the 400 response to return. */
export async function readBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<{ data: z.output<T> } | { response: NextResponse }> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (parsed.success) return { data: parsed.data as z.output<T> };
  return {
    response: NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    ),
  };
}

/** Turns a failed save into a message an admin can act on. */
export function saveError(error: unknown) {
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
  const message =
    code === "P2002"
      ? "That name is already used here"
      : code === "P2003"
        ? "Something this refers to no longer exists. Reload the page and try again."
        : code === "P2025"
          ? "Not found. It may have been deleted."
          : error instanceof Error
            ? error.message
            : "Unable to save";
  return NextResponse.json(
    { error: message },
    { status: code === "P2025" ? 404 : 400 },
  );
}
