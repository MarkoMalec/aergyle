import {
  WORLD_ATLAS_LOCATION_MARKERS,
  WORLD_ATLAS_MAP_SIZE,
} from "../../src/game/world/atlasLocations";

/** The farthest pair of atlas locations takes this long at 100% speed. */
export const LONGEST_ATLAS_ROUTE_SECONDS = 4 * 60 * 60;
const ROUND_TO_SECONDS = 5 * 60;

function markerPoint(marker: (typeof WORLD_ATLAS_LOCATION_MARKERS)[number]) {
  return {
    x: (Number.parseFloat(marker.left) / 100) * WORLD_ATLAS_MAP_SIZE.width,
    y: (Number.parseFloat(marker.top) / 100) * WORLD_ATLAS_MAP_SIZE.height,
  };
}

const pairs = WORLD_ATLAS_LOCATION_MARKERS.flatMap((a, index) =>
  WORLD_ATLAS_LOCATION_MARKERS.slice(index + 1).map((b) => {
    const pa = markerPoint(a);
    const pb = markerPoint(b);
    return {
      a: a.name,
      b: b.name,
      distance: Math.hypot(pa.x - pb.x, pa.y - pb.y),
    };
  }),
);
const longestDistance = Math.max(...pairs.map((pair) => pair.distance));

/**
 * Starting route times, proportional to straight-line distance on the atlas
 * and rounded to 5 minutes. Admins tune them in /admin/travel afterwards.
 */
export const ATLAS_TRAVEL_ROUTES = pairs.map((pair) => ({
  a: pair.a,
  b: pair.b,
  seconds: Math.max(
    ROUND_TO_SECONDS,
    Math.round(
      (pair.distance / longestDistance) *
        (LONGEST_ATLAS_ROUTE_SECONDS / ROUND_TO_SECONDS),
    ) * ROUND_TO_SECONDS,
  ),
}));
