import type { PlayerRef } from "~/server/communication";

/** Asks the sidebar's Communication Hub to open a new message to a player. */
export const MESSAGE_PLAYER_EVENT = "aergyle:message-player";

export function messagePlayer(player: PlayerRef & { id: string }) {
  window.dispatchEvent(
    new CustomEvent<PlayerRef>(MESSAGE_PLAYER_EVENT, { detail: player }),
  );
}
