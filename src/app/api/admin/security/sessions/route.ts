import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "~/lib/prisma";
import { getAdminSession, requireAdminApiAccess } from "~/server/admin/auth";

/** Ends one of your own sessions (`{ sessionId }`), or every other one. */
export async function DELETE(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    sessionId?: unknown;
  } | null;
  const sessionId =
    typeof body?.sessionId === "string" ? body.sessionId : null;

  const { count } = await prisma.adminSession.updateMany({
    where: sessionId
      ? { id: sessionId, adminId: admin.adminId, revokedAt: null }
      : {
          adminId: admin.adminId,
          revokedAt: null,
          id: { not: admin.sessionId },
        },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true, revoked: count });
}
