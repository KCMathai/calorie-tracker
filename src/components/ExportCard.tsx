"use client";

import Link from "next/link";
import { dailyTotalsStore } from "@/lib/dailyTotals";
import { dayKey, entriesStore } from "@/lib/entries";
import { dailyTotalsCsv, foodLogCsv, saveFile, waterCsv, weightCsv } from "@/lib/exportData";
import { waterStore } from "@/lib/water";
import { weightsStore } from "@/lib/weights";

/** Download your data as spreadsheets, or open a printable report. */
export function ExportCard() {
  const entries = entriesStore.useValue() ?? [];
  const totals = dailyTotalsStore.useValue() ?? [];
  const weights = weightsStore.useValue() ?? [];
  const water = waterStore.useValue() ?? [];
  const stamp = dayKey(new Date());

  const files = [
    { label: "Food log", note: "last 30 days, every food", count: entries.length, make: () => foodLogCsv(entries), name: "food-log" },
    { label: "Daily totals", note: "every day, kept forever", count: totals.length, make: () => dailyTotalsCsv(totals), name: "daily-totals" },
    { label: "Weight & height", note: "all weigh-ins", count: weights.length, make: () => weightCsv(weights), name: "weight-height" },
    { label: "Water", note: "every day", count: water.length, make: () => waterCsv(water), name: "water" },
  ];

  return (
    <section className="card flex flex-col gap-3">
      <div>
        <h2 className="font-medium">📤 Export your data</h2>
        <p className="text-sm text-muted">
          Spreadsheet files (CSV) open in Excel, Google Sheets or Numbers. Your full data is also always in your Google Sheet.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-[var(--border)]">
        {files.map((f) => (
          <li key={f.name} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{f.label}</p>
              <p className="text-xs text-muted">
                {f.note} · {f.count} row{f.count === 1 ? "" : "s"}
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary shrink-0 !py-1.5 text-sm"
              disabled={f.count === 0}
              onClick={() => saveFile(`calorie-tracker-${f.name}-${stamp}.csv`, f.make())}
            >
              Download
            </button>
          </li>
        ))}
      </ul>
      <Link href="/report" className="btn-secondary text-center">
        🖨️ Printable report (save as PDF)
      </Link>
    </section>
  );
}
