import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MAP_OF_PIN_KIND, MAP_PIN_KINDS } from "~/game/world/maps";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { assetPath, readBody, saveError } from "../settlements/schema";

const id = z.number().int().positive();
const percent = z.number().min(0).max(100);

// The world atlas pins its locations; a location's region map pins its
// settlements, dungeons and hunting grounds; a settlement's map pins its NPCs
// and its storage. Only the pins that moved are sent.
const mapSchema = z
  .object({
    map: z.enum(["world", "location", "settlement"]),
    // The location or settlement being edited; the world atlas is row 1.
    id,
    mapImage: assetPath.nullable(),
    pins: z
      .array(
        z.object({
          kind: z.enum(MAP_PIN_KINDS),
          id,
          point: z.object({ x: percent, y: percent }).nullable(),
        }),
      )
      .max(1_000),
  })
  .refine(
    (body) => body.pins.every((pin) => MAP_OF_PIN_KIND[pin.kind] === body.map),
    { message: "A pin was sent to a map it does not belong on" },
  );

export async function PATCH(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, mapSchema);
  if ("response" in body) return body.response;
  const { map, id: mapId, mapImage, pins } = body.data;
  try {
    await prisma.$transaction(async (tx) => {
      if (map === "world") {
        await tx.atlasConfig.upsert({
          where: { id: 1 },
          create: { id: 1, mapImage },
          update: { mapImage },
        });
      } else if (map === "location") {
        await tx.location.update({ where: { id: mapId }, data: { mapImage } });
      } else {
        await tx.settlement.update({
          where: { id: mapId },
          data: { mapImage },
        });
      }
      // Each pin moves only if its place is on this map.
      for (const pin of pins) {
        const data = { mapX: pin.point?.x ?? null, mapY: pin.point?.y ?? null };
        if (pin.kind === "location") {
          await tx.location.updateMany({ where: { id: pin.id }, data });
        } else if (pin.kind === "npc") {
          await tx.npc.updateMany({
            where: { id: pin.id, settlementId: mapId },
            data,
          });
        } else if (pin.kind === "storage") {
          await tx.settlementStorage.updateMany({
            where: { id: pin.id, settlementId: mapId },
            data,
          });
        } else if (pin.kind === "settlement") {
          await tx.settlement.updateMany({
            where: { id: pin.id, locationId: mapId },
            data,
          });
        } else if (pin.kind === "dungeon") {
          await tx.dungeon.updateMany({
            where: { id: pin.id, locationId: mapId },
            data,
          });
        } else {
          await tx.huntingGround.updateMany({
            where: { id: pin.id, locationId: mapId },
            data,
          });
        }
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}
