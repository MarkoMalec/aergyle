import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";

/** Cancel an open bid and release only its still-unspent reserve. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId: rawOrderId } = await params;
    const orderId = Number(rawOrderId);
    if (!Number.isInteger(orderId) || orderId < 1) {
      return NextResponse.json({ error: "Invalid order" }, { status: 400 });
    }

    const refund = await prisma.$transaction(async (tx) => {
      const order = await tx.marketBuyOrder.findFirst({
        where: { id: orderId, userId: session.user.id, status: "OPEN" },
      });
      if (!order) throw new Error("ORDER_NOT_FOUND");

      const cancelled = await tx.marketBuyOrder.updateMany({
        where: {
          id: order.id,
          userId: session.user.id,
          status: "OPEN",
          remainingQuantity: order.remainingQuantity,
        },
        data: { status: "CANCELLED", reservedGold: 0 },
      });
      if (cancelled.count !== 1) throw new Error("ORDER_CHANGED");

      const amount = Number(order.reservedGold);
      if (amount > 0) {
        await tx.user.update({
          where: { id: session.user.id },
          data: { gold: { increment: amount } },
        });
      }
      return amount;
    });

    return NextResponse.json({
      success: true,
      message: `Buy order cancelled. ${refund.toFixed(2)} gold returned.`,
      refund,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "ORDER_NOT_FOUND") {
      return NextResponse.json(
        { error: "This buy order is no longer open" },
        { status: 409 },
      );
    }
    if (message === "ORDER_CHANGED") {
      return NextResponse.json(
        { error: "This order changed while it was being cancelled" },
        { status: 409 },
      );
    }
    console.error("Error cancelling marketplace buy order:", error);
    return NextResponse.json(
      { error: "Could not cancel the buy order" },
      { status: 500 },
    );
  }
}
