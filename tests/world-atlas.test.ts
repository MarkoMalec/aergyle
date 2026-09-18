import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ATLAS_LOCATION_MARKERS,
  WORLD_ATLAS_LOCATION_MARKERS,
  getAtlasLocationMarker,
} from "../src/game/world/atlasLocations";

void test("the world atlas gives every live region a distinct field entry", () => {
  assert.equal(WORLD_ATLAS_LOCATION_MARKERS.length, 8);
  assert.equal(
    new Set(WORLD_ATLAS_LOCATION_MARKERS.map((marker) => marker.name)).size,
    WORLD_ATLAS_LOCATION_MARKERS.length,
  );

  for (const marker of WORLD_ATLAS_LOCATION_MARKERS) {
    assert.equal(getAtlasLocationMarker(marker.name), marker);
    assert.ok(marker.description.length >= 80, marker.name);
    assert.ok(marker.fact.length >= 40, marker.name);
    assert.equal(marker.knownFor.length, 3, marker.name);

    for (const coordinate of [marker.left, marker.top]) {
      const percentage = Number.parseFloat(coordinate);
      assert.ok(percentage >= 0 && percentage <= 100, marker.name);
    }
  }
});

void test("vocation seeding remains limited to its six expansion regions", () => {
  assert.deepEqual(
    ATLAS_LOCATION_MARKERS.map((marker) => marker.name),
    [
      "Citadel",
      "Goblins Camp",
      "Frostcrown Peaks",
      "Ruins of Caldrath",
      "Mount Doom",
      "Pirate Island",
    ],
  );
});
