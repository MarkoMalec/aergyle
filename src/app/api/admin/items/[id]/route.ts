import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { itemSchema, parseItemInput, writeItemBalance } from "../schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  let input: ReturnType<typeof parseItemInput>;
  try {
    input = parseItemInput(parsed.data);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid item balance",
      },
      { status: 400 },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.item.update({ where: { id }, data: input.item });
    await writeItemBalance(tx, id, input.balance, { replace: true });
    return item;
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await prisma.item.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to delete item (it may be referenced elsewhere)" },
      { status: 400 },
    );
  }
}
