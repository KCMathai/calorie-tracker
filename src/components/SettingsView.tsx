"use client";

import { profileStore } from "@/lib/profile";
import { GoalForm } from "./GoalForm";

export function SettingsView() {
  const profile = profileStore.useValue();

  if (profile === undefined) return <p className="text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted">Update your details and daily calorie target.</p>
      </header>
      <GoalForm initial={profile} />
    </div>
  );
}
