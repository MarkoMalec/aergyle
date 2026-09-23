"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";

const links = [
  { href: "/marketplace", label: "Browse", exact: true },
  { href: "/marketplace/sell", label: "Sell" },
  { href: "/marketplace/my-listings", label: "My orders" },
  { href: "/marketplace/history", label: "History" },
];

export function MarketplaceNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Marketplace pages" className="flex gap-1 overflow-x-auto">
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-[9px] px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-primary"
                : "text-muted-foreground hover:bg-secondary/55 hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
