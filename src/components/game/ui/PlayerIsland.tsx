import React from "react";
import { QuestsMenu } from "~/components/game/settlements/QuestsMenu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useUserContext } from "~/context/userContext";
import { useUserGold } from "~/hooks/use-user-gold";
import { cn } from "~/lib/utils";
import { CoinsIcon } from "./coins-icon";

function GoldAmount({
  amount,
  iconSize,
  className,
}: {
  amount: string;
  iconSize: number;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <CoinsIcon
        size={iconSize}
        className="shrink-0 drop-shadow-[0_2px_5px_hsl(var(--currency)/0.2)]"
      />
      <span className="grid gap-0.5 leading-none">
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-currency/65">
          Gold
        </span>
        <span className="text-sm font-semibold tabular-nums tracking-[-0.01em] text-currency">
          {amount}
        </span>
      </span>
    </span>
  );
}

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
    <div className="flex shrink-0 items-center gap-1.5 xl:gap-2">
      <div
        className="hidden h-12 items-center rounded-xl bg-currency/[0.07] px-3 xl:flex"
        aria-label={`${formattedGold} gold`}
      >
        <GoldAmount amount={formattedGold} iconSize={21} />
      </div>

      {/* Below xl the header only has room for the coin; tap it for the amount. */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl bg-currency/[0.07] transition-colors duration-150 hover:bg-currency/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-currency/40 data-[state=open]:bg-currency/[0.14] xl:hidden"
            aria-label={`${formattedGold} gold`}
          >
            <CoinsIcon
              size={20}
              className="drop-shadow-[0_2px_5px_hsl(var(--currency)/0.2)]"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-auto rounded-xl border-0 bg-popover p-1.5"
        >
          <GoldAmount
            amount={formattedGold}
            iconSize={24}
            className="rounded-lg bg-currency/[0.07] py-2.5 pl-2.5 pr-4"
          />
        </PopoverContent>
      </Popover>

      <QuestsMenu />
    </div>
  );
};

export default PlayerIsland;
