@AGENTS.md

# Calorie Tracker

A personal calorie counter and diet tracker. Mobile-first web app.

## Stack
- Next.js 16 (App Router, `src/` dir, Cache Components on) + TypeScript + Tailwind CSS v4 via `@tailwindcss/postcss`
  (not `@tailwindcss/turbopack`, which served stale CSS on this machine)
- Database: a Google Sheet owned by kevincmathews20112003@gmail.com, reached through a
  Google Apps Script web app (`google-apps-script/Code.gs`). Setup: `docs/GOOGLE-SHEETS-SETUP.md`.
- `/api/sync` relays to Apps Script; secrets live in `.env.local` (`SHEETS_WEBAPP_URL`, `SHEETS_SECRET`, `APP_PASSCODE`)
- The browser keeps a localStorage copy + an outbox of pending changes (`src/lib/sync.ts`); the sheet is the source of truth
- Run: `npm run dev` → http://localhost:3000

## Decisions (agreed with the owner)
- **Photo recognition:** runs fully in the browser — no paid AI APIs, photos never leave the device.
  Transformers.js (`@huggingface/transformers`) in a Web Worker (`src/lib/food-classifier.worker.ts`) with
  `onnx-community/swin-finetuned-food101-ONNX` (Apache-2.0, q8 ≈ 93 MB, downloaded once and cached by the browser).
  It knows the 101 Food-101 dishes only; the user picks a guess and a portion, and nutrition comes from the
  built-in table in `src/lib/foodNutrition.ts` (estimates). Unknown dishes → type it in.
- **Taught foods (⭐ My foods):** when a photo isn't recognised, the user can teach it. The worker also runs
  `Xenova/dinov2-small` (q8 ≈ 24 MB) to make a 384-number fingerprint of each photo (pooled [CLS]; patch-average
  was tested and separated dishes worse). Fingerprints are int8-packed text (`src/lib/embedding.ts`), matched by
  cosine similarity (threshold 0.45, measured: different dishes ≤ 0.44) in `src/lib/myFoods.ts`. Confirming a
  match stores another example (max 8 per food). Synced to the sheet's MyFoods / MyFoodPhotos tabs; taught-food
  ops are held back while the deployed Apps Script is older (detected by `myFoods` missing from its response).
- **Barcode scanning:** `src/components/BarcodeScanner.tsx` — live camera, photo of a barcode, or typed number.
  Uses the native `BarcodeDetector` when it supports EAN/UPC, else the `barcode-detector` ponyfill (ZXing WASM).
  The WASM is self-hosted at `/zxing/zxing_reader.wasm`, copied from node_modules by the `postinstall` script
  (`public/zxing/` is gitignored). Lookups go through `/api/barcode` → Open Food Facts v2 (ODbL; ~15 reads/min/IP).
- **Alerts:** in-app only for v1 (over-limit warning, under-target banner in the evening). Phone push notifications are a possible v2.
- **History & weight:** `/history` — 7/30-day calorie chart vs target, day-by-day list, weigh-ins (one per day,
  `src/lib/weights.ts`). The latest weigh-in updates the profile weight and, unless the target is custom, the
  daily target. Charts are hand-written SVG in `src/components/charts.tsx`; one validated green (`--chart`) for
  marks in both themes, and "over target" is shown with ▲ + text, never red-vs-green.
- **Retention:** food logs are kept 30 days (nightly Apps Script cleanup + local pruning). Preferences, weigh-ins
  (with optional height), daily totals (`src/lib/dailyTotals.ts`, one row per day incl. that day's target) and taught
  foods are kept forever. Daily totals are refreshed on every food change; days older than 30 are never recomputed.
- **Passcode lock:** `src/components/AuthGate.tsx` shows only a lock screen until the device is unlocked (checked via
  an empty `/api/sync`). A `bad_passcode` sync locks the device again. "Lock app on this device" clears all local data.
- **Favourites & quick add:** favourites live in preferences (`setPref favorites`, `src/lib/favorites.ts`); the Log
  screen's Quick add shows favourites and recent foods (from the last 30 days) for one-tap logging with Undo.
- **Water:** `src/lib/water.ts` — one row per day (ml + that day's goal) in the sheet's Water tab (feature `water`,
  Apps Script v5), goal in preference `water` (suggested 35 ml/kg). Today card buttons, History chart (shared
  `CalorieChart` in "goal" mode with ✓ markers).
- **Export:** `src/lib/exportData.ts` builds CSVs on the device (BOM for Excel, formula-safe cells); `/report` is a
  printable summary (print CSS in `globals.css` hides nav and `.no-print`, forces light colours).
- **Installable app:** `src/app/manifest.ts`, icons drawn in code (`src/app/icon.tsx`, `apple-icon.tsx`,
  `src/components/AppIconArt.tsx`). Phone guide: `docs/PHONE-SETUP.md`.
- **Phone notifications:** `public/sw.js` (never cached, see `next.config.ts` headers) shows pushes. Devices subscribe
  in Settings; each subscription is stored as preference `push-<deviceId>`, plus `appUrl` and `notifications`.
  The Apps Script `notifyTick` (hourly trigger from `setupNotifications`) POSTs prefs + recent food to `/api/notify`
  (auth: SHEETS_SECRET), which applies `src/lib/notifyRules.ts` and sends via `web-push`; the script records
  `notify-sent` (once per day per reminder) and deletes gone devices. Keys: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`. Server code must not import `src/lib/store.ts` (React hook) — pure rules live in `alertRules.ts`.
- **Script versions:** the Apps Script returns `features` (v3+); `featureOf()` in `sync.ts` holds back ops the deployed
  script can't store, and `replayOnDevice()` re-applies them after the sheet's copy replaces the device's.
- **Calorie target:** Mifflin-St Jeor BMR × activity factor, adjusted for goal; user can override. Metric units (cm, kg).

## Code layout
- `src/lib/` — pure logic and storage (`calories.ts`, `store.ts`, `types.ts`)
- `src/components/` — client components
- `src/app/` — routes: `/` Today, `/log`, `/history`, `/settings`

## Conventions
- Read persisted data through the stores (`createStore` in `src/lib/store.ts`, which handles server rendering and hydration).
- Change user data only through `src/lib/actions.ts`, so every change is queued for Google Sheets.
- If you change `Code.gs`, the owner must paste it again and redeploy (Manage deployments → new version).
- Keep it simple and mobile-friendly; support light and dark mode.
- Health numbers are estimates — say so in the UI; never present them as medical advice.

## Working with the owner
- The owner is a beginner: explain changes in plain language.
- Ask for approval before each build step, before installing packages, and before downloads.
- Commit to git after each working feature.
