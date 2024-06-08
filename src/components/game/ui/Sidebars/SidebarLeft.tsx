import React from "react";
import { Button } from "~/components/ui/button";
import Link from "next/link";

const SidebarLeft = () => {
  return (
    <aside className="h-[calc(100vh-66px)] w-[250px] bg-[grey] p-10">
      <ul>
        <li>
          <Button asChild variant="ghost" className="w-full">
            <Link title="character screen" href="/character">
              Character
            </Link>
          </Button>
        </li>
        <li></li>
        <li></li>
      </ul>
    </aside>
  );
};

export default SidebarLeft;
