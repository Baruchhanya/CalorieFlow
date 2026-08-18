// Israeli Ministry of Health national nutrition database ("Tzameret").
// Public CKAN datastore, no API key required: https://data.gov.il/dataset/nutrition-database
const TZAMERET_RESOURCE_ID = "c3cb0630-0650-46c1-a068-82d575c094b2";
const DATASTORE_SEARCH_URL = "https://data.gov.il/api/3/action/datastore_search";

interface TzameretRawRecord {
  shmmitzrach: string;
  english_name: string | null;
  food_energy: number | null;
  protein: number | null;
  total_fat: number | null;
  carbohydrates: number | null;
}

export interface TzameretMatch {
  nameHe: string;
  nameEn: string | null;
  /** Values are per 100g of food. */
  per100g: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
}

// Only the leading tokens of a Tzameret name identify the food itself; tokens
// further in are brand names or deep modifiers ("שטראוס", "בטעם פאי תפוחים...").
// Note: unlike a plain ingredient list, Tzameret also files ~1,400 prepared
// dishes/recipes in this same table, and naming isn't consistently comma-delimited
// ("שניצל חזה עוף מטוגן בשמן זית" has no commas at all) — so we tokenize on both
// commas AND whitespace rather than relying on comma-segment position.
const MATCH_WINDOW = 6;

function tokenize(text: string): string[] {
  return text
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// Modifiers implying a different processed/cooked state than a plain generic
// query meant (e.g. banana chips at 519 kcal/100g vs fresh banana at 89). Only
// disqualifies a candidate when the query itself didn't already ask for it —
// a query like "שניצל עוף מטוגן" should still match fried-schnitzel entries.
const NOISY_MODIFIERS = [
  "לא מבושל",
  "מטוגן",
  "מטוגנת",
  "טוגנים",
  "טוגן",
  "צ'יפס",
  "בבלילה",
  "בציפוי",
  "ברוטב",
  "קלוי",
  "ממולא",
  // A flour/starch product is a different food than the whole ingredient
  // ("קמח אורז" = rice flour, not rice) even though it shares the query's words.
  "קמח",
];

// Entries measured with inedible parts included (peel/bone/pit) understate the
// calorie density of what someone actually eats. Prefer an edible-portion entry
// when the candidate set has one; only fall back to these if it's all there is.
const INEDIBLE_PARTS_PATTERN = /עם קליפה|עם עצם|עם גרעין|עם זרעים/;

// Specific restaurant-chain products (e.g. "חזה עוף" matching a McDonald's wrap)
// aren't a reasonable stand-in for a generic home-cooked query unless the user
// actually named the chain. Deprioritize known chains; only used as a last resort.
const RESTAURANT_CHAIN_PATTERN =
  /מקדונלדס|מקדונלד|ברגר קינג|קנטאקי|KFC|דומינוס|פיצה האט|ארומה|קפה קפה|קופיקס|גרג|קסטרו/;

/**
 * Searches the Tzameret database by free-text name. Works best with short, generic
 * Hebrew terms (e.g. "חזה עוף", "בננה", "שניצל עוף מטוגן"), not full branded names.
 *
 * CKAN's relevance ranking surfaces branded/composite products ahead of the plain
 * generic item (e.g. "בננה" ranks a baby-food banana puree above fresh banana). To
 * get a trustworthy match instead of a plausible-looking wrong one, we require every
 * query word to appear as a whole word within the record's first few tokens (its
 * "identity", before brand/deep modifiers), reject state modifiers the query didn't
 * ask for, and prefer the least-modified matching entry. When nothing clears that
 * bar, we return null — the caller falls back to Gemini's own estimate rather than
 * risk a confidently wrong database number.
 */
export async function searchTzameret(query: string): Promise<TzameretMatch | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const queryTokens = tokenize(trimmed);
  const unwantedModifiers = NOISY_MODIFIERS.filter((m) => !trimmed.includes(m));

  const url = `${DATASTORE_SEARCH_URL}?resource_id=${TZAMERET_RESOURCE_ID}&q=${encodeURIComponent(trimmed)}&limit=20`;

  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;

  const body = await res.json();
  const records: TzameretRawRecord[] = body?.result?.records ?? [];

  let candidates = records.filter((r) => {
    if (r.food_energy == null) return false;
    const recordTokens = tokenize(r.shmmitzrach).slice(0, MATCH_WINDOW);
    if (!queryTokens.every((qt) => recordTokens.includes(qt))) return false;
    return !unwantedModifiers.some((m) => r.shmmitzrach.includes(m));
  });
  if (candidates.length === 0) return null;

  const edibleOnly = candidates.filter((r) => !INEDIBLE_PARTS_PATTERN.test(r.shmmitzrach));
  if (edibleOnly.length > 0) candidates = edibleOnly;

  const nonChain = candidates.filter((r) => !RESTAURANT_CHAIN_PATTERN.test(r.shmmitzrach));
  if (nonChain.length > 0) candidates = nonChain;

  // Prefer the entry with the fewest tokens overall. Tzameret's naming isn't
  // consistently comma-delimited (some prepared dishes are one flat phrase with
  // no commas at all), so raw word count is a steadier "how modified is this
  // name" signal than comma-segment count.
  const minTokens = Math.min(...candidates.map((r) => tokenize(r.shmmitzrach).length));
  const simplest = candidates.filter((r) => tokenize(r.shmmitzrach).length === minTokens);

  // Within that group, pick the median-by-calories candidate: a specific real
  // record (so its macros stay internally consistent), robust to a stray outlier.
  const sorted = [...simplest].sort((a, b) => (a.food_energy ?? 0) - (b.food_energy ?? 0));
  const record = sorted[Math.floor((sorted.length - 1) / 2)];

  return {
    nameHe: record.shmmitzrach,
    nameEn: record.english_name,
    per100g: {
      calories: record.food_energy as number,
      protein_g: record.protein ?? 0,
      carbs_g: record.carbohydrates ?? 0,
      fat_g: record.total_fat ?? 0,
    },
  };
}

/** Scales per-100g nutrition values to an item's actual weight in grams. */
export function scaleToGrams(
  per100g: TzameretMatch["per100g"],
  grams: number
): { calories: number; protein_g: number; carbs_g: number; fat_g: number } {
  const factor = grams / 100;
  return {
    calories: Math.round(per100g.calories * factor),
    protein_g: Math.round(per100g.protein_g * factor * 10) / 10,
    carbs_g: Math.round(per100g.carbs_g * factor * 10) / 10,
    fat_g: Math.round(per100g.fat_g * factor * 10) / 10,
  };
}
