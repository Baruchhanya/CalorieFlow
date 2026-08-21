import { FoodItem } from "@/types";
import { searchTzameret, scaleToGrams } from "@/lib/tzameret";
import { estimateFallbackNutrition, type GeminiUsage } from "@/lib/gemini";

export interface EnrichmentResult {
  items: FoodItem[];
  /** Set only when at least one item needed a fallback re-estimate (GEMINI_FALLBACK_MODEL call happened). */
  fallbackUsage?: GeminiUsage;
}

// Any single Tzameret text-search match can occasionally land on a wildly
// different food that happens to share words (e.g. "ביצה" -> dried egg powder
// at 605 kcal/100g instead of a plain egg at ~155). Rather than trust the DB
// unconditionally, sanity-check it against Gemini's own first-pass estimate for
// the same item — a huge disagreement is a stronger signal of a bad match than
// of Gemini being wrong, so treat it as unmatched and let the fallback model
// (which sees the full item description, not just a 2-3 word search term) decide.
const MAX_PLAUSIBLE_RATIO = 3;
const MIN_PLAUSIBLE_RATIO = 1 / 3;

function isPlausible(dbCalories: number, geminiCalories: number): boolean {
  if (geminiCalories <= 0) return true; // nothing to compare against
  const ratio = dbCalories / geminiCalories;
  return ratio <= MAX_PLAUSIBLE_RATIO && ratio >= MIN_PLAUSIBLE_RATIO;
}

/**
 * Nutrition pipeline for a Gemini-analyzed meal:
 * 1. Try to match each item against the Tzameret (Israeli MoH) database by name + weight.
 * 2. Sanity-check the match against Gemini's own estimate; discard implausible outliers.
 * 3. For items with no (plausible) match, batch them into a single fallback call to a
 *    stronger Gemini model to re-estimate (better than the cheap model's first-pass guess).
 * 4. Any item that still fails (lookup error, fallback call error) keeps its original
 *    cheap-model estimate from the initial analyze call — this function never throws.
 */
export async function enrichItemsWithTzameret(items: FoodItem[]): Promise<EnrichmentResult> {
  const matched = await Promise.all(
    items.map(async (item) => {
      if (!item.db_search_term_he || !item.quantity_grams) return item;
      try {
        const match = await searchTzameret(item.db_search_term_he);
        if (!match) return null;
        const scaled = scaleToGrams(match.per100g, item.quantity_grams);
        if (!isPlausible(scaled.calories, item.calories)) {
          console.warn(
            `Tzameret match rejected as implausible: "${item.db_search_term_he}" -> "${match.nameHe}" ` +
              `(${scaled.calories} kcal vs Gemini's ${item.calories} kcal estimate)`
          );
          return null;
        }
        return { ...item, ...scaled };
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
