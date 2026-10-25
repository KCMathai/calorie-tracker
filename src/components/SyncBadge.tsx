"use client";

import Link from "next/link";
import { usePendingCount, useSyncStatus } from "@/lib/sync";
import { STATUS_TEXT } from "./SyncSettings";

/** Small notice shown only when syncing needs attention. */
export function SyncBadge() {
  const { state } = useSyncStatus();
  const pending = usePendingCount();
  const problem = state === "bad_passcode" || state === "error" || (state === "offline" && pending > 0);
  if (!problem) return null;
  return (
    <Link href="/settings" className="block rounded-lg bg-[var(--surface-hover)] px-3 py-2 text-xs text-muted">
      ☁️ {STATUS_TEXT[state]} — tap for details
    </Link>
  );
}
