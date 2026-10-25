import { useSyncExternalStore } from "react";

// The current time, refreshed every minute. Returns null while rendering on the
// server, because Cache Components prerendering must not read the clock.
let now = 0;

function subscribe(onChange: () => void) {
  const id = setInterval(() => {
    now = Date.now();
    onChange();
  }, 60_000);
  return () => clearInterval(id);
}

function getSnapshot() {
  if (now === 0) now = Date.now();
  return now;
}

export function useNow(): Date | null {
  const t = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return t === null ? null : new Date(t);
}
