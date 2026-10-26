import webpush from "web-push";
import type { PushRecord } from "./notifications";

/** Server side of phone notifications. */

export function pushConfigured() {
  return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

/** Sends one notification. "gone" means the device unsubscribed and its record should be deleted. */
export async function sendPush(
  sub: Pick<PushRecord, "endpoint" | "keys">,
  payload: { title: string; body: string; url?: string; tag?: string },
  contactUrl: string,
): Promise<"ok" | "gone" | "error"> {
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), {
      vapidDetails: {
        // Push services may use this to contact the sender; the app's own address is accepted.
        subject: process.env.VAPID_SUBJECT || contactUrl,
        publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        privateKey: process.env.VAPID_PRIVATE_KEY!,
      },
      TTL: 60 * 60 * 3, // drop reminders a phone hasn't received within 3 hours
      urgency: "normal",
    });
    return "ok";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "error";
  }
}

export function isPushRecord(v: unknown): v is PushRecord {
  const r = v as PushRecord | null;
  return !!r && typeof r.endpoint === "string" && r.endpoint.startsWith("https://") && !!r.keys?.p256dh && !!r.keys?.auth;
}
