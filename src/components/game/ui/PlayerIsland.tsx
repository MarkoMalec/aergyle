import React from "react";
import { signOut } from "next-auth/react";
import { ChevronDown, LogOut } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

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
  const playerName = user?.name?.trim() || "Player";
  const playerInitial = playerName.slice(0, 1).toUpperCase();

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

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group flex h-12 items-center gap-1.5 rounded-xl bg-card/70 p-1.5 pl-2 shadow-[var(--shadow-panel)] transition-colors duration-150 hover:bg-secondary/80 focus-visible:outline-none data-[state=open]:bg-secondary"
            aria-label={`Open ${playerName}'s player menu`}
          >
            <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-gradient-to-br from-primary/25 to-accent text-sm font-bold text-primary shadow-inner">
              {playerInitial}
            </span>
            <ChevronDown
              size={14}
              className="mr-0.5 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180"
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-64 rounded-xl border-0 bg-popover p-2"
        >
          <div className="rounded-lg bg-surface-inset/70 p-3">
            <p className="font-semibold text-foreground">{playerName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Player account
            </p>
            <span className="mt-3 flex items-center gap-2 text-sm">
              <CoinsIcon size={16} />
              <span className="font-semibold tabular-nums text-currency">
                {formattedGold} Gold
              </span>
            </span>
          </div>
          <Button
            variant="ghost"
            className="mt-1 w-full justify-start border-0 px-3 text-muted-foreground hover:text-foreground"
            onClick={() => signOut()}
          >
            <LogOut size={15} aria-hidden="true" />
            Log out
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default PlayerIsland;
