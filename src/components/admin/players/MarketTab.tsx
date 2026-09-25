"use client";

import React from "react";
import { Panel } from "~/components/admin/fields";
import { ItemActions } from "./ItemsTab";
import {
  ActionButton,
  Empty,
  formatDate,
  formatGold,
  humanize,
  ItemArt,
  Row,
  Tag,
  usePlayerEdit,
} from "./shared";

function Listings() {
  const { player } = usePlayerEdit();
  const listings = player.items.filter((item) => item.status === "LISTED");
  return (
    <Panel
      title="Listings"
      description="Items they have up for sale. To bag takes one off the market."
    >
      {listings.length === 0 ? (
        <Empty>Nothing listed.</Empty>
      ) : (
        <div className="space-y-2">
          {listings.map((item) => (
            <Row key={item.id} className="py-2">
              <ItemArt sprite={item.sprite} rarity={item.rarity} quantity={item.quantity} />
              <div className="min-w-0 flex-1 text-sm">
                {item.name}
                <div className="text-xs text-white/50">
                  {humanize(item.rarity)} · {formatGold(item.listedPrice ?? 0)} gold each
                </div>
              </div>
              <ItemActions item={item} />
            </Row>
          ))}
        </div>
      )}
    </Panel>
  );
}

function BuyOrders() {
  const { player, run } = usePlayerEdit();
  return (
    <Panel
      title="Buy orders"
      description="Gold is held when an order is placed. Cancelling can return what's still held, or keep it from them."
    >
      {player.buyOrders.length === 0 ? (
        <Empty>No buy orders.</Empty>
      ) : (
        <div className="space-y-2">
          {player.buyOrders.map((order) => (
            <Row key={order.id} className="py-2">
              <ItemArt sprite={order.item.sprite} rarity={order.rarity} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {order.item.name}
                  <Tag tone={order.status === "OPEN" ? "info" : "neutral"}>
                    {humanize(order.status)}
                  </Tag>
                </div>
                <div className="text-xs text-white/50">
                  {humanize(order.rarity)} · {order.quantity - order.remaining} of{" "}
                  {order.quantity} bought at {formatGold(order.pricePerItem)} ·{" "}
                  {formatGold(order.reservedGold)} gold held · {formatDate(order.createdAt)}
                </div>
              </div>
              {order.status === "OPEN" ? (
                <>
                  <ActionButton
                    actionKey={`refund-${order.id}`}
                    onClick={() =>
                      run(
                        `refund-${order.id}`,
                        "/buy-orders",
                        "DELETE",
                        { orderId: order.id, refund: true },
                        `Cancelled; ${formatGold(order.reservedGold)} gold returned`,
                      )
                    }
                  >
                    Cancel &amp; refund
                  </ActionButton>
                  <ActionButton
                    actionKey={`void-${order.id}`}
                    variant="ghost"
                    confirm={`Cancel without returning the ${formatGold(order.reservedGold)} gold it holds?`}
                    onClick={() =>
                      run(
                        `void-${order.id}`,
                        "/buy-orders",
                        "DELETE",
                        { orderId: order.id, refund: false },
                        "Cancelled; gold kept",
                      )
                    }
                  >
                    Cancel, keep gold
                  </ActionButton>
                </>
              ) : null}
            </Row>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Trades() {
  const { player } = usePlayerEdit();
  return (
    <Panel
      title="Trade history"
      description="Their last 100 market trades. Read only: the other player's side depends on it."
    >
      {player.transactions.length === 0 ? (
        <Empty>No trades.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs text-white/45">
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="px-3 py-2 font-medium" />
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Each</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="py-2 pl-3 font-medium">With</th>
              </tr>
            </thead>
            <tbody>
              {player.transactions.map((row) => (
                <tr key={row.id} className="even:bg-white/[0.02]">
                  <td className="whitespace-nowrap py-1 pr-3 text-xs text-white/60">
                    {formatDate(row.executedAt)}
                  </td>
                  <td className="px-3 py-1">
                    <Tag tone={row.side === "BOUGHT" ? "info" : "good"}>
                      {row.side === "BOUGHT" ? "Bought" : "Sold"}
                    </Tag>
                  </td>
                  <td className="px-3 py-1">
                    {row.quantity.toLocaleString()} × {row.item.name}{" "}
                    <span className="text-xs text-white/40">{humanize(row.rarity)}</span>
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">
                    {formatGold(row.unitPrice)}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">
                    {row.side === "BOUGHT" ? "−" : "+"}
                    {formatGold(row.amount)}
                  </td>
                  <td className="py-1 pl-3 text-xs text-white/60">
                    {row.with ?? "Deleted player"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function MarketTab() {
  return (
    <div className="space-y-6">
      <Listings />
      <BuyOrders />
      <Trades />
    </div>
  );
}
