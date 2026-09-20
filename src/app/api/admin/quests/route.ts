import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { questSchema, readBody, saveError } from "../settlements/schema";

export async function POST(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const body = await readBody(request, questSchema);
  if ("response" in body) return body.response;
  const { objectives, rewardItems, ...quest } = body.data;
  try {
    const created = await prisma.quest.create({
      data: {
        ...quest,
        objectives: { create: objectives },
        rewardItems: { create: rewardItems },
      },
    });
    return NextResponse.json({ ok: true, quest: created });
  } catch (error) {
    return saveError(error);
  }
}
