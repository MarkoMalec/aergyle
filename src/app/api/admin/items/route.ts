import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { itemSchema, parseItemInput, writeItemBalance } from "./schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const items = await prisma.item.findMany({
    orderBy: [{ id: "desc" }],
    take: 500,
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

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

  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.item.create({ data: input.item });
    await writeItemBalance(tx, item.id, input.balance, { replace: false });
    return item;
  });

  return NextResponse.json(created);
}
