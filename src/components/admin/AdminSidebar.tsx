"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "~/components/ui/sidebar";

type NavItem = { href: string; label: string; also?: string[] };

// Grouped by what you are doing: building the world, balancing what players
// do in it, the item catalogue, progression, and people.
const adminNavGroups: Array<{ label: string; items: NavItem[] }> = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard" }] },
  {
    label: "World",
    items: [
      {
        href: "/admin/world",
        label: "Regions, settlements & NPCs",
        also: ["/admin/settlements", "/admin/npcs"],
      },
    ],
  },
  {
    label: "Activities (game-wide)",
    items: [
      { href: "/admin/dungeons", label: "Dungeons & monsters" },
      { href: "/admin/hunting", label: "Hunting & animals" },
      { href: "/admin/gathering", label: "Gathering" },
      { href: "/admin/gardening", label: "Gardening" },
      { href: "/admin/vocations", label: "Vocation resources" },
    ],
  },
  {
    label: "Items",
    items: [
      { href: "/admin/items", label: "Items" },
      { href: "/admin/item-graph", label: "Item graph" },
      { href: "/admin/rarity", label: "Rarity" },
      { href: "/admin/enchanting", label: "Enchanting" },
    ],
  },
  {
    label: "Progression",
    items: [
      { href: "/admin/skills", label: "Skills" },
      { href: "/admin/leveling", label: "Leveling" },
      { href: "/admin/character-stats", label: "Character stats" },
      { href: "/admin/simulations", label: "Simulations" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/admin/players", label: "Players" },
      { href: "/admin/moderation", label: "Moderation" },
      { href: "/admin/security", label: "Security" },
    ],
  },
];

const matches = (pathname: string, href: string) =>
  pathname === href || (href !== "/admin" && pathname.startsWith(href + "/"));

export function AdminSidebar({
  openReports = 0,
  adminName,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  openReports?: number;
  adminName: string;
}) {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = React.useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
    } finally {
      window.location.assign("/admin/login");
    }
  };

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <div className="px-2 text-sm font-semibold">Admin</div>
      </SidebarHeader>

      <SidebarContent>
        {adminNavGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-0.5">
            <SidebarGroupLabel className="h-6">{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={[item.href, ...(item.also ?? [])].some((href) =>
                      matches(pathname, href),
                    )}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <span>{item.label}</span>
                      {item.href === "/admin/moderation" && openReports > 0 ? (
                        <span className="ml-auto rounded bg-amber-400/20 px-1.5 text-[11px] font-semibold tabular-nums text-amber-300">
                          {openReports}
                        </span>
                      ) : null}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}

        <SidebarSeparator />

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Links</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Home">
                <Link href="/">Home</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/40 px-2 py-2">
          <ShieldCheck
            className="h-4 w-4 shrink-0 text-emerald-400"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[11px] text-sidebar-foreground/60">
              Signed in as
            </div>
            <div className="truncate text-sm font-medium">{adminName}</div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Sign out</span>
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
