import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ATLAS_TRAVEL_ROUTES,
  LONGEST_ATLAS_ROUTE_SECONDS,
} from "../prisma/content/travel";
import { WORLD_ATLAS_LOCATION_MARKERS } from "../src/game/world/atlasLocations";
import {
  applyMovementSpeed,
  MIN_TRAVEL_MOVEMENT_SPEED,
  toTravelRoutePair,
} from "../src/game/world/travel";

void test("a route pair is the same in both directions", () => {
  assert.deepEqual(toTravelRoutePair(5, 2), toTravelRoutePair(2, 5));
  assert.deepEqual(toTravelRoutePair(5, 2), { locationAId: 2, locationBId: 5 });
});

void test("travel time scales inversely with movement speed", () => {
  assert.equal(applyMovementSpeed(3600, 100), 3600);
  assert.equal(applyMovementSpeed(3600, 125), 2880);
  assert.equal(applyMovementSpeed(3600, 80), 4500);
  assert.equal(applyMovementSpeed(3600, 95), 3789);
});

void test("zero or broken movement speed cannot stall or skip a journey", () => {
  assert.equal(
    applyMovementSpeed(3600, 0),
    (3600 * 100) / MIN_TRAVEL_MOVEMENT_SPEED,
  );
  assert.equal(applyMovementSpeed(3600, Number.NaN), 3600);
  assert.equal(applyMovementSpeed(1, 100_000), 1);
});

void test("seeded routes cover every atlas pair once, scaled to the atlas", () => {
  const n = WORLD_ATLAS_LOCATION_MARKERS.length;
  assert.equal(ATLAS_TRAVEL_ROUTES.length, (n * (n - 1)) / 2);
  const keys = new Set(
    ATLAS_TRAVEL_ROUTES.map((r) => [r.a, r.b].sort().join("|")),
  );
  assert.equal(keys.size, ATLAS_TRAVEL_ROUTES.length);

  const seconds = ATLAS_TRAVEL_ROUTES.map((r) => r.seconds);
  assert.equal(Math.max(...seconds), LONGEST_ATLAS_ROUTE_SECONDS);
  assert.ok(seconds.every((s) => s > 0 && s % 300 === 0));

  const time = (a: string, b: string) =>
    ATLAS_TRAVEL_ROUTES.find(
      (r) => (r.a === a && r.b === b) || (r.a === b && r.b === a),
    )?.seconds ?? 0;
  assert.ok(
    time("Crownhold", "Citadel") < time("Crownhold", "Greenveil Plains"),
  );
  assert.ok(
    time("Crownhold", "Greenveil Plains") <
      time("Crownhold", "Frostcrown Peaks"),
  );
});
