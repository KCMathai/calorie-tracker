/** Swin model fine-tuned on Food-101 (Apache-2.0, ~92% accuracy on that dataset). 8-bit build ≈ 93 MB. */
export const FOOD_MODEL = {
  id: "onnx-community/swin-finetuned-food101-ONNX",
  dtype: "q8",
  approxDownloadMB: 93,
} as const;

export interface FoodGuess {
  label: string;
  score: number;
}

export type WorkerRequest = { id: number; image: Blob };

export type WorkerResponse =
  | { type: "progress"; progress: number; loaded: number; total: number }
  | { type: "analysing"; id: number }
  | { type: "result"; id: number; results: FoodGuess[] }
  | { type: "error"; id: number; message: string };
