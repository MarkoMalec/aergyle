import assert from "node:assert/strict";
import { test } from "node:test";
import { billOfMaterials } from "../src/game/itemGraph/bom";
import type { GraphItem, GraphRecipe, ItemGraphContent } from "../src/game/itemGraph/content";
import { defaultDiagnosticOptions, diagnose, type IssueCode } from "../src/game/itemGraph/diagnostics";
import { buildItemGraph } from "../src/game/itemGraph/graph";
import { buildLens, itemKey, lensLineage, LENS_DEFAULTS, type LensOptions } from "../src/game/itemGraph/lens";

type ItemType = NonNullable<GraphItem["itemType"]>;

const item = (id: number, name: string, itemType: ItemType, extra: Partial<GraphItem> = {}): GraphItem => ({
  id,
  name,
  sprite: `/assets/items/${id}.png`,
  rarity: "COMMON",
  itemType,
  equippable: false,
  requiredLevel: 1,
  price: 1,
  seed: null,
  ...extra,
});

let nextRecipe = 1;
const recipe = (
  itemId: number,
  skill: GraphRecipe["skill"],
  inputs: Array<[number, number]>,
  extra: Partial<GraphRecipe> = {},
): GraphRecipe => ({
  id: nextRecipe++,
  itemId,
  skill,
  name: `Recipe ${itemId}`,
  requiredSkillLevel: 1,
  defaultSeconds: 10,
  yieldPerUnit: 1,
  xpPerUnit: 5,
  rarity: "COMMON",
  unlockItemId: null,
  inputs: inputs.map(([id, quantity]) => ({ itemId: id, quantity })),
  locationIds: [1],
  ...extra,
});

// Ore → Ingot (×2 ore) → Blade (×3 ingot); Log → Grip; Sword = Blade + Grip + Ingot.
// Ingot is shared: the sword uses it directly and through the blade.
function forge(): ItemGraphContent {
  nextRecipe = 1;
  return {
    items: [
      item(1, "Iron Ore", "ORE"),
      item(2, "Oak Log", "LOG"),
      item(3, "Iron Ingot", "INGOT"),
      item(4, "Blade", "MATERIAL"),
      item(5, "Grip", "MATERIAL"),
      item(6, "Sword", "SWORD", { equippable: true }),
      item(7, "Knight Kit", "OTHER"),
      item(8, "Lost Gem", "GEM"),
      item(9, "Slag", "MATERIAL"),
      item(10, "Tomato Seed", "SEED", {
        seed: { yieldItemId: 11, min: 1, max: 3, growSeconds: 60, plantable: true },
      }),
      item(11, "Tomato", "VEGETABLE"),
    ],
    recipes: [
      recipe(1, "MINING", []),
      recipe(2, "WOODCUTTING", []),
      recipe(3, "BLACKSMITHING", [[1, 2]], { yieldPerUnit: 2 }),
      recipe(4, "BLACKSMITHING", [[3, 3]]),
      recipe(5, "CARPENTRY", [[2, 1]]),
      recipe(6, "WEAPONSMITHING", [[4, 1], [5, 1], [3, 1]]),
      recipe(7, "TAILORING", [[6, 1], [8, 1]]),
      recipe(9, "BLACKSMITHING", [[1, 1]]),
    ],
    drops: [],
    offers: [
      {
        itemId: 10,
        npcId: 1,
        npcName: "Grenda",
        settlementName: "Oakvale",
        price: 5,
        limited: false,
        gated: false,
        available: true,
      },
    ],
    questRewards: [],
    questDeliveries: [],
    projectNeeds: [],
    locations: [{ id: 1, name: "Oakvale" }],
    skillRules: {},
  };
}

const lensOptions = (patch: Partial<LensOptions> = {}): LensOptions => ({
  ...LENS_DEFAULTS,
  expanded: new Set(),
  collapsed: new Set(),
  showAll: new Set(),
  ...patch,
});

