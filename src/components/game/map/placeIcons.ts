import { Castle, Landmark, PawPrint } from "lucide-react";

/** The icon on each kind of place's pin, on player and admin maps alike. */
export const PLACE_ICONS = {
  settlement: Landmark,
  dungeon: Castle,
  ground: PawPrint,
} as const;
