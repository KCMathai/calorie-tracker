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
- **Barcode scanning:** packaged foods via the free Open Food Facts database.
- **Alerts:** in-app only for v1 (over-limit warning, under-target banner in the evening). Phone push notifications are a possible v2.
- **Retention:** food logs are kept 30 days (nightly Apps Script cleanup + local pruning). Preferences and weight are kept forever.
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
