import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession, requireAdminApiAccess } from "~/server/admin/auth";
import { reviewReport } from "~/server/communication";

type Context = { params: { id: string } };

/** Closes a report as handled ("RESOLVED") or as nothing to answer for. */
export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
    note?: unknown;
  } | null;
  if (body?.status !== "RESOLVED" && body?.status !== "DISMISSED") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  try {
    return NextResponse.json({
      ok: true,
      report: await reviewReport({
        reportId: id,
        reviewerAdminId: admin.adminId,
        status: body.status,
        note: typeof body.note === "string" ? body.note : undefined,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save" },
      { status: 400 },
    );
  }
}
