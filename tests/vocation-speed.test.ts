import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeEffectiveUnitSeconds,
  VOCATION_EFFICIENCY_HALF_TIME,
} from "../src/game/vocationStats";

const seconds = (base: number, efficiency: number) =>
  computeEffectiveUnitSeconds(base, efficiency).unitSeconds;

void test("no efficiency keeps the base time", () => {
  assert.equal(seconds(60, 0), 60);
});

void test("each efficiency point adds the same amount of output", () => {
  assert.equal(VOCATION_EFFICIENCY_HALF_TIME, 100);
  assert.equal(seconds(60, 100), 30); // ×2 output
  assert.equal(seconds(60, 200), 20); // ×3 output
  assert.equal(seconds(60, 50), 40); // ×1.5 output
});

void test("high efficiency never collapses to the 1-second floor", () => {
  // The old formula reached 1 second at 100 efficiency.
  assert.equal(seconds(60, 90), 32);
  assert.equal(seconds(9, 100), 5);
});

void test("results round to the nearest second", () => {
  assert.equal(seconds(30, 15), 26); // 26.09
  assert.equal(seconds(10, 40), 7); // 7.14
});

void test("invalid or negative efficiency is ignored", () => {
  assert.equal(seconds(60, -25), 60);
  assert.equal(seconds(60, Number.NaN), 60);
  assert.equal(seconds(1, 1_000), 1);
});
