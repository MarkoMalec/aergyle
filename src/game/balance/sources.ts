import {
  computeEffectiveUnitSeconds,
  getVocationalEfficiencyStatType,
} from "~/game/vocationStats";
import {
  isVocationSkill,
  SKILLS,
  type ActivityGroup,
  type BalanceContent,
  type BalanceExpeditionArea,
  type BalanceExpeditionTier,
  type BalanceResource,
  type Skill,
  type Track,
  type XpGroup,
} from "./content";

/**
 * Every way to earn XP, resolved with the same rules the game enforces when
 * an activity starts: skill gates, the character level of the locations
 * offering a resource, learned recipes, tool efficiency and idle caps.
 */

export type SourceOptions = {
  /** Woodcutting, Mining and Fishing efficiency from tools and gear. */
  efficiency: number;
  /** "gathered": a craft also costs the time of gathering its materials, and pays their XP. */
  materials: "bought" | "gathered";
  /** Treat crafts that need a learned recipe as known. */
  recipes: boolean;
  /** What-if multipliers on each group's XP; 1 is the saved value. */
  xpScale: Partial<Record<XpGroup, number>>;
  /** An event or boost on all XP. */
  xpMultiplier: number;
};

export const DEFAULT_SOURCE_OPTIONS: SourceOptions = {
  efficiency: 0,
  materials: "bought",
  recipes: true,
  xpScale: {},
  xpMultiplier: 1,
};

export type Gate = { track: Track; level: number };

export type Source = {
  key: string;
  group: ActivityGroup;
  name: string;
  /** Seconds per action, including self-gathered materials. */
  seconds: number;
  /** How long one start can run before the player must come back. */
  runSeconds: number;
  /** XP per action for every track it feeds. */
  xp: Partial<Record<Track, number>>;
  /** Material item ids assumed bought or looted. */
  bought: number[];
  /** Every level this source needs, materials included. */
  gates: Gate[];
  editHref: string;
};

export type LevelOf = (track: Track) => number;

/** Every gate counts as met: for tables that list all content. */
export const ANY_LEVEL: LevelOf = () => Number.POSITIVE_INFINITY;

export function xpPerHour(source: Source, track: Track) {
  return ((source.xp[track] ?? 0) * 3_600) / source.seconds;
}

/** The track a group levels: its skill, or the character for dungeons. */
export function mainTrack(group: ActivityGroup): Track {
  return group === "DUNGEONS" ? "CHARACTER" : group;
}

export function xpScaleOf(options: SourceOptions, group: XpGroup) {
  return (options.xpScale[group] ?? 1) * options.xpMultiplier;
}

type Index = {
  resources: Map<Skill, BalanceResource[]>;
  producers: Map<number, BalanceResource>;
  tiers: Map<Skill, BalanceExpeditionTier[]>;
  areas: Map<Skill, BalanceExpeditionArea[]>;
  gates: Map<Track, Set<number>>;
};

const indexes = new WeakMap<BalanceContent, Index>();

function indexOf(content: BalanceContent): Index {
  let index = indexes.get(content);
  if (index) return index;
  const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  };
  index = {
    resources: new Map(),
    producers: new Map(),
    tiers: new Map(),
    areas: new Map(),
    gates: new Map(),
  };
  const gates = index.gates;
  const gate = (track: Track, level: number) => {
    const levels = gates.get(track);
    if (levels) levels.add(level);
    else gates.set(track, new Set([level]));
  };
  for (const resource of content.resources) {
    if (!isVocationSkill(resource.skill)) continue;
    push(index.resources, resource.skill, resource);
    index.producers.set(resource.itemId, resource);
    gate(resource.skill, resource.requiredSkillLevel);
    if (resource.requiredCharacterLevel !== null) gate("CHARACTER", resource.requiredCharacterLevel);
  }
  for (const tier of content.expeditionTiers) {
    push(index.tiers, tier.skill, tier);
    gate(tier.skill, tier.requiredSkillLevel);
  }
  for (const area of content.expeditionAreas) {
    push(index.areas, area.skill, area);
    gate(area.skill, area.requiredSkillLevel);
    gate("CHARACTER", area.requiredCharacterLevel);
  }
  for (const dungeon of content.dungeons) gate("CHARACTER", dungeon.requiredLevel);
  indexes.set(content, index);
  return index;
}

