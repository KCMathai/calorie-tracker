import type { BarcodeProduct } from "./barcodeTypes";

export type { BarcodeProduct };

/** Food packaging barcodes. */
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

interface Detector {
  detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}

let detector: Promise<Detector> | null = null;

/** Uses the browser's built-in scanner when it has one (e.g. Android Chrome), otherwise a WebAssembly one. */
export function getBarcodeDetector(): Promise<Detector> {
  detector ??= (async () => {
    const Native = (globalThis as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } })
      .BarcodeDetector;
    if (Native) {
      const supported = await Native.getSupportedFormats().catch(() => [] as string[]);
      if (FORMATS.every((f) => supported.includes(f))) return new Native({ formats: [...FORMATS] });
    }
    const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
    prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `/zxing/${path}` : prefix + path),
      },
    });
    return new BarcodeDetector({ formats: [...FORMATS] });
  })();
  return detector;
}

export type LookupResult =
  | { ok: true; product: BarcodeProduct }
  | { ok: false; error: "not_found" | "no_nutrition" | "invalid_barcode" | "busy" | "lookup_failed" | "offline" };

export async function lookupBarcode(code: string): Promise<LookupResult> {
  try {
    const res = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`);
    return (await res.json()) as LookupResult;
  } catch {
    return { ok: false, error: navigator.onLine ? "lookup_failed" : "offline" };
  }
}
