import { createStore } from "./store";
import type { Profile } from "./types";

export const profileStore = createStore<Profile>("calorie-tracker:profile");
