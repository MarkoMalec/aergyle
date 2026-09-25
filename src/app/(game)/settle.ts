import { cache } from "react";
import { getVocationalStatus } from "~/server/vocations";

/**
 * Settles due vocation ticks once per request. The game layout and its page
 * render in parallel, so both await this before reading the inventory.
 */
export const settleVocationalTicks = cache(getVocationalStatus);
