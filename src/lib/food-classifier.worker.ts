/// <reference lib="webworker" />
// Runs the food-recognition model off the main thread so the page stays responsive.
import { pipeline, RawImage, type ImageClassificationPipeline } from "@huggingface/transformers";
import { FOOD_MODEL, type WorkerRequest, type WorkerResponse } from "./foodClassifierProtocol";

let classifier: Promise<ImageClassificationPipeline> | null = null;

function post(message: WorkerResponse) {
  self.postMessage(message);
}

function load() {
  classifier ??= pipeline("image-classification", FOOD_MODEL.id, {
    dtype: FOOD_MODEL.dtype,
    progress_callback: (p) => {
      if (p.status === "progress_total") post({ type: "progress", progress: p.progress, loaded: p.loaded, total: p.total });
    },
  }) as Promise<ImageClassificationPipeline>;
  return classifier;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, image } = event.data;
  try {
    const model = await load();
    post({ type: "analysing", id });
    const output = await model(await RawImage.fromBlob(image), { top_k: 5 });
    const results = (Array.isArray(output[0]) ? output[0] : output) as { label: string; score: number }[];
    post({ type: "result", id, results });
  } catch (err) {
    classifier = null; // allow a retry, e.g. after a failed download
    post({ type: "error", id, message: err instanceof Error ? err.message : String(err) });
  }
};
