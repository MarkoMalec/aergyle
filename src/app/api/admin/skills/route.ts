import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const skillSchema = z.object({
  skill_name: z.string().min(1),
  description: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const skills = await prisma.skills.findMany({
    orderBy: [{ skill_name: "asc" }],
    take: 1000,
  });

  return NextResponse.json(skills);
}

export async function POST(req: NextRequest) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = skillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const v = parsed.data;

  try {
    const created = await prisma.skills.create({
      data: {
        skill_name: v.skill_name,
        description: v.description?.trim() ? v.description.trim() : null,
      },
    });

    return NextResponse.json(created);
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to create skill (name may already exist)" },
      { status: 400 },
    );
  }
}
