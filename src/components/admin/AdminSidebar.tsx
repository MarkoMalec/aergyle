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

const adminNavItems: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/items", label: "Items" },
  { href: "/admin/gardening", label: "Gardening" },
  { href: "/admin/gathering", label: "Gathering" },
  { href: "/admin/hunting", label: "Hunting" },
  { href: "/admin/dungeons", label: "Dungeons" },
  { href: "/admin/rarity", label: "Rarity" },
  { href: "/admin/vocations", label: "Vocation resources" },
  { href: "/admin/locations", label: "Locations" },
  { href: "/admin/settlements", label: "Settlements" },
  { href: "/admin/travel", label: "Travel" },
  { href: "/admin/skills", label: "Skills" },
  { href: "/admin/leveling", label: "Leveling" },
  { href: "/admin/character-stats", label: "Character stats" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/security", label: "Security" },
];

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
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarMenu>
            {adminNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href + "/"));

              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
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
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

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
