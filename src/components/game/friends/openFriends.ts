/** Asks the sidebar to open the Friends window, e.g. from the leaderboard. */
export const OPEN_FRIENDS_EVENT = "aergyle:open-friends";

export function openFriends() {
  window.dispatchEvent(new Event(OPEN_FRIENDS_EVENT));
}
