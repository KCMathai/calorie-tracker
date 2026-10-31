"use client";

import { shiftDay } from "@/lib/entries";
import { profileStore } from "@/lib/profile";
import { formatMl, waterGoal, waterSettingsStore, waterStore } from "@/lib/water";
import { CalorieChart } from "./charts";
import { Stat } from "./Stat";

/** Water per day for the selected range, against the goal. */
export function WaterHistory({ today, range }: { today: string; range: number }) {
  const days = waterStore.useValue() ?? [];
  const goal = waterGoal(waterSettingsStore.useValue(), profileStore.useValue());
  const dates = Array.from({ length: range }, (_, i) => shiftDay(today, i - range + 1));
  const bars = dates.map((date) => {
    const ml = days.find((d) => d.date === date)?.ml ?? 0;
    const [y, m, d] = date.split("-").map(Number);
    const js = new Date(y, m - 1, d);
    return {
      date,
      label: range <= 7 ? js.toLocaleDateString(undefined, { weekday: "short" }) : String(d),
      title: js.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
      calories: ml,
      logged: ml > 0,
    };
  });
  const logged = bars.filter((b) => b.logged);
  const average = logged.length ? Math.round(logged.reduce((s, b) => s + b.calories, 0) / logged.length) : null;
  // Each day is judged against the goal that applied that day, when known.
  const reached = logged.filter((b) => b.calories >= (days.find((d) => d.date === b.date)?.goal || goal)).length;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="water-history-heading">
      <h2 id="water-history-heading" className="text-xl font-semibold">
        💧 Water
      </h2>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Daily average" value={average !== null ? formatMl(average) : "—"} unit="on logged days" />
        <Stat label="Goal reached" value={`${reached}`} unit={`of ${logged.length} day${logged.length === 1 ? "" : "s"}`} />
        <Stat label="Goal" value={formatMl(goal)} unit="per day" />
      </div>
      {logged.length > 0 ? (
        <div className="card flex flex-col gap-2">
          <p className="text-xs text-muted">✓ marks days you reached your goal. Tap a bar for details.</p>
          <CalorieChart days={bars} target={goal} unit="ml" mode="goal" label="Water per day compared with your goal" />
        </div>
      ) : (
        <p className="text-sm text-muted">No water logged in this period. Use the 💧 buttons on the Today screen.</p>
      )}
    </section>
  );
}
