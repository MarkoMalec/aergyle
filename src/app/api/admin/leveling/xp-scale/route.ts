import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { VocationalActionType } from "~/generated/prisma/enums";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { scaleGroupXp } from "~/server/balance/leveling";

const schema = z.object({
  group: z.union([
    z.nativeEnum(VocationalActionType),
    z.literal("DUNGEONS"),
    z.literal("QUESTS"),
  ]),
  factor: z
    .number()
    .finite()
    .gt(0, "The factor must be above 0")
    .max(100, "The factor can be at most 100")
    .refine((factor) => factor !== 1, "A factor of 1 changes nothing"),
});

// Rewrites a group's stored XP rewards; what players see updates with them.
export async function POST(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const changed = await scaleGroupXp(parsed.data.group, parsed.data.factor);
  return NextResponse.json({ ok: true, changed });
}
