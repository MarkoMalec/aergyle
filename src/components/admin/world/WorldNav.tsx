import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";

/** World › Region › Settlement › NPC trail shown above every world page. */
export function WorldCrumbs(props: {
  trail: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-white/50">
      {[{ label: "World", href: "/admin/world" }, ...props.trail].map((crumb, index) => (
        <span key={index} className="inline-flex items-center gap-1">
          {index > 0 ? <ChevronRight className="h-3 w-3" aria-hidden="true" /> : null}
          {crumb.href ? (
            <Link href={crumb.href} className="hover:text-white">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-white/80">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Link tabs (?tab=…), so each tab only loads its own data on the server. */
export function TabLinks(props: {
  base: string;
  active: string;
  tabs: Array<{ key: string; label: string; count?: number }>;
}) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-white/10">
      {props.tabs.map((tab, index) => (
        <Link
          key={tab.key}
          // The first tab is the default, so it keeps the clean URL.
          href={index === 0 ? props.base : `${props.base}?tab=${tab.key}`}
          aria-current={tab.key === props.active ? "page" : undefined}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm",
            tab.key === props.active
              ? "border-amber-400 text-white"
              : "border-transparent text-white/55 hover:text-white",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className="rounded bg-white/[0.06] px-1.5 text-[11px] tabular-nums text-white/60">
              {tab.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

/** Picks a known tab from ?tab=, falling back to the first. */
export function activeTab<T extends string>(keys: readonly T[], value: unknown): T {
  return keys.find((key) => key === value) ?? keys[0]!;
}
