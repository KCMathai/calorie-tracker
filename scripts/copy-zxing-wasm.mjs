// Copies the barcode-reading engine (WebAssembly) into public/ so the app serves it itself
// instead of loading it from a CDN. Runs automatically after `npm install`.
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const src = require.resolve("zxing-wasm/reader/zxing_reader.wasm");
const destDir = join(process.cwd(), "public", "zxing");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, "zxing_reader.wasm"));
console.log("Copied zxing_reader.wasm to public/zxing/");
