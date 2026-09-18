"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Anvil,
  Axe,
  Backpack,
  Castle,
  Compass,
  Crosshair,
  Fish,
  Leaf,
  Menu,
  PawPrint,
  Pickaxe,
  Ruler,
  Scissors,
  ScrollText,
  ShoppingBag,
  Skull,
  Sprout,
  Swords,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";

const skillIcons: Record<string, LucideIcon> = {
  woodcutting: Axe,
  mining: Pickaxe,
  fishing: Fish,
  blacksmithing: Anvil,
  weaponsmithing: Swords,
  carpentry: Ruler,
  gathering: Leaf,
  hunting: Crosshair,
  gardening: Sprout,
  tailoring: Scissors,
};

type NavigationSkill = {
  name: string;
  category: "VOCATION" | "CRAFTING";
};

export default function GameNavigation({
  skills,
}: {
  skills: NavigationSkill[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const skillLinks = (category: NavigationSkill["category"]) =>
    skills
      .filter((skill) => skill.category === category)
      .map(({ name }) => ({
        label: name,
        href: `/skills/${encodeURIComponent(name)}`,
        icon: skillIcons[name.toLowerCase()] ?? Leaf,
      }));
  const groups = [
    {
      title: "Your adventure",
      links: [
        { label: "Character", href: "/profile", icon: UserRound },
        { label: "Inventory", href: "/profile#inventory", icon: Backpack },
        { label: "World atlas", href: "/map", icon: Compass },
        { label: "Dungeons", href: "/dungeons", icon: Castle },
      ],
    },
    {
      title: "Bestiary",
      links: [
        // Nested: creature profiles live below these pages.
        { label: "Animals", href: "/animals", icon: PawPrint, nested: true },
        { label: "Monsters", href: "/monsters", icon: Skull, nested: true },
      ],
    },
    {
      title: "Vocations",
      links: skillLinks("VOCATION"),
    },
    {
      title: "Crafting",
      links: skillLinks("CRAFTING"),
    },
    {
      title: "Trading",
      links: [
        { label: "Marketplace", href: "/marketplace", icon: ShoppingBag },
        {
          label: "My orders",
          href: "/marketplace/my-listings",
          icon: ScrollText,
        },
      ],
    },
  ];

  const contents = (
    <>
      <Link
        href="/profile"
        className="game-brand"
        onClick={() => setOpen(false)}
        aria-label="Aergyle character"
      >
        <Image
          src="/assets/logo/aergyle-logo.png"
          alt=""
          width={46}
          height={38}
        />
        <span>
          <span className="game-wordmark">Aergyle</span>
        </span>
      </Link>
      <nav className="game-nav-scroll" aria-label="Game navigation">
        {groups
          .filter((group) => group.links.length > 0)
          .map((group) => (
            <div className="game-nav-group" key={group.title}>
              <p className="game-nav-label">{group.title}</p>
              {group.links.map((link) => {
                const { label, href, icon: Icon } = link;
                const current = decodeURIComponent(pathname);
                const target = decodeURIComponent(href);
                const selected =
                  current === target ||
                  ("nested" in link &&
                    link.nested &&
                    current.startsWith(`${target}/`));
                return (
                  <Link
                    key={href}
                    href={href}
                    className="game-nav-link"
                    onClick={() => setOpen(false)}
                    aria-current={selected ? "page" : undefined}
                  >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
      </nav>
      <div className="game-sidebar-footer">
        <Compass className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
        One journey. Many callings.
      </div>
    </>
  );

  return (
    <>
      <aside className="game-sidebar">{contents}</aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="game-mobile-trigger md:hidden"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex w-[min(300px,88vw)] flex-col gap-0 bg-sidebar p-0"
        >
          <SheetTitle className="sr-only">Aergyle navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Your character, world, dungeons, bestiary, vocations and
            marketplace.
          </SheetDescription>
          {contents}
        </SheetContent>
      </Sheet>
    </>
  );
}