void test("tiers, roles, reach and upstream follow the recipes", () => {
  const graph = buildItemGraph(forge());
  const facts = (id: number) => graph.facts.get(id)!;

  assert.equal(facts(1).tier, 0);
  assert.equal(facts(1).role, "RAW");
  assert.equal(facts(3).tier, 1);
  assert.equal(facts(3).role, "INTERMEDIATE");
  assert.equal(facts(4).tier, 2);
  assert.equal(facts(6).tier, 3);
  assert.equal(facts(6).role, "INTERMEDIATE");
  assert.equal(facts(7).role, "FINISHED");
  // Ore leads to ingot, blade, sword, kit and slag.
  assert.equal(facts(1).reach, 5);
  assert.equal(facts(3).usedBy, 2);
  assert.equal(facts(6).upstream, 5);
  assert.deepEqual(facts(1).sourceKinds, ["GATHERED"]);
  assert.deepEqual(facts(11).sourceKinds, ["GROWN"]);
  assert.equal(facts(11).obtainable, true);
  // The kit needs a gem nothing produces.
  assert.equal(facts(8).obtainable, false);
  assert.equal(facts(7).obtainable, false);
  assert.equal(facts(6).obtainable, true);
});

void test("the lens puts a shared input left of all its uses and links every pair", () => {
  const graph = buildItemGraph(forge());
  const lens = buildLens(graph, 6, lensOptions({ up: 3 }));
  const column = (id: number) => lens.nodes.find((node) => node.key === itemKey(id))!.column;

  assert.equal(column(6), 0);
  assert.equal(column(4), -1);
  assert.equal(column(5), -1);
  // The ingot feeds the blade (-1) and the sword: longest path puts it at -2.
  assert.equal(column(3), -2);
  assert.equal(column(1), -3);
  assert.equal(column(7), 1);
  assert.ok(lens.edges.some((edge) => edge.from === itemKey(3) && edge.to === itemKey(6)));
  assert.ok(lens.edges.every((edge) => !edge.backward));
  // The sword has three inputs, each with its own port.
  const ports = lens.edges.filter((edge) => edge.to === itemKey(6)).map((edge) => edge.port);
  assert.deepEqual([...ports].sort(), [0, 1, 2]);

  const lineage = lensLineage(lens, itemKey(3));
  assert.ok(lineage.nodes.has(itemKey(1)));
  assert.ok(lineage.nodes.has(itemKey(7)));
  assert.ok(!lineage.nodes.has(itemKey(5)));
});

void test("depth, collapse, expand and the fan-out cap bound the lens", () => {
  const graph = buildItemGraph(forge());
  const shallow = buildLens(graph, 6, lensOptions({ up: 1, down: 0 }));
  assert.deepEqual(
    shallow.nodes.map((node) => node.key).sort(),
    [itemKey(3), itemKey(4), itemKey(5), itemKey(6)].sort(),
  );
  const blade = shallow.nodes.find((node) => node.key === itemKey(4));
  assert.equal(blade?.type === "item" && blade.hiddenUp, 0);
  const grip = shallow.nodes.find((node) => node.key === itemKey(5));
  assert.equal(grip?.type === "item" && grip.hiddenUp, 1);
  const focus = shallow.nodes.find((node) => node.key === itemKey(6));
  assert.equal(focus?.type === "item" && focus.hiddenDown, 1);

  const expanded = buildLens(graph, 6, lensOptions({ up: 1, down: 0, expanded: new Set(["up:5"]) }));
  assert.ok(expanded.nodes.some((node) => node.key === itemKey(2)));

  const collapsed = buildLens(graph, 6, lensOptions({ up: 3, collapsed: new Set(["up:4"]) }));
  // The ingot still shows: the sword needs it directly.
  assert.ok(collapsed.nodes.some((node) => node.key === itemKey(3)));

  const capped = buildLens(graph, 6, lensOptions({ up: 1, fanOut: 2 }));
  const more = capped.nodes.find((node) => node.type === "more");
  assert.equal(more?.type === "more" && more.count, 1);
  // Blade and ingot make the cut (deepest first); the grip hides behind "+1".
  assert.deepEqual(
    capped.nodes.filter((node) => node.type === "item" && node.side === "up").map((node) => node.key).sort(),
    [itemKey(3), itemKey(4)].sort(),
  );
});

