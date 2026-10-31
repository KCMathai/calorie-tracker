"use client";

import { profileStore } from "@/lib/profile";
import { AlertSettingsForm } from "./AlertSettingsForm";
import { ExportCard } from "./ExportCard";
import { FavoritesSettings } from "./FavoritesSettings";
import { GoalForm } from "./GoalForm";
import { MyFoodsSettings } from "./MyFoodsSettings";
import { NotificationSettingsCard } from "./NotificationSettings";
import { SyncSettings } from "./SyncSettings";
import { WaterSettingsCard } from "./WaterSettingsCard";

export function SettingsView() {
  const profile = profileStore.useValue();

  if (profile === undefined) return <p className="text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted">Update your details, daily calorie target and alerts.</p>
      </header>
      <GoalForm initial={profile} />
      <WaterSettingsCard />
      <AlertSettingsForm />
      <NotificationSettingsCard />
      <FavoritesSettings />
      <MyFoodsSettings />
      <ExportCard />
      <SyncSettings />
    </div>
  );
}
