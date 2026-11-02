import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COOKING_NPCS,
  COOKING_VENDOR_STAPLES,
} from "../prisma/content/cookingNpcs";

void test("the cooking vendor roster has twelve distinct vendors", () => {
  assert.equal(COOKING_NPCS.length, 12);
  assert.equal(new Set(COOKING_NPCS.map((npc) => npc.name)).size, 12);
  assert.equal(new Set(COOKING_NPCS.map((npc) => npc.portrait)).size, 12);
  assert.ok(COOKING_NPCS.every((npc) => npc.portrait.startsWith("/assets/npcs/")));
  assert.ok(COOKING_NPCS.every((npc) => npc.description.length > 120));
});

void test("every cooking vendor stocks salt, pepper and sugar", () => {
  assert.deepEqual(COOKING_VENDOR_STAPLES, ["Salt", "Pepper", "Sugar"]);
  assert.equal(new Set(COOKING_VENDOR_STAPLES).size, 3);
});
