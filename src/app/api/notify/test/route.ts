import { timingSafeEqual } from "node:crypto";
import { isPushRecord, pushConfigured, sendPush } from "@/lib/pushServer";

/** Sends a test notification to the device that asked (requires the app passcode). */
export async function POST(request: Request) {
  const passcode = process.env.APP_PASSCODE;
  if (passcode && !safeEqual(request.headers.get("x-app-passcode") ?? "", passcode)) {
    return Response.json({ ok: false, error: "bad_passcode" }, { status: 401 });
  }
  if (!pushConfigured()) return Response.json({ ok: false, error: "push_not_configured" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { subscription?: unknown } | null;
  if (!isPushRecord(body?.subscription)) return Response.json({ ok: false, error: "bad_request" }, { status: 400 });

  const result = await sendPush(
    body.subscription,
    { title: "✅ Notifications are working", body: "You'll get your Calorie Tracker reminders here.", url: "/settings", tag: "test" },
    new URL(request.url).origin,
  );
  if (result === "ok") return Response.json({ ok: true });
  return Response.json({ ok: false, error: result === "gone" ? "subscription_gone" : "send_failed" }, { status: 502 });
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
