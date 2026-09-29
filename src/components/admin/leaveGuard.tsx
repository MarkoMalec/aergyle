"use client";

import React, { useEffect } from "react";

export const LEAVE_MESSAGE =
  "Leave without saving? Your unsaved changes will be lost.";

/**
 * Asked before a component navigates away in code (router.push), so an editor
 * with unsaved changes can stop it. Outside an editor it always allows.
 */
export const ConfirmLeaveContext = React.createContext<() => boolean>(
  () => true,
);

export function useConfirmLeave() {
  return React.useContext(ConfirmLeaveContext);
}

/**
 * While `active`, asks before a reload, a closed tab or a link to another
 * page throws the unsaved changes away.
 */
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") {
        return;
      }
      const url = new URL(link.href, window.location.href);
      // Other sites are covered by beforeunload; same-page anchors lose nothing.
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      if (!window.confirm(LEAVE_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);
}
