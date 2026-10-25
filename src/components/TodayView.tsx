"use client";

import { profileStore } from "@/lib/profile";
import { GoalForm } from "./GoalForm";

export function TodayView() {
  const profile = profileStore.useValue();

  if (profile === undefined) return <p className="text-muted">Loading…</p>;

  if (profile === null) {
    return (
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="text-2xl font-semibold">Welcome 👋</h1>
          <p className="text-muted">Tell us a little about yourself so we can suggest a daily calorie target.</p>
        </header>
        <GoalForm />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Today</h1>
      <section className="card">
        <p className="text-sm text-muted">Your daily target</p>
        <p className="text-4xl font-semibold tabular-nums">
          {profile.calorieTarget.toLocaleString()} <span className="text-base font-normal text-muted">kcal</span>
        </p>
      </section>
      <p className="text-sm text-muted">Food logging and your progress ring are coming in the next steps.</p>
    </div>
  );
}
