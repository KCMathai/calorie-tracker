/**
 * Looks up a packaged food by barcode in Open Food Facts (free, open database).
 * Runs on the server so we can send the identifying User-Agent their API asks for.
 */
import type { BarcodeProduct } from "@/lib/barcodeTypes";

const USER_AGENT = "CalorieTracker/0.1 (personal diet tracking app)";
const FIELDS = "product_name,product_name_en,generic_name,brands,serving_size,serving_quantity,nutriments";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim() ?? "";
  if (!/^\d{8,14}$/.test(code)) {
    return Response.json({ ok: false, error: "invalid_barcode" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`, {
      headers: { "User-Agent": USER_AGENT },
      cache: "no-store",
    });
  } catch {
    return Response.json({ ok: false, error: "lookup_failed" }, { status: 502 });
  }
  if (res.status === 404) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  if (res.status === 429 || res.status === 503) return Response.json({ ok: false, error: "busy" }, { status: 503 });
  if (!res.ok) return Response.json({ ok: false, error: "lookup_failed" }, { status: 502 });

  const data = await res.json().catch(() => null);
  const p = data?.product;
  if (!data || data.status !== 1 || !p) return Response.json({ ok: false, error: "not_found" }, { status: 404 });

  const n = p.nutriments ?? {};
  const kcal = num(n["energy-kcal_100g"]) ?? kjToKcal(num(n["energy-kj_100g"]) ?? num(n["energy_100g"]));
  if (kcal === undefined) return Response.json({ ok: false, error: "no_nutrition" }, { status: 404 });

  const product: BarcodeProduct = {
    barcode: code,
    name: (p.product_name || p.product_name_en || p.generic_name || "Unnamed product").trim(),
    brand: typeof p.brands === "string" && p.brands ? p.brands.split(",")[0].trim() : undefined,
    servingSize: typeof p.serving_size === "string" && p.serving_size ? p.serving_size : undefined,
    servingGrams: num(p.serving_quantity),
    per100: {
      calories: kcal,
      protein: num(n.proteins_100g),
      carbs: num(n.carbohydrates_100g),
      fat: num(n.fat_100g),
    },
  };
  return Response.json({ ok: true, product });
}

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : undefined;
}

function kjToKcal(kj: number | undefined) {
  return kj === undefined ? undefined : Math.round(kj / 4.184);
}
