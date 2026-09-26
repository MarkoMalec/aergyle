export const ACTIVE_ACTION_EVENT = "aergyle:active-action-event";

export type ActiveActionEventDetail = {
  /**
   * "ended": an activity this page watched running has finished, stopped or
   * become ready to claim.
   */
  kind: "changed" | "stop-optimistic" | "ended";
};

export function dispatchActiveActionEvent(detail: ActiveActionEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ActiveActionEventDetail>(ACTIVE_ACTION_EVENT, { detail }));
}

export function addActiveActionEventListener(
  listener: (ev: CustomEvent<ActiveActionEventDetail>) => void,
) {
  if (typeof window === "undefined") return () => {};

  const handler = (ev: Event) => listener(ev as CustomEvent<ActiveActionEventDetail>);
  window.addEventListener(ACTIVE_ACTION_EVENT, handler);
  return () => window.removeEventListener(ACTIVE_ACTION_EVENT, handler);
}
