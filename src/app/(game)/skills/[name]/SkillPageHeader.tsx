import PageHeading from "~/components/game/ui/PageHeading";

const descriptions: Record<string, string> = {
  woodcutting:
    "Work the woodland. Gather timber and grow your craft with every cut.",
  mining: "Break new ground. Unearth ore and put your tools to work.",
  fishing:
    "Find your rhythm by the water. Choose your catch and prepare your bait.",
  blacksmithing:
    "Refine ore into ingots, then shape metal into armor, tools and durable components.",
  weaponsmithing:
    "Forge fitted metal and wooden components into blades, axes, maces and spears.",
  carpentry:
    "Season and shape timber into planks, handles, shafts, bows and practical wooden gear.",
  cooking:
    "Turn fish, meat and vegetables into hearty dishes, then discover recipes for more.",
  tailoring:
    "Shape cloth, hides and rare fibers into practical apparel for life beyond the road.",
  gathering:
    "Explore the wilds around your current location and return with whatever they reveal.",
  hunting:
    "Read the tracks, choose your ground, and bring home meat, hides, bones, and hard-won trophies.",
  gardening:
    "A little patience, a plentiful harvest. Plant seeds, watch each plot grow, and gather ripe crops.",
};

const headerArtwork: Record<string, string> = {
  cooking: "game-skill-page-heading game-page-heading--cooking",
  fishing: "game-skill-page-heading game-page-heading--fishing",
  gardening: "game-skill-page-heading game-page-heading--gardening",
  gathering: "game-skill-page-heading game-page-heading--gathering",
  hunting: "game-skill-page-heading game-page-heading--hunting",
  mining: "game-skill-page-heading game-page-heading--mining",
  blacksmithing: "game-skill-page-heading game-page-heading--blacksmithing",
  weaponsmithing: "game-skill-page-heading game-page-heading--weaponsmithing",
  carpentry: "game-skill-page-heading game-page-heading--carpentry",
  tailoring: "game-skill-page-heading game-page-heading--tailoring",
  woodcutting: "game-skill-page-heading game-page-heading--woodcutting",
};

export default function SkillPageHeader({ skillName }: { skillName: string }) {
  const skillSlug = skillName.trim().toLowerCase();

  return (
    <PageHeading
      eyebrow="The skill journal"
      title={skillName}
      description={
        descriptions[skillSlug] ??
        "Practice your craft and discover what the world has to offer."
      }
      className={headerArtwork[skillSlug]}
    />
  );
}
