import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { npcSchema, readBody, saveError } from "../settlements/schema";

export async function POST(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, npcSchema);
  if ("response" in body) return body.response;
  const { offers, ...npc } = body.data;
  try {
    const created = await prisma.npc.create({
      data: {
        ...npc,
        offers: { create: offers.map(({ id: _id, ...offer }) => offer) },
      },
    });
    return NextResponse.json({ ok: true, npc: created });
  } catch (error) {
    return saveError(error);
  }
}
