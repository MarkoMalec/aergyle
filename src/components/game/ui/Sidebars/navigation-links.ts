import {
  Anvil,
  Axe,
  Backpack,
  Castle,
  Compass,
  Crosshair,
  Fish,
  Leaf,
  MapIcon,
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
import { toVocationalActionTypeFromSkillName } from "~/utils/vocations";

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

/** The rail's icon for a skill, also used on the skill page itself. */
export function getSkillIcon(skillName: string): LucideIcon {
  return skillIcons[skillName.trim().toLowerCase()] ?? Leaf;
}

export type NavigationSkill = {
  name: string;
  category: "VOCATION" | "CRAFTING";
};

export type NavigationLink = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Also selected on the pages below it, or below this path. */
  nested?: true | string;
  /** Progression track key, when the entry carries a mastery level. */
  trackKey?: string;
};

export type NavigationGroup = {
  title: string;
  links: NavigationLink[];
};

/** The rail's destinations: a fixed spine plus the skills the game has. */
export function buildNavigationGroups(
  skills: NavigationSkill[],
): NavigationGroup[] {
  const skillLinks = (category: NavigationSkill["category"]) =>
    skills
      .filter((skill) => skill.category === category)
      .map(({ name }) => ({
        label: name,
        href: `/skills/${encodeURIComponent(name)}`,
        icon: getSkillIcon(name),
        trackKey: toVocationalActionTypeFromSkillName(name) ?? undefined,
      }));

  const groups: NavigationGroup[] = [
    {
      title: "Character",
      links: [
        { label: "Character", href: "/profile", icon: UserRound },
        { label: "Inventory", href: "/profile#inventory", icon: Backpack },
      ],
    },
    {
      title: "World",
      links: [
        { label: "World atlas", href: "/map", icon: Compass },
        // Settlement and NPC pages open from the region map.
        { label: "Region", href: "/region", icon: MapIcon, nested: "/settlements" },
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
    { title: "Vocations", links: skillLinks("VOCATION") },
    { title: "Crafting", links: skillLinks("CRAFTING") },
    {
      title: "Trade",
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

  return groups.filter((group) => group.links.length > 0);
}

/** Whether `pathname` is the link's page, or a page nested below it. */
export function isLinkSelected(link: NavigationLink, pathname: string) {
  const current = decodeURIComponent(pathname);
  const target = decodeURIComponent(link.href);
  const parent = typeof link.nested === "string" ? link.nested : target;
  return (
    current === target || Boolean(link.nested && current.startsWith(`${parent}/`))
  );
}

/** The name of the page the player is on, for the pin menu. */
export function describePage(groups: NavigationGroup[], pathname: string) {
  const links = groups.flatMap((group) => group.links);
  const current = decodeURIComponent(pathname);
  const exact = links.find((link) => decodeURIComponent(link.href) === current);
  if (exact) return exact.label;

  const segment = current.split("/").filter(Boolean).pop();
  // Detail pages end in an id; name them after the section they belong to.
  if (!segment || /^\d+$/.test(segment)) {
    return links.find((link) => isLinkSelected(link, pathname))?.label ?? "Aergyle";
  }
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