/**
 * Every level at which some source opens, per track. Which sources are open
 * changes only when a track reaches one of these, so callers can cache
 * source lists between them.
 */
export function gateLevels(content: BalanceContent): ReadonlyMap<Track, ReadonlySet<number>> {
  return indexOf(content).gates;
}

function meets(gates: Gate[], levelOf: LevelOf) {
  return gates.every((gate) => levelOf(gate.track) >= gate.level);
}

function resourceGates(resource: BalanceResource): Gate[] | null {
  if (resource.requiredCharacterLevel === null) return null;
  return [
    { track: resource.skill, level: resource.requiredSkillLevel },
    { track: "CHARACTER", level: resource.requiredCharacterLevel },
  ];
}

type Bundle = Pick<Source, "seconds" | "xp" | "bought" | "gates">;

function addXp(target: Bundle["xp"], track: Track, amount: number) {
  if (amount > 0) target[track] = (target[track] ?? 0) + amount;
}

/** One action of `resource`, with its materials' own actions when gathered. */
function resourceBundle(
  resource: BalanceResource,
  levelOf: LevelOf,
  options: SourceOptions,
  index: Index,
  depth: number,
): Bundle | null {
  const gates = resourceGates(resource);
  if (!gates || !meets(gates, levelOf)) return null;
  if (resource.recipeLocked && !options.recipes) return null;

  const efficiency = getVocationalEfficiencyStatType(resource.skill)
    ? options.efficiency
    : 0;
  const bundle: Bundle = {
    seconds: computeEffectiveUnitSeconds(resource.baseSeconds, efficiency)
      .unitSeconds,
    xp: {},
    bought: [],
    gates: [...gates],
  };
  const xp = resource.xpPerUnit * xpScaleOf(options, resource.skill);
  addXp(bundle.xp, resource.skill, xp);
  addXp(bundle.xp, "CHARACTER", xp);

  for (const input of resource.inputs) {
    const producer =
      options.materials === "gathered" && depth < 6
        ? index.producers.get(input.itemId)
        : undefined;
    if (!producer || producer.id === resource.id) {
      bundle.bought.push(input.itemId);
      continue;
    }
    const part = resourceBundle(producer, levelOf, options, index, depth + 1);
    // Self-sufficient players can't use a craft whose materials they can't make.
    if (!part) return null;
    const actions = input.quantity / Math.max(1, producer.yieldPerUnit);
    bundle.seconds += part.seconds * actions;
    for (const [track, amount] of Object.entries(part.xp) as [Track, number][]) {
      addXp(bundle.xp, track, amount * actions);
    }
    bundle.bought.push(...part.bought);
    bundle.gates.push(...part.gates);
  }
  return bundle;
}

function expeditionSources(
  skill: "GATHERING" | "HUNTING",
  levelOf: LevelOf,
  options: SourceOptions,
  index: Index,
): Source[] {
  const areas = index.areas.get(skill) ?? [];
  // The most accessible area: lowest character level, then skill level.
  const area = areas
    .filter(
      (candidate) =>
        levelOf(skill) >= candidate.requiredSkillLevel &&
        levelOf("CHARACTER") >= candidate.requiredCharacterLevel,
    )
    .sort(
      (a, b) =>
        a.requiredCharacterLevel - b.requiredCharacterLevel ||
        a.requiredSkillLevel - b.requiredSkillLevel,
    )[0];
  if (!area) return [];
  const scale = xpScaleOf(options, skill);
  const href = skill === "HUNTING" ? "/admin/hunting" : "/admin/gathering";
  return (index.tiers.get(skill) ?? [])
    .filter((tier) => levelOf(skill) >= tier.requiredSkillLevel)
    .map((tier) => ({
      key: `tier:${tier.id}`,
      group: skill,
      name: tier.label,
      seconds: tier.seconds,
      runSeconds: tier.seconds,
      xp: { [skill]: tier.xp * scale, CHARACTER: tier.xp * scale },
      bought: [],
      gates: [
        { track: skill, level: Math.max(tier.requiredSkillLevel, area.requiredSkillLevel) },
        { track: "CHARACTER", level: area.requiredCharacterLevel },
      ],
      editHref: href,
    }));
}

