import type { AlertSettings } from "./alertRules";
import { createStore } from "./store";

export { alertStatus, DEFAULT_ALERTS, type AlertSettings, type AlertStatus } from "./alertRules";

export const alertsStore = createStore<AlertSettings>("calorie-tracker:alerts");
