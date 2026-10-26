/// <reference lib="webworker" />
// Runs the food-recognition models off the main thread so the page stays responsive.
import {
  pipeline,
  RawImage,
  type ImageClassificationPipeline,
  type ImageFeatureExtractionPipeline,
  type Tensor,
} from "@huggingface/transformers";
import { encodeEmbedding } from "./embedding";
import { EMBEDDING_MODEL, FOOD_MODEL, type WorkerRequest, type WorkerResponse } from "./foodClassifierProtocol";

let classifier: Promise<ImageClassificationPipeline> | null = null;
let embedder: Promise<ImageFeatureExtractionPipeline> | null = null;

function post(message: WorkerResponse) {
  self.postMessage(message);
}

function progressFor(model: "food" | "embedding") {
  return (p: { status: string; progress?: number; loaded?: number; total?: number }) => {
    if (p.status === "progress_total") {
      post({ type: "progress", model, progress: p.progress ?? 0, loaded: p.loaded ?? 0, total: p.total ?? 0 });
    }
  };
}

function loadClassifier() {
  classifier ??= pipeline("image-classification", FOOD_MODEL.id, {
    dtype: FOOD_MODEL.dtype,
    progress_callback: progressFor("food"),
  }) as Promise<ImageClassificationPipeline>;
  return classifier;
}

function loadEmbedder() {
  embedder ??= pipeline("image-feature-extraction", EMBEDDING_MODEL.id, {
    dtype: EMBEDDING_MODEL.dtype,
    progress_callback: progressFor("embedding"),
  }) as Promise<ImageFeatureExtractionPipeline>;
  return embedder;
}

/**
 * One vector per image: the model's pooled [CLS] summary. (Averaging the patch tokens was
 * tried too; it rated different dishes as more alike, e.g. dosa vs idli 0.77 vs 0.44 here.)
 */
async function fingerprint(image: RawImage): Promise<string> {
  const model = await loadEmbedder();
  let tensor: Tensor;
  try {
    tensor = await model(image, { pool: true });
  } catch {
    const hidden = await model(image, { pool: false }); // [1, tokens, dims]
    const dims = hidden.dims[2];
    tensor = hidden.slice(null, [0, 1], null).view(1, dims);
  }
  return encodeEmbedding(tensor.data as Float32Array);
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, image } = event.data;
  try {
    // Start both downloads together on first use.
    const [model] = await Promise.all([loadClassifier(), loadEmbedder().catch(() => null)]);
    post({ type: "analysing", id });
    const raw = await RawImage.fromBlob(image);
    const output = await model(raw, { top_k: 5 });
    const results = (Array.isArray(output[0]) ? output[0] : output) as { label: string; score: number }[];
    let embedding: string | null = null;
    try {
      embedding = await fingerprint(raw);
    } catch {
      embedder = null; // retry next time; dish guesses still work without it
    }
    post({ type: "result", id, results, embedding });
  } catch (err) {
    classifier = null; // allow a retry, e.g. after a failed download
    post({ type: "error", id, message: err instanceof Error ? err.message : String(err) });
  }
};
