import Link from "next/link";
import { cn } from "~/lib/utils";

export const adminNavItems: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/items", label: "Items" },
  { href: "/admin/rarity", label: "Rarity" },
  { href: "/admin/vocations", label: "Vocation resources" },
  { href: "/admin/locations", label: "Locations" },
  { href: "/admin/skills", label: "Skills" },
  { href: "/admin/leveling", label: "Leveling" },
];

export function AdminNav(props: { className?: string }) {
  return (
    <nav className={cn("flex flex-col gap-2", props.className)}>
      {adminNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-md px-3 py-2 text-sm text-white/80 hover:bg-gray-800/70 hover:text-white"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
