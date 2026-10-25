@AGENTS.md

# Calorie Tracker

A personal calorie counter and diet tracker. Mobile-first web app.

## Stack
- Next.js 16 (App Router, `src/` dir, Cache Components on) + TypeScript + Tailwind CSS v4
- No backend and no accounts: all data lives in the browser's localStorage
- Run: `npm run dev` → http://localhost:3000

## Decisions (agreed with the owner)
- **Photo recognition:** runs fully in the browser (on-device model) — no paid AI APIs, photos never leave the device. It identifies the dish only; the user picks the portion size, and calories come from a free nutrition database.
- **Barcode scanning:** packaged foods via the free Open Food Facts database.
- **Alerts:** in-app only for v1 (over-limit warning, under-target banner in the evening). Phone push notifications are a possible v2.
- **Calorie target:** Mifflin-St Jeor BMR × activity factor, adjusted for goal; user can override. Metric units (cm, kg).

## Code layout
- `src/lib/` — pure logic and storage (`calories.ts`, `store.ts`, `types.ts`)
- `src/components/` — client components
- `src/app/` — routes: `/` Today, `/log`, `/history`, `/settings`

## Conventions
- Read/write persisted data only through `createStore` in `src/lib/store.ts` (handles server rendering and hydration safely).
- Keep it simple and mobile-friendly; support light and dark mode.
- Health numbers are estimates — say so in the UI; never present them as medical advice.

## Known issue: stale CSS in dev
On this machine Turbopack sometimes keeps serving an old copy of `src/app/globals.css`
after it is edited (even across restarts). Fix: stop the dev server, delete `.next/`, start again.
After editing globals.css, verify the served CSS actually contains the change.

## Working with the owner
- The owner is a beginner: explain changes in plain language.
- Ask for approval before each build step, before installing packages, and before downloads.
- Commit to git after each working feature.
