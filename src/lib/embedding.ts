/**
 * Visual fingerprints ("embeddings") of photos: a list of numbers where similar
 * images get similar lists. Packed into short text for storage in the sheet.
 * Kept free of React so the background worker can use it.
 */

const PREFIX = "e1:";

/** Normalises and packs a float vector into a short text string (1 byte per value). */
export function encodeEmbedding(vector: ArrayLike<number>): string {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm) || 1;
  // Unit vectors have small components; scale so the largest uses the full int8 range.
  let max = 0;
  for (let i = 0; i < vector.length; i++) max = Math.max(max, Math.abs(vector[i] / norm));
  const scale = max ? 127 / max : 1;
  const bytes = new Uint8Array(vector.length);
  for (let i = 0; i < vector.length; i++) bytes[i] = (Math.round((vector[i] / norm) * scale) + 256) % 256;
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  // base64url with a prefix, so the text never starts with characters spreadsheets treat as formulas
  return PREFIX + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeEmbedding(text: string): Float32Array | null {
  if (!text.startsWith(PREFIX)) return null;
  try {
    const b64 = text.slice(PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const out = new Float32Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      const b = binary.charCodeAt(i);
      out[i] = b > 127 ? b - 256 : b;
    }
    return out;
  } catch {
    return null;
  }
}

/** Cosine similarity, -1…1 (1 = same direction). */
export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) return -1;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : -1;
}
