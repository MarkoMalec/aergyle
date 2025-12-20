"use server";

import React from "react";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import {
  HomeIcon,
  LucideShoppingBag,
  Shirt,
  UserRound,
  TreeDeciduous,
} from "lucide-react";
import { prisma } from "~/lib/prisma";
import Image from "next/image";

const SidebarLeft = async () => {
  const skills = await prisma.skills.findMany();

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-background">
      <div className="flex items-center space-x-4 border-b border-white/10 px-4 py-3">
        <Image
          src="/assets/logo/aergyle-logo.png"
          alt="Game Logo"
          width={64}
          height={64}
          className="grayscale-[1] invert-[1]"
        />
        <span>Aergyle</span>
      </div>
      <div className="space-y-1 mt-10">
        {/* <h3 className="text-center text-lg font-bold">General</h3> */}
        <Button asChild variant="menu" className="w-full justify-start">
          <Link
            className="min-w-[90px]"
            title="profile screen"
            href="/profile"
          >
            <UserRound className="mr-4 min-h-5 min-w-5" strokeWidth={1} />{" "}
            Profile
          </Link>
        </Button>
        <Button asChild variant="menu" className="w-full justify-start">
          <Link title="character screen" href="/character">
            <Shirt className="mr-4 min-h-5 min-w-5" strokeWidth={1} /> Inventory
          </Link>
        </Button>
      </div>
      <div className="space-y-2 py-10">
        {skills.map((skill) => (
          <Button asChild variant="menu" className="w-full justify-start">
            <Link
              className="min-w-[90px]"
              title={skill.skill_name}
              href={`/skills/${skill.skill_name}`}
            >
              <TreeDeciduous className="mr-4 min-h-5 min-w-5" strokeWidth={1} />{" "}
              {skill.skill_name}
            </Link>
          </Button>
        ))}
        <div className="space-y-2 py-10">
          <Button asChild variant="menu" className="w-full justify-start">
            <Link
              className="min-w-[90px]"
              title="character screen"
              href="/marketplace"
            >
              <LucideShoppingBag
                className="mr-4 min-h-5 min-w-5"
                strokeWidth={1}
              />{" "}
              Marketplace
            </Link>
          </Button>
        </div>
        {/* <h3 className="text-center text-lg font-bold">Vocation</h3> */}
      </div>
    </aside>
  );
};

export default SidebarLeft;
