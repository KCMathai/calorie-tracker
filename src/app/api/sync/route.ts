import { timingSafeEqual } from "node:crypto";

/**
 * Relays sync requests to the Google Apps Script web app.
 * The Apps Script URL and secret stay on the server; the browser only
 * sends the app passcode (if one is configured).
 */
export async function POST(request: Request) {
  const url = process.env.SHEETS_WEBAPP_URL;
  const secret = process.env.SHEETS_SECRET;
  if (!url || !secret) {
    return Response.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const passcode = process.env.APP_PASSCODE;
  if (passcode && !safeEqual(request.headers.get("x-app-passcode") ?? "", passcode)) {
    return Response.json({ ok: false, error: "bad_passcode" }, { status: 401 });
  }

  let ops: unknown;
  try {
    ({ ops } = await request.json());
  } catch {
    return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  if (!Array.isArray(ops) || ops.length > 500) {
    return Response.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  try {
    // Apps Script answers with a redirect to the result; fetch follows it.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret, ops }),
      redirect: "follow",
      cache: "no-store",
    });
    const text = await res.text();
    let data: { ok?: boolean; error?: string };
    try {
      data = JSON.parse(text);
    } catch {
      // Usually means the web app isn't deployed with "Anyone" access.
      return Response.json({ ok: false, error: "sheets_unreachable" }, { status: 502 });
    }
    if (!data.ok) {
      return Response.json({ ok: false, error: data.error === "unauthorized" ? "sheets_secret_mismatch" : "sheets_error" }, { status: 502 });
    }
    return Response.json(data);
  } catch {
    return Response.json({ ok: false, error: "sheets_unreachable" }, { status: 502 });
  }
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
