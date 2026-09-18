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
    <nav
      aria-label="Marketplace pages"
      className="flex gap-1 overflow-x-auto border-b border-border"
    >
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
              "relative shrink-0 px-3 py-3 text-sm transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
            {active && (
              <span className="absolute inset-x-3 bottom-0 h-0.5 bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
