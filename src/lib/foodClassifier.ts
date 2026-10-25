import type { FoodGuess, WorkerRequest, WorkerResponse } from "./foodClassifierProtocol";

export type ClassifyProgress =
  | { stage: "downloading"; progress: number; loadedMB: number; totalMB: number }
  | { stage: "analysing" };

let worker: Worker | null = null;
let nextId = 1;

function getWorker() {
  worker ??= new Worker(new URL("./food-classifier.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

/**
 * Recognises the dish in a photo, entirely in the browser. The first call
 * downloads the model (cached by the browser afterwards).
 */
export function classifyFood(image: Blob, onProgress?: (p: ClassifyProgress) => void): Promise<FoodGuess[]> {
  const w = getWorker();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === "progress") {
        onProgress?.({
          stage: "downloading",
          progress: msg.progress,
          loadedMB: msg.loaded / 1e6,
          totalMB: msg.total / 1e6,
        });
        return;
      }
      if (msg.id !== id) return;
      if (msg.type === "analysing") {
        onProgress?.({ stage: "analysing" });
        return;
      }
      w.removeEventListener("message", onMessage);
      if (msg.type === "result") resolve(msg.results);
      else reject(new Error(msg.message));
    };
    w.addEventListener("message", onMessage);
    w.postMessage({ id, image } satisfies WorkerRequest);
  });
}
