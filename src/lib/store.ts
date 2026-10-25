import { useSyncExternalStore } from "react";

/**
 * A tiny persisted store backed by localStorage.
 *
 * `useValue()` returns `undefined` while rendering on the server and during
 * hydration (storage isn't available there), then the stored value — or
 * `null` if nothing is saved yet — once running in the browser.
 */
export function createStore<T>(key: string) {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cachedValue: T | null = null;

  function read(): T | null {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      // Storage blocked (e.g. private mode): behave as if empty.
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      try {
        cachedValue = raw ? (JSON.parse(raw) as T) : null;
      } catch {
        cachedValue = null;
      }
    }
    return cachedValue;
  }

  function subscribe(onChange: () => void) {
    listeners.add(onChange);
    // Keeps other open tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  }

  function set(value: T | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore quota/blocked errors; the UI keeps working for this session.
    }
    listeners.forEach((l) => l());
  }

  function useValue(): T | null | undefined {
    return useSyncExternalStore(subscribe, read, () => undefined);
  }

  return { useValue, set, get: read };
}
