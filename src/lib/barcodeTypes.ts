export interface Per {
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand?: string;
  /** e.g. "30 g" as printed on the pack */
  servingSize?: string;
  /** grams (or ml) in one serving, if known */
  servingGrams?: number;
  per100: Per;
}