void test("the bill of materials pools shared intermediates before rounding", () => {
  const graph = buildItemGraph(forge());
  const { root, totals } = billOfMaterials(graph, 6, 1);

  // Sword: blade (3 ingots) + grip + 1 ingot = 4 ingots = 2 smelts = 4 ore.
  assert.deepEqual(
    totals.materials.map((m) => [m.itemId, m.quantity]),
    [[1, 4], [2, 1]],
  );
  const smith = totals.skills.find((s) => s.skill === "BLACKSMITHING")!;
  assert.equal(smith.crafts, 1 + 2);
  assert.equal(totals.steps, 4);
  assert.equal(totals.occurrences.get(3), 2);
  // Per branch: the blade's 3 ingots round up to 2 smelts on their own.
  const bladeIngot = root.children[0]!.children[0]!;
  assert.equal(bladeIngot.itemId, 3);
  assert.equal(bladeIngot.crafts, 2);
});

void test("diagnostics find cycles, missing sources, dead ends and overlaps", () => {
  const content = forge();
  // Ingot also needs the blade: blade → ingot → blade.
  content.recipes.find((r) => r.itemId === 3)!.inputs.push({ itemId: 4, quantity: 1 });
  // An identical smelt, a recipe hidden everywhere and a level inversion.
  content.items.push(item(12, "Pig Iron", "INGOT"), item(13, "Hidden Grip", "MATERIAL"));
  content.recipes.push(recipe(12, "BLACKSMITHING", [[1, 5]], { requiredSkillLevel: 30 }));
  content.recipes.push(recipe(13, "CARPENTRY", [[2, 1]], { locationIds: [] }));
  content.recipes.find((r) => r.itemId === 4)!.inputs.push({ itemId: 12, quantity: 1 });

  const graph = buildItemGraph(content);
  const issues = diagnose(graph, { ...defaultDiagnosticOptions(20), maxTier: 2 });
  const codes = (itemId: number) => issues.filter((issue) => issue.itemId === itemId || issue.related.includes(itemId)).map((i) => i.code);
  const has = (code: IssueCode) => issues.some((issue) => issue.code === code);

  const cycle = issues.find((issue) => issue.code === "CYCLE")!;
  assert.deepEqual([cycle.itemId, ...cycle.related].sort(), [3, 4]);
  assert.match(cycle.message, /→/);
  assert.equal(graph.facts.get(6)!.obtainable, false);
  assert.ok(codes(8).includes("NO_SOURCE"));
  assert.ok(codes(6).includes("UNOBTAINABLE"));
  assert.ok(codes(9).includes("DEAD_END"));
  assert.ok(codes(12).includes("DUPLICATE_RECIPE"));
  assert.ok(codes(4).includes("LEVEL_INVERSION"));
  // Unobtainable anyway, so no separate location warning for the hidden grip.
  assert.ok(codes(13).includes("UNOBTAINABLE"));
  assert.ok(!codes(13).includes("NO_LOCATION"));
  assert.ok(codes(6).includes("DEEP_CHAIN"));
  // The tomato is grown but nothing cooks it.
  assert.ok(codes(11).includes("UNUSED"));
  assert.ok(has("SIMILAR_RECIPE") === false);
  // Errors come first.
  assert.equal(issues[0]!.severity, "error");
});

void test("a skill rule conflict and a self-requiring recipe are reported", () => {
  const content = forge();
  content.skillRules = { CARPENTRY: { outputTypes: ["BOW"], inputTypes: [] } };
  content.recipes.find((r) => r.itemId === 9)!.inputs.push({ itemId: 9, quantity: 1 });
  const issues = diagnose(buildItemGraph(content), defaultDiagnosticOptions(11));
  assert.ok(issues.some((issue) => issue.code === "RULE_CONFLICT" && issue.itemId === 5));
  const self = issues.find((issue) => issue.code === "CYCLE")!;
  assert.equal(self.itemId, 9);
  assert.match(self.message, /needs itself/);
});
