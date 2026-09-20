import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { parseId, questSchema, readBody, saveError } from "../../settlements/schema";

type Context = { params: { id: string } };

export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) return NextResponse.json({ error: "Invalid quest" }, { status: 400 });
  const body = await readBody(request, questSchema);
  if ("response" in body) return body.response;
  const { objectives, rewardItems, ...quest } = body.data;
  try {
    // Player progress is keyed by target, so objectives can be rewritten.
    await prisma.$transaction(async (tx) => {
      await tx.quest.update({ where: { id }, data: quest });
      await tx.questObjective.deleteMany({ where: { questId: id } });
      await tx.questObjective.createMany({
        data: objectives.map((objective) => ({ ...objective, questId: id })),
      });
      await tx.questRewardItem.deleteMany({ where: { questId: id } });
      await tx.questRewardItem.createMany({
        data: rewardItems.map((reward) => ({ ...reward, questId: id })),
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}

// Removes every player's progress on this quest.
export async function DELETE(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) return NextResponse.json({ error: "Invalid quest" }, { status: 400 });
  try {
    await prisma.quest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return saveError(error);
  }
}
