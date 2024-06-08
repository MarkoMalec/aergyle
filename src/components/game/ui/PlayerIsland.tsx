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

const PlayerIsland = () => {
  const { user } = useUserContext();

  return (
    <Popover>
      <PopoverTrigger>
        <Avatar>
          <AvatarImage src="/" />
          <AvatarFallback>{user?.name?.slice(0, 1)}</AvatarFallback>
        </Avatar>
      </PopoverTrigger>
      <PopoverContent>
        <h3 className="font-bold">{user?.name}</h3>
        <Separator className="mb-5 mt-5" />
        <Button onClick={() => signOut()}>Log out</Button>
      </PopoverContent>
    </Popover>
  );
};

export default PlayerIsland;
