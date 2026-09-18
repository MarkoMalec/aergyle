import type { VocationalActionType } from "~/generated/prisma/enums";

/**
 * Contract between the realtime daemon and the browser. Server-side settlement
 * (vocation claims, garden harvest tiles) returns these shapes so the daemon can
 * forward them unchanged. Types and constants only: the daemon, server and client
 * all import this module.
 */

/** Why a ticking activity ended. */
export type ActivityStopReason =
  | "COMPLETED"
  | "INVENTORY_FULL"
  | "OUT_OF_MATERIALS"
  | "OUT_OF_BAIT";

export const ACTIVITY_STOP_MESSAGES: Record<ActivityStopReason, string> = {
  COMPLETED: "Finished",
  INVENTORY_FULL: "Stopped: inventory full",
  OUT_OF_MATERIALS: "Stopped: out of materials",
  OUT_OF_BAIT: "Stopped: out of bait",
};

/** An inventory stack's quantity after a server-side change; 0 means the stack is gone. */
export type ItemQuantityChange = { userItemId: number; quantity: number };

/** Pushed after the daemon settles an activity tick (items granted/consumed, XP awarded). */
export type ActivityTickEvent = {
  type: "activity_tick";
  userId: string;
  activity: "VOCATION" | "GARDEN";
  /** Skill whose XP changed. */
  skill: VocationalActionType;
  /** What was being produced, for notifications. */
  label: string;
  itemChanges: ItemQuantityChange[];
  /** New stacks were created; clients can't patch those in and must refetch. */
  newStacks: boolean;
  /** Set when this tick ended the activity. */
  stopReason: ActivityStopReason | null;
  at: string;
};

/** Sent when a client connects, so it can resync anything that changed while it was away. */
export type InventoryChangedEvent = {
  type: "inventory_changed";
  userId: string;
  at: string;
};

export type RealtimeServerEvent = ActivityTickEvent | InventoryChangedEvent;
