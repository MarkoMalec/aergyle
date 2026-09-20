import React from "react";
import { QuestsMenu } from "~/components/game/settlements/QuestsMenu";
import { useUserContext } from "~/context/userContext";
import { useUserGold } from "~/hooks/use-user-gold";
import { CoinsIcon } from "./coins-icon";

const PlayerIsland = () => {
  const { user } = useUserContext();

  // Use client-side query for real-time gold updates
  const { data: goldAmount } = useUserGold();

  // Fallback to server-side user context if query hasn't loaded yet
  const gold = goldAmount ?? (user?.gold ? Number(user.gold) : 0);
  const formattedGold = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(gold);

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-12 items-center gap-2.5 rounded-xl bg-currency/[0.07] px-3"
        aria-label={`${formattedGold} gold`}
      >
        <CoinsIcon
          size={21}
          className="shrink-0 drop-shadow-[0_2px_5px_hsl(var(--currency)/0.2)]"
        />
        <span className="grid gap-0.5 leading-none">
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-currency/65">
            Gold
          </span>
          <span className="text-sm font-semibold tabular-nums tracking-[-0.01em] text-currency">
            {formattedGold}
          </span>
        </span>
      </div>

      <QuestsMenu />
    </div>
  );
};

export default PlayerIsland;
