import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const page = Math.max(
      1,
      Number.parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1,
    );
    const limit = 40;
    const userId = session.user.id;
    const side = req.nextUrl.searchParams.get("side");
    const where =
      side === "PURCHASE"
        ? { buyerId: userId }
        : side === "SALE"
          ? { sellerId: userId }
          : { OR: [{ buyerId: userId }, { sellerId: userId }] };
    const [transactions, count] = await Promise.all([
      prisma.marketTransaction.findMany({
        where,
        include: {
          item: { select: { id: true, name: true, sprite: true } },
          buyer: { select: { name: true } },
          seller: { select: { name: true } },
        },
        orderBy: { executedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.marketTransaction.count({ where }),
    ]);

    return NextResponse.json({
      transactions: transactions.map((transaction) => ({
        ...transaction,
        side: transaction.buyerId === userId ? "PURCHASE" : "SALE",
        unitPrice: Number(transaction.unitPrice),
        grossAmount: Number(transaction.grossAmount),
        taxAmount: Number(transaction.taxAmount),
        netAmount: Number(transaction.netAmount),
      })),
      pagination: {
        page,
        limit,
        count,
        totalPages: Math.max(1, Math.ceil(count / limit)),
        hasPreviousPage: page > 1,
        hasNextPage: page * limit < count,
      },
    });
  } catch (error) {
    console.error("Error fetching marketplace history:", error);
    return NextResponse.json(
      { error: "Could not load transaction history" },
      { status: 500 },
    );
  }
}
