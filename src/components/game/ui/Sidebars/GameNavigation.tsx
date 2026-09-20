"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Menu } from "lucide-react";
import { NewQuestsDot } from "~/components/game/settlements/NewQuestsDot";
import { addSkillProgressEventListener } from "~/components/game/skills/skillProgressEvents";
import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import type { SkillLevels } from "~/server/skills/levels";
import { GameSearch } from "./GameSearch";
import { SidebarHeader } from "./SidebarHeader";
import {
  buildNavigationGroups,
  isLinkSelected,
  type NavigationSkill,
} from "./navigation-links";

export default function GameNavigation({
  skills,
  initialSkillLevels,
}: {
  skills: NavigationSkill[];
  initialSkillLevels: SkillLevels;
}) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => buildNavigationGroups(skills), [skills]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) {
        return;
      }
      event.preventDefault();
      setSearchOpen((wasOpen) => !wasOpen);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // The same event the skill pages use when XP lands, so a level-up shows here.
  useEffect(
    () =>
      addSkillProgressEventListener(() => {
        void queryClient.invalidateQueries({ queryKey: ["skill-levels"] });
      }),
    [queryClient],
  );

  const levels = useQuery({
    queryKey: ["skill-levels"],
    queryFn: async (): Promise<SkillLevels> => {
      const response = await fetch("/api/skills/levels", { cache: "no-store" });
      if (!response.ok) throw new Error("Error fetching skill levels");
      return (await response.json()) as SkillLevels;
    },
    initialData: initialSkillLevels,
    staleTime: Infinity,
  });

  const close = () => setOpen(false);

  const contents = (
    <>
      <SidebarHeader
        groups={groups}
        onSearch={() => {
          close();
          setSearchOpen(true);
        }}
        onNavigate={close}
      />
      <nav className="game-nav-scroll" aria-label="Game navigation">
        {groups.map((group) => (
          <Collapsible
            className="game-nav-group"
            key={group.title}
            open={!collapsed[group.title]}
            onOpenChange={(isOpen) =>
              setCollapsed((state) => ({ ...state, [group.title]: !isOpen }))
            }
          >
            <CollapsibleTrigger className="game-nav-label">
              {group.title}
              <ChevronDown aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              {group.links.map((link) => {
                const { label, href, icon: Icon, trackKey } = link;
                const level = trackKey ? levels.data?.[trackKey] : undefined;
                return (
                  <Link
                    key={href}
                    href={href}
                    className="game-nav-link"
                    onClick={close}
                    aria-current={
                      isLinkSelected(link, pathname) ? "page" : undefined
                    }
                  >
                    <Icon aria-hidden="true" />
                    <span className="game-nav-text">{label}</span>
                    {trackKey ? (
                      <span className="game-nav-level">Lv. {level ?? 1}</span>
                    ) : null}
                    {href === "/region" ? <NewQuestsDot /> : null}
                  </Link>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </nav>
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
            {/* The Region link's dot is out of sight in the closed menu. */}
            <NewQuestsDot />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex w-[min(300px,88vw)] flex-col gap-0 bg-sidebar p-0"
        >
          <SheetTitle className="sr-only">Aergyle navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Your character, the world, settlements, dungeons, bestiary,
            vocations and marketplace.
          </SheetDescription>
          {contents}
        </SheetContent>
      </Sheet>
      <GameSearch
        groups={groups}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />
    </>
  );
}
