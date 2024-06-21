"use server"

import React from "react";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { HomeIcon } from "lucide-react";
import { prisma } from "~/lib/prisma";

const SidebarLeft = async () => {
  const skills = await prisma.skills.findMany();

  return (
    <aside className="h-[calc(100vh-51px)] w-[50px] overflow-x-hidden overflow-y-scroll border-r border-white/5 pb-5 pt-5 transition-all hover:w-[250px] hover:bg-white/5 hover:p-5">
      <div className="space-y-2">
        {/* <h3 className="text-center text-lg font-bold">General</h3> */}
        <Button asChild variant="menu" className="w-full justify-start">
          <Link
            className="min-w-[90px]"
            title="character screen"
            href="/character"
          >
            <HomeIcon className="mr-4 min-h-5 min-w-5" /> Character
          </Link>
        </Button>
        <Button asChild variant="menu" className="w-full justify-start">
          <Link title="character screen" href="/character">
            <HomeIcon className="mr-4 min-h-5 min-w-5" /> Inventory
          </Link>
        </Button>
      </div>
      <div className="space-y-2 py-10">
        {skills.map(skill => (
          <Button asChild variant="menu" className="w-full justify-start">
          <Link
            className="min-w-[90px]"
            title={skill.skill_name}
            href={`/skills/${skill.skill_name}`}
          >
            <HomeIcon className="mr-4 min-h-5 min-w-5" /> {skill.skill_name}
          </Link>
        </Button>
        ))}
        {/* <h3 className="text-center text-lg font-bold">Vocation</h3> */}
        
      </div>
    </aside>
  );
};

export default SidebarLeft;
