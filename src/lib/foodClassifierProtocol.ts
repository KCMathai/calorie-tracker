/** Swin model fine-tuned on Food-101 (Apache-2.0, ~92% accuracy on that dataset). 8-bit build ≈ 93 MB. */
export const FOOD_MODEL = {
  id: "onnx-community/swin-finetuned-food101-ONNX",
  dtype: "q8",
  approxDownloadMB: 93,
} as const;

/**
 * General-purpose image model (Meta's DINOv2-small, Apache-2.0) used to make a
 * "visual fingerprint" of each photo, so foods the user taught can be recognised. 8-bit ≈ 24 MB.
 */
export const EMBEDDING_MODEL = {
  id: "Xenova/dinov2-small",
  dtype: "q8",
  approxDownloadMB: 24,
} as const;

export const TOTAL_DOWNLOAD_MB = FOOD_MODEL.approxDownloadMB + EMBEDDING_MODEL.approxDownloadMB;

export interface FoodGuess {
  label: string;
  score: number;
}

export type WorkerRequest = { id: number; image: Blob };

export type WorkerResponse =
  | { type: "progress"; model: "food" | "embedding"; progress: number; loaded: number; total: number }
  | { type: "analysing"; id: number }
  /** embedding is null if the fingerprint model couldn't run; dish guesses still work then */
  | { type: "result"; id: number; results: FoodGuess[]; embedding: string | null }
  | { type: "error"; id: number; message: string };
