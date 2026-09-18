import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { huntingDurationSchema } from "./schema";

export async function POST(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const parsed = huntingDurationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  try {
    const duration = await prisma.huntingDuration.create({ data: parsed.data });
    return NextResponse.json({ ok: true, duration });
  } catch {
    return NextResponse.json(
      { error: "A duration with that label or time already exists" },
      { status: 400 },
    );
  }
}
