import { cosine, decodeEmbedding } from "./embedding";
import { createStore } from "./store";

/**
 * Foods the user taught the photo recogniser. Each food has nutrition per
 * serving plus one or more "photos" — not the images themselves, just a compact
 * visual fingerprint (embedding) of each photo, used to recognise it next time.
 */
export interface MyFood {
  id: string;
  name: string;
  /** e.g. "1 plate" — what the nutrition below refers to */
  serving: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  createdAt: number;
}

export interface MyFoodPhoto {
  id: string;
  foodId: string;
  /** encoded with encodeEmbedding() */
  embedding: string;
  createdAt: number;
}

export const myFoodsStore = createStore<MyFood[]>("calorie-tracker:my-foods");
export const myFoodPhotosStore = createStore<MyFoodPhoto[]>("calorie-tracker:my-food-photos");

/** Keep the newest few examples per food; more adds little and costs space. */
export const MAX_PHOTOS_PER_FOOD = 8;

/**
 * Similarity (cosine, -1…1) above which a taught food is offered as a match.
 * Measured on test photos (dosa, idli, pizza): different dishes scored at most
 * 0.44, while most pairs of the same dish scored 0.38–0.76. The user always
 * confirms a match, so a borderline suggestion is cheaper than a missed one.
 */
export const MATCH_THRESHOLD = 0.45;

export interface MyFoodMatch {
  food: MyFood;
  score: number;
}

/** Taught foods that look like this photo, best first (each food scored by its closest example). */
export function matchMyFoods(embedding: string, foods: MyFood[], photos: MyFoodPhoto[]): MyFoodMatch[] {
  const query = decodeEmbedding(embedding);
  if (!query) return [];
  const best = new Map<string, number>();
  for (const photo of photos) {
    const vec = decodeEmbedding(photo.embedding);
    if (!vec) continue;
    const score = cosine(query, vec);
    if (score > (best.get(photo.foodId) ?? -1)) best.set(photo.foodId, score);
  }
  return foods
    .map((food) => ({ food, score: best.get(food.id) ?? -1 }))
    .filter((m) => m.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

/** Finds a taught food by name, ignoring case and extra spaces. */
export function findMyFoodByName(foods: MyFood[] | null | undefined, name: string): MyFood | undefined {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  return (foods ?? []).find((f) => f.name.trim().toLowerCase().replace(/\s+/g, " ") === key);
}
