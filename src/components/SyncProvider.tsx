"use client";

import { useEffect } from "react";
import { pruneLocalLogs, syncNow } from "@/lib/sync";

const PERIODIC_SYNC_MS = 5 * 60_000;

/** Keeps the device copy in sync with Google Sheets. Renders nothing. */
export function SyncProvider() {
  useEffect(() => {
    pruneLocalLogs();
    void syncNow();

    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    const onOnline = () => void syncNow();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(() => void syncNow(), PERIODIC_SYNC_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
  }, []);

  return null;
}