/** Every source of a group that is open at the given levels. */
export function groupSources(
  content: BalanceContent,
  group: ActivityGroup,
  levelOf: LevelOf,
  options: SourceOptions,
): Source[] {
  const index = indexOf(content);
  if (group === "DUNGEONS") {
    const scale = xpScaleOf(options, "DUNGEONS");
    return content.dungeons
      .filter((dungeon) => levelOf("CHARACTER") >= dungeon.requiredLevel)
      .map((dungeon) => ({
        key: `dungeon:${dungeon.id}`,
        group,
        name: dungeon.name,
        seconds: dungeon.seconds,
        runSeconds: dungeon.seconds,
        xp: { CHARACTER: dungeon.xp * scale },
        bought: [],
        gates: [{ track: "CHARACTER", level: dungeon.requiredLevel }],
        editHref: "/admin/dungeons",
      }));
  }
  if (group === "GATHERING" || group === "HUNTING") {
    return expeditionSources(group, levelOf, options, index);
  }
  if (!isVocationSkill(group)) return [];
  return (index.resources.get(group) ?? []).flatMap((resource) => {
    const bundle = resourceBundle(resource, levelOf, options, index, 0);
    if (!bundle || !(bundle.seconds > 0)) return [];
    return [
      {
        key: `resource:${resource.id}`,
        group,
        name: resource.name,
        runSeconds: content.vocationMaxSeconds,
        editHref: `/admin/vocations/${resource.id}`,
        ...bundle,
      },
    ];
  });
}

/**
 * The source a player would pick: the most XP for the group's own track
 * within the hours they have, given how often they can restart it.
 */
export function pickBest(
  sources: readonly Source[],
  group: ActivityGroup,
  hoursAvailable: number,
  checkInsPerDay: number,
): Source | null {
  const track = mainTrack(group);
  let best: Source | null = null;
  let bestScore = 0;
  for (const source of sources) {
    const usable = Math.min(
      hoursAvailable,
      (checkInsPerDay * source.runSeconds) / 3_600,
    );
    const score = xpPerHour(source, track) * usable;
    if (score > bestScore) {
      best = source;
      bestScore = score;
    }
  }
  return best;
}

/** Groups with at least one XP source in the content, in skill order. */
export function groupsWithContent(content: BalanceContent): ActivityGroup[] {
  const groups: ActivityGroup[] = [...SKILLS, "DUNGEONS"];
  return groups.filter(
    (group) =>
      groupSources(content, group, ANY_LEVEL, DEFAULT_SOURCE_OPTIONS).length > 0,
  );
}

export type GardenPlan = {
  seedName: string;
  cyclesPerDay: number;
  xpPerDay: number;
  /** Harvesting is an activity; growing is not. */
  activeHoursPerDay: number;
};

/**
 * The garden grows while the character does other things, so it adds XP per
 * day rather than per hour: a full field per replant, and the player can't
 * replant faster than the crop grows or than they check in.
 */
export function gardenPlan(
  content: BalanceContent,
  options: SourceOptions,
  checkInsPerDay: number,
): GardenPlan | null {
  const scale = xpScaleOf(options, "GARDENING");
  let best: GardenPlan | null = null;
  for (const seed of content.seeds) {
    if (!(seed.growSeconds > 0)) continue;
    const cyclesPerDay = Math.min(checkInsPerDay, 86_400 / seed.growSeconds);
    const xpPerDay = content.gardenTiles * seed.xp * scale * cyclesPerDay;
    if (!best || xpPerDay > best.xpPerDay) {
      best = {
        seedName: seed.name,
        cyclesPerDay,
        xpPerDay,
        activeHoursPerDay:
          (content.gardenTiles * seed.harvestSeconds * cyclesPerDay) / 3_600,
      };
    }
  }
  return best;
}
