/**
 * Every map (world atlas, region and settlement maps) is drawn at this size
 * and shown at it, so pins sit exactly where they were placed.
 */
export const MAP_SIZE = { width: 1536, height: 1024 } as const;

/** A pin's position on a map, in percent of its width and height. */
export type MapPoint = { x: number; y: number };

export function mapPoint(row: {
  mapX: number | null;
  mapY: number | null;
}): MapPoint | null {
  return row.mapX === null || row.mapY === null
    ? null
    : { x: row.mapX, y: row.mapY };
}

/**
 * The square of an NPC portrait shown as its head: the top-left corner (x as
 * a fraction of the width, y of the height) and the side (of the width).
 */
export type HeadCrop = { x: number; y: number; size: number };

// The top middle of a 2:3 portrait, where the face usually is.
export const DEFAULT_HEAD_CROP: HeadCrop = { x: 0.2, y: 0.06, size: 0.6 };

export const MIN_HEAD_CROP_SIZE = 0.15;

export function headCrop(npc: {
  headX: number | null;
  headY: number | null;
  headSize: number | null;
}): HeadCrop {
  return npc.headX === null || npc.headY === null || npc.headSize === null
    ? DEFAULT_HEAD_CROP
    : { x: npc.headX, y: npc.headY, size: npc.headSize };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Keeps a crop inside a portrait `aspect` (height / width) times as tall as
 * it is wide.
 */
export function clampHeadCrop(crop: HeadCrop, aspect: number): HeadCrop {
  const size = clamp(crop.size, MIN_HEAD_CROP_SIZE, Math.min(1, aspect));
  return {
    size,
    x: clamp(crop.x, 0, 1 - size),
    y: clamp(crop.y, 0, 1 - size / aspect),
  };
}

/**
 * What can be pinned: locations on the world atlas, places on region maps,
 * and NPCs and the storage on settlement maps.
 */
export const MAP_PIN_KINDS = [
  "location",
  "settlement",
  "dungeon",
  "ground",
  "npc",
  "storage",
] as const;
export type MapPinKind = (typeof MAP_PIN_KINDS)[number];

/** The maps a pin can be placed on. */
export type MapKind = "world" | "location" | "settlement";

/** The map each kind of pin belongs to. */
export const MAP_OF_PIN_KIND: Record<MapPinKind, MapKind> = {
  location: "world",
  settlement: "location",
  dungeon: "location",
  ground: "location",
  npc: "settlement",
  storage: "settlement",
};
