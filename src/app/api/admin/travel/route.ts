import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";

const MAX_SECONDS = 7 * 24 * 60 * 60;

const schema = z.object({
  defaultSeconds: z.number().int().min(1).max(MAX_SECONDS),
  routes: z
    .array(
      z
        .object({
          locationAId: z.number().int(),
          locationBId: z.number().int(),
          seconds: z.number().int().min(1).max(MAX_SECONDS),
        })
        .refine((route) => route.locationAId < route.locationBId, {
          message: "Routes must list the lower location id first",
        }),
    )
    .refine(
      (routes) =>
        new Set(routes.map((r) => `${r.locationAId}:${r.locationBId}`)).size ===
        routes.length,
      { message: "Each location pair can be saved only once" },
    ),
});

// The editor sends the whole grid: pairs left out fall back to the default.
// Journeys already underway keep the arrival time they started with.
export async function PATCH(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const { defaultSeconds, routes } = parsed.data;
  try {
    await prisma.$transaction([
      prisma.travelConfig.upsert({
        where: { id: 1 },
        create: { id: 1, secondsPerTravel: defaultSeconds },
        update: { secondsPerTravel: defaultSeconds },
      }),
      prisma.travelRoute.deleteMany(),
      prisma.travelRoute.createMany({ data: routes }),
    ]);
  } catch {
    return NextResponse.json(
      { error: "Failed to save routes (a location may have been deleted)" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
