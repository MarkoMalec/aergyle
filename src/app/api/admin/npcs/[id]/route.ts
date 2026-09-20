import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { npcSchema, parseId, readBody, saveError } from "../../settlements/schema";

type Context = { params: { id: string } };

export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) return NextResponse.json({ error: "Invalid NPC" }, { status: 400 });
  const body = await readBody(request, npcSchema);
  if ("response" in body) return body.response;
  const { offers, ...npc } = body.data;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.npc.update({ where: { id }, data: npc });
      // Offers keep their ids, so a player mid-purchase is unaffected.
      await tx.npcOffer.deleteMany({
        where: {
          npcId: id,
          id: { notIn: offers.flatMap((offer) => offer.id ?? []) },
        },
      });
      for (const { id: offerId, ...offer } of offers) {
        if (offerId) {
          await tx.npcOffer.update({
            where: { id: offerId, npcId: id },
            data: offer,
          });
        } else {
          await tx.npcOffer.create({ data: { ...offer, npcId: id } });
        }
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}

// Removes the NPC's shop and quests, including players' quest progress.
export async function DELETE(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) return NextResponse.json({ error: "Invalid NPC" }, { status: 400 });
  try {
    await prisma.npc.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}
