import { FoodItem } from "@/types";
import { searchTzameret, scaleToGrams } from "@/lib/tzameret";
import { estimateFallbackNutrition, type GeminiUsage } from "@/lib/gemini";

export interface EnrichmentResult {
  items: FoodItem[];
  /** Set only when at least one item needed a fallback re-estimate (GEMINI_FALLBACK_MODEL call happened). */
  fallbackUsage?: GeminiUsage;
}

/**
 * Nutrition pipeline for a Gemini-analyzed meal:
 * 1. Try to match each item against the Tzameret (Israeli MoH) database by name + weight.
 * 2. For items with no match, batch them into a single fallback call to a stronger Gemini
 *    model to re-estimate (better than the cheap model's first-pass guess).
 * 3. Any item that still fails (lookup error, fallback call error) keeps its original
 *    cheap-model estimate from the initial analyze call — this function never throws.
 */
export async function enrichItemsWithTzameret(items: FoodItem[]): Promise<EnrichmentResult> {
  const matched = await Promise.all(
    items.map(async (item) => {
      if (!item.db_search_term_he || !item.quantity_grams) return item;
      try {
        const match = await searchTzameret(item.db_search_term_he);
        if (!match) return null;
        return { ...item, ...scaleToGrams(match.per100g, item.quantity_grams) };
      } catch (err) {
        console.error("Tzameret lookup failed:", err);
        return null;
      }
    })
  );

  const unmatchedIndexes = matched
    .map((it, i) => (it === null ? i : -1))
    .filter((i) => i !== -1);

  if (unmatchedIndexes.length === 0) {
    return { items: matched as FoodItem[] };
  }

  try {
    const { estimates, usage } = await estimateFallbackNutrition(
      unmatchedIndexes.map((i) => ({ name: items[i].name, quantity: items[i].quantity }))
    );

    unmatchedIndexes.forEach((itemIdx, j) => {
      const est = estimates[j];
      matched[itemIdx] = est ? { ...items[itemIdx], ...est } : items[itemIdx];
    });

    return { items: matched as FoodItem[], fallbackUsage: usage };
  } catch (err) {
    console.error("Fallback nutrition estimate failed:", err);
    unmatchedIndexes.forEach((itemIdx) => {
      matched[itemIdx] = items[itemIdx];
    });
    return { items: matched as FoodItem[] };
  }
}
