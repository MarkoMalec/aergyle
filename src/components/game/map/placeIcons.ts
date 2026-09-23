import { Archive, Castle, Landmark, MapPin, PawPrint } from "lucide-react";

/** The icon on each kind of place's pin, on player and admin maps alike. */
export const PLACE_ICONS = {
  location: MapPin,
  settlement: Landmark,
  dungeon: Castle,
  ground: PawPrint,
  storage: Archive,
} as const;
