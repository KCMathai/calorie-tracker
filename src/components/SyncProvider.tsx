"use client";

import { useEffect } from "react";
import { pruneLocalLogs, reconcileDailyTotals, syncNow } from "@/lib/sync";

const PERIODIC_SYNC_MS = 5 * 60_000;

/** Keeps the device copy in sync with Google Sheets. Renders nothing; only mounted once unlocked. */
export function SyncProvider() {
  useEffect(() => {
    reconcileDailyTotals(); // summarise recent days first, before their oldest meals expire
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
