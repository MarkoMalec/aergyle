/** Base time for a location pair when neither a route nor a config is saved. */
export const FALLBACK_TRAVEL_SECONDS = 4 * 60 * 60;

/** Movement speed counted for travel never drops below this percentage. */
export const MIN_TRAVEL_MOVEMENT_SPEED = 10;

/** Routes are undirected and stored once, with the lower location id as A. */
export function toTravelRoutePair(
  fromLocationId: number,
  toLocationId: number,
) {
  return {
    locationAId: Math.min(fromLocationId, toLocationId),
    locationBId: Math.max(fromLocationId, toLocationId),
  };
}

/**
 * Route times are for 100% movement speed; time scales inversely with speed,
 * so 125% takes 80% of the base time and 80% takes 125% of it.
 */
export function applyMovementSpeed(baseSeconds: number, movementSpeed: number) {
  const speed = Number.isFinite(movementSpeed)
    ? Math.max(MIN_TRAVEL_MOVEMENT_SPEED, movementSpeed)
    : 100;
  return Math.max(1, Math.round((baseSeconds * 100) / speed));
}
