import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiResponse } from "@/types";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export type AnalyzeLang = "he" | "en";

function buildPrompt(lang: AnalyzeLang): string {
  const langInstruction =
    lang === "he"
      ? `LANGUAGE — CRITICAL:
- ALL output text fields ("name", "quantity", "note") MUST be in HEBREW (עברית) ONLY.
- Even if the user input is in English, transliteration, or mixed — translate everything to clean, natural Hebrew.
- Use Hebrew names for foods (e.g. "פיצה" not "pizza", "אורז" not "rice", "סלט" not "salad").
- Quantity descriptions should also be in Hebrew (e.g. "1 כוס" not "1 cup", "200 גרם" not "200g", "2 פרוסות" not "2 slices").`
      : `LANGUAGE — CRITICAL:
- ALL output text fields ("name", "quantity", "note") MUST be in ENGLISH ONLY.
- Even if the user input is in Hebrew, translate everything to clean, natural English.`;

  return `You are a professional nutritionist and food analysis expert. Analyze the food described and return ONLY a valid JSON object with accurate nutritional information.

Return this exact JSON structure (no markdown, no code blocks, raw JSON only):
{
  "items": [
    {
      "name": "food name",
      "quantity": "amount with unit (e.g. '1 כוס', '200 גרם', '2 פרוסות')",
      "calories": <number>,
      "protein_g": <number>,
      "carbs_g": <number>,
      "fat_g": <number>
    }
  ],
  "total_calories": <number>,
  "needs_clarification": <boolean>,
  "note": "any important notes for the user (optional)"
}

${langInstruction}

CRITICAL SPLITTING RULES — distinguish composite dishes from separate foods:

A SINGLE ITEM (combine into one row) when ALL of these apply:
- The components are mixed/cooked/served together as one dish
- Examples of ONE item:
  • "ספגטי בולונז" (pasta + sauce + meat blended) → 1 item
  • "סלט עם עוף, אבוקדו ועגבניות" (one bowl, mixed) → 1 item: "סלט עוף עם אבוקדו ועגבניות"
  • "כריך טונה עם סלט" (in the bread) → 1 item: "כריך טונה"
  • "שייק בננה עם חלב ושיבולת שועל" (blended drink) → 1 item: "שייק בננה"
  • "אורז עם ירקות מאודים" (cooked together) → 1 item

MULTIPLE ITEMS (one row per food) when ANY of these apply:
- The foods are visually/conceptually distinct dishes served on separate plates/in separate containers
- The user lists foods with "ו" / "and" / commas and they are independent foods (not "X with Y" composite)
- Examples of MULTIPLE items:
  • "פיצה וסלט" → 2 items: "פיצה", "סלט"
  • "המבורגר וצ׳יפס" → 2 items: "המבורגר", "צ׳יפס"
  • "שניצל, אורז וסלט" → 3 items: "שניצל", "אורז", "סלט"
  • "ארוחת בוקר: ביצים, טוסט וקפה" → 3 items: "ביצים", "טוסט", "קפה"
  • Image showing pizza on one plate and salad in a separate bowl → 2 items
  • Image showing a sandwich and a side of fries → 2 items
- Each item must have its own realistic per-food calorie/macro estimates (do NOT divide totals)
- Use the LIST/CONJUNCTION test:
  • "X with Y" / "X עם Y" / "X b'Y" → usually ONE composite dish
  • "X and Y" / "X ו-Y" / "X, Y" without "with" → usually SEPARATE items

GENERAL RULES:
- Use realistic nutritional estimates based on typical serving sizes
- All numeric values must be positive numbers (not strings, not null)
- "total_calories" must equal the sum of all items' "calories"
- If the food is completely unclear (cannot identify it at all), set "needs_clarification" to true
- Keep "note" short or empty; only include critical caveats (e.g. "הערכה כללית — קשה לאמוד מהתמונה")
- Return ONLY the JSON object, no other text, no markdown`;
}

function parseGeminiResponse(text: string): GeminiResponse {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function buildExtraContextBlock(extraContext?: string): string {
  const trimmed = extraContext?.trim();
  if (!trimmed) return "";
  return `\n\nADDITIONAL USER CONTEXT (CRITICAL — the user added these details to improve accuracy; treat them as authoritative when they conflict with what you see/hear, and use them to refine quantities, ingredients, brands, cooking method, and portion sizes):
"""
${trimmed}
"""`;
}

export async function analyzeText(
  text: string,
  lang: AnalyzeLang = "he"
): Promise<GeminiResponse> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(
    `${buildPrompt(lang)}\n\nAnalyze this food input: "${text}"`
  );
  return parseGeminiResponse(result.response.text());
}

export interface ImagePart {
  data: string;
  mimeType: string;
}

export async function analyzeImage(
  base64Data: string,
  mimeType: string,
  extraContext?: string,
  lang: AnalyzeLang = "he"
): Promise<GeminiResponse> {
  return analyzeImages([{ data: base64Data, mimeType }], extraContext, lang);
}

export async function analyzeImages(
  images: ImagePart[],
  extraContext?: string,
  lang: AnalyzeLang = "he"
): Promise<GeminiResponse> {
  if (images.length === 0) {
    throw new Error("At least one image is required");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const instruction =
    images.length === 1
      ? `Analyze all the food visible in this image. Apply the SPLITTING RULES carefully — if there are clearly distinct dishes (e.g. a pizza next to a salad bowl, a sandwich next to fries), output them as separate items. If it's one composite dish (e.g. a salad with toppings, pasta with sauce mixed in), output a single item.${buildExtraContextBlock(extraContext)}`
      : `Analyze all the food visible across ALL ${images.length} images. The images show DIFFERENT angles, components, or items belonging to the SAME meal occasion the user is logging. First, identify the unique distinct foods/dishes shown across all images (matching duplicates by appearance — same physical food shown from another angle is ONE food, not two). Then apply the SPLITTING RULES — output one item per truly distinct dish, but combine composite-dish components. Use every image to refine portion sizes, ingredients and cooking style.${buildExtraContextBlock(extraContext)}`;

  const parts = [
    ...images.map((img) => ({
      inlineData: { data: img.data, mimeType: img.mimeType },
    })),
    `${buildPrompt(lang)}\n\n${instruction}`,
  ];

  const result = await model.generateContent(parts);
  return parseGeminiResponse(result.response.text());
}

export async function analyzeAudio(
  base64Data: string,
  mimeType: string,
  extraContext?: string,
  lang: AnalyzeLang = "he"
): Promise<GeminiResponse> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent([
    { inlineData: { data: base64Data, mimeType } },
    `${buildPrompt(lang)}\n\nThe user described food in an audio recording. Transcribe what they said and analyze the food mentioned. Apply the SPLITTING RULES — if the user listed multiple distinct foods (e.g. "pizza and salad", "burger and fries"), output them as separate items. If they described one composite dish (e.g. "pasta with sauce", "salad with chicken on top"), output a single item.${buildExtraContextBlock(extraContext)}`,
  ]);
  return parseGeminiResponse(result.response.text());
}
