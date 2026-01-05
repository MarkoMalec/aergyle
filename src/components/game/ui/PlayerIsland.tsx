import React from "react";
import { signOut } from "next-auth/react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";

import { useUserContext } from "~/context/userContext";
import { useUserGold } from "~/hooks/use-user-gold";
import { CoinsIcon } from "./coins-icon";
import { Badge } from "~/components/ui/badge";

const PlayerIsland = () => {
  const { user } = useUserContext();

  // Use client-side query for real-time gold updates
  const { data: goldAmount } = useUserGold();

  // Fallback to server-side user context if query hasn't loaded yet
  const gold = goldAmount ?? (user?.gold ? Number(user.gold) : 0);
  const formattedGold = gold.toFixed(2);

  return (
    <div className="flex items-center gap-4">
      <Badge className="gap-1 rounded-full bg-gray-700/60 px-4 py-2">
        <CoinsIcon size={18} />
        <span className="font-semibold text-yellow-600">{formattedGold}</span>
      </Badge>

      {/* User Menu */}
      <Popover>
        <PopoverTrigger>
          <Avatar className="h-8 w-8">
            <AvatarImage src="/" />
            <AvatarFallback>{user?.name?.slice(0, 1)}</AvatarFallback>
          </Avatar>
        </PopoverTrigger>
        <PopoverContent>
          <h3 className="font-bold">{user?.name}</h3>
          <div className="my-3 flex items-center gap-2 text-sm">
            <CoinsIcon size={16} />
            <span className="font-semibold text-yellow-600">
              {formattedGold} Gold
            </span>
          </div>
          <Separator className="mb-5 mt-5" />
          <Button onClick={() => signOut()}>Log out</Button>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default PlayerIsland;
