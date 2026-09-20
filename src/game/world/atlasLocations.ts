export type AtlasLocationMarker = {
  name: string;
  requiredLevel: number;
  left: `${number}%`;
  top: `${number}%`;
  region: string;
  terrain: string;
  description: string;
  fact: string;
  knownFor: readonly string[];
};

export const WORLD_ATLAS_LOCATION_MARKERS = [
  {
    name: "Crownhold",
    requiredLevel: 1,
    left: "64%",
    top: "76%",
    region: "The Crown March",
    terrain: "River city",
    description:
      "A walled wayfarer's city where the southern roads meet the sea. Its quiet courts, busy quays, and guarded bridges make it a familiar first refuge.",
    fact: "Three bridge gates divide the old city into the Crown, Quay, and Garden wards.",
    knownFor: ["Open markets", "Canal gardens", "Stone bridges"],
  },
  {
    name: "Greenveil Plains",
    requiredLevel: 1,
    left: "23%",
    top: "56%",
    region: "The Greenveil",
    terrain: "Wooded grassland",
    description:
      "Broad meadowland broken by oak copses, clear streams, and old cart tracks. Travellers value the plains for their gentle routes and long western light.",
    fact: "After rain, fragments of an older paved road appear between the grass and wild thyme.",
    knownFor: ["Oak groves", "Clear streams", "Old roads"],
  },
  {
    name: "Citadel",
    requiredLevel: 1,
    left: "42.5%",
    top: "50%",
    region: "The River Crown",
    terrain: "Fortified delta",
    description:
      "A many-towered stronghold raised where the realm's great waterways converge. Barges, smithies, and travellers keep its river gates awake at every hour.",
    fact: "The oldest foundation stones sit below the waterline and bear marks from a vanished mason's guild.",
    knownFor: ["Copper and tin", "River fish", "Busy forges"],
  },
  {
    name: "Goblins Camp",
    requiredLevel: 40,
    left: "60.5%",
    top: "29%",
    region: "The Ashwood Verge",
    terrain: "Forest encampment",
    description:
      "A sprawling palisade settlement tucked between ash woods and marshy ground. Smoke from practical kilns hangs low above its patched roofs.",
    fact: "The camp's paths move with the seasons as new walkways are laid across the soft earth.",
    knownFor: ["Ash timber", "Bog waters", "Silver seams"],
  },
  {
    name: "Frostcrown Peaks",
    requiredLevel: 50,
    left: "14%",
    top: "17%",
    region: "The Northern Crown",
    terrain: "Alpine range",
    description:
      "A wall of ice-bright summits and narrow pine passes. Even in summer, blue shadows linger beneath the ridges and the wind carries the sound of shifting snow.",
    fact: "At dawn, the eastern faces reflect a pale arc of light that sailors use as a northern bearing.",
    knownFor: ["Frostpine", "Cold rivers", "Frostsilver"],
  },
  {
    name: "Ruins of Caldrath",
    requiredLevel: 80,
    left: "48%",
    top: "31%",
    region: "The Violet Highlands",
    terrain: "Ancient basin",
    description:
      "Broken terraces and roofless halls spread through a violet-stone basin. Water still follows the city's precise channels, though its builders are long gone.",
    fact: "Every surviving arch faces the same empty point in the northern sky.",
    knownFor: ["Elderwood", "Cobalt", "Flooded vaults"],
  },
  {
    name: "Mount Doom",
    requiredLevel: 150,
    left: "40.5%",
    top: "14%",
    region: "The Ember Reach",
    terrain: "Volcanic island",
    description:
      "A solitary furnace mountain rising from deep water. Black slopes, emberwood thickets, and glassy ravines make every safe trail hard-won.",
    fact: "Its summit smoke bends east even when the sea below is perfectly still.",
    knownFor: ["Obsidian", "Emberwood", "Furnace heat"],
  },
  {
    name: "Pirate Island",
    requiredLevel: 200,
    left: "8%",
    top: "86%",
    region: "The Farwater Keys",
    terrain: "Rugged archipelago",
    description:
      "A remote knot of reefs, hidden beaches, and weather-cut cliffs. Its crescent coves offer shelter, but the surrounding currents punish careless navigation.",
    fact: "At the lowest spring tide, a stone causeway briefly joins two of the outer islets.",
    knownFor: ["Blackfin waters", "Hidden coves", "Sea caves"],
  },
] as const satisfies readonly AtlasLocationMarker[];

/**
 * The six locations owned by the vocation expansion pack. The two starter
 * regions above already exist independently in older worlds.
 */
export const ATLAS_LOCATION_MARKERS = WORLD_ATLAS_LOCATION_MARKERS.slice(2);

export type AtlasLocationName =
  (typeof WORLD_ATLAS_LOCATION_MARKERS)[number]["name"];

export function getAtlasLocationMarker(name: string) {
  return (
    WORLD_ATLAS_LOCATION_MARKERS.find((marker) => marker.name === name) ?? null
  );
}
