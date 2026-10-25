"use client";

import { alertStatus, alertsStore, DEFAULT_ALERTS } from "@/lib/alerts";
import { useNow } from "@/lib/useNow";

/** Over/under-target warning for today. Renders nothing when all is well. */
export function AlertBanner({ eaten, target }: { eaten: number; target: number }) {
  const now = useNow();
  const settings = alertsStore.useValue() ?? DEFAULT_ALERTS;
  if (!now) return null;

  const status = alertStatus(eaten, target, now.getHours(), settings);
  if (!status) return null;

  if (status.kind === "over") {
    return (
      <div role="alert" className="rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-sm">
        <p className="font-semibold text-[var(--danger)]">⚠️ You&apos;re over today&apos;s target</p>
        <p>
          You&apos;ve eaten <b>{status.by.toLocaleString()} kcal</b> more than your {target.toLocaleString()} kcal goal.
        </p>
      </div>
    );
  }

  return (
    <div role="status" className="rounded-xl border border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-3 text-sm">
      <p className="font-semibold text-[var(--warning)]">🍽️ You haven&apos;t eaten enough today</p>
      <p>
        Only <b>{status.eaten.toLocaleString()}</b> of {status.target.toLocaleString()} kcal so far. Consider a balanced meal or
        snack — eating too little can leave you tired and slow your progress.
      </p>
    </div>
  );
}
