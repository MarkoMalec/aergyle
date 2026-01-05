import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createSchema = z.object({
  name: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const locations = await prisma.location.findMany({
    orderBy: [{ id: "desc" }],
    include: {
      _count: { select: { resources: true } },
    },
  });

  return NextResponse.json(locations);
}

export async function POST(req: NextRequest) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const created = await prisma.location.create({
      data: { name: parsed.data.name },
    });
    return NextResponse.json(created);
  } catch {
    return NextResponse.json(
      { error: "Failed to create location (name must be unique)" },
      { status: 400 },
    );
  }
}
