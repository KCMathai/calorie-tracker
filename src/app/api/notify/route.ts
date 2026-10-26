import { timingSafeEqual } from "node:crypto";
import type { AlertSettings } from "@/lib/alertRules";
import type { NotificationSettings } from "@/lib/notifications";
import { dueNotifications, localTime } from "@/lib/notifyRules";
import { isPushRecord, pushConfigured, sendPush } from "@/lib/pushServer";
import type { Profile } from "@/lib/types";

/**
 * Called about once an hour by the Google Sheet's Apps Script (notifyTick),
 * with your preferences and recent food log. Sends any reminders that are due
 * and reports back what was sent and which devices have gone away.
 * Authenticated with the same secret the app uses to talk to the sheet.
 */
export async function POST(request: Request) {
  const secret = process.env.SHEETS_SECRET;
  if (!secret) return Response.json({ ok: false, error: "not_configured" }, { status: 503 });

  let body: { secret?: string; prefs?: Record<string, unknown>; entries?: { date: string; meal: string; calories: number }[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  if (!safeEqual(String(body.secret ?? ""), secret)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!pushConfigured()) return Response.json({ ok: false, error: "push_not_configured" }, { status: 503 });

  const prefs = body.prefs ?? {};
  const settings = prefs.notifications as NotificationSettings | undefined;
  const subs = Object.entries(prefs).filter(([k, v]) => k.startsWith("push-") && isPushRecord(v)) as [string, Parameters<typeof sendPush>[0]][];
  if (!settings || subs.length === 0) return Response.json({ ok: true, sent: [], gone: [] });

  const now = new Date();
  const { date } = localTime(now, settings.timeZone || "UTC");
  const log = prefs["notify-sent"] as { date?: string; keys?: string[] } | undefined;
  const due = dueNotifications({
    now,
    settings,
    alerts: prefs.alerts as AlertSettings | undefined,
    target: (prefs.profile as Profile | undefined)?.calorieTarget,
    entries: Array.isArray(body.entries) ? body.entries : [],
    alreadySent: log?.date === date ? (log.keys ?? []) : [],
  });

  const origin = new URL(request.url).origin;
  const gone = new Set<string>();
  const sent: string[] = [];
  for (const n of due) {
    const results = await Promise.all(
      subs.map(async ([key, sub]) => {
        const r = await sendPush(sub, { title: n.title, body: n.body, url: n.url, tag: n.key }, origin);
        if (r === "gone") gone.add(key);
        return r;
      }),
    );
    if (results.includes("ok")) sent.push(n.key);
  }
  return Response.json({ ok: true, date, sent, gone: [...gone] });
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
