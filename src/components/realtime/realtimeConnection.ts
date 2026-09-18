import { useSyncExternalStore } from "react";

// Whether the realtime daemon's socket is open. While it is, the server pushes every
// activity tick, so clients don't poll for them.
let connected = false;
const listeners = new Set<() => void>();

export function setRealtimeConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRealtimeConnected() {
  return useSyncExternalStore(
    subscribe,
    () => connected,
    () => false,
  );
}
