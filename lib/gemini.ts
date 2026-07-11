import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiResponse } from "@/types";

const rawApiKey = process.env.GEMINI_API_KEY?.trim();
if (!rawApiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(rawApiKey);

export type AnalyzeLang = "he" | "en";

export const GEMINI_MODEL = "gemini-3.1-flash-lite";

// Pricing per 1M tokens (USD). Override via env vars when tariffs change.
const INPUT_TOKEN_PRICE_PER_M = Number(process.env.GEMINI_INPUT_PRICE_PER_M ?? 0.1);
const OUTPUT_TOKEN_PRICE_PER_M = Number(process.env.GEMINI_OUTPUT_PRICE_PER_M ?? 0.4);

export interface GeminiUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface AnalyzeResult {
  data: GeminiResponse;
  usage: GeminiUsage;
}

export function estimateUsageCost(usage: GeminiUsage): number {
  return (
    (usage.promptTokens * INPUT_TOKEN_PRICE_PER_M) / 1_000_000 +
    (usage.candidatesTokens * OUTPUT_TOKEN_PRICE_PER_M) / 1_000_000
  );
}

interface UsageMetadataLike {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

function extractUsage(response: { usageMetadata?: UsageMetadataLike }): GeminiUsage {
  const m = response.usageMetadata ?? {};
  return {
    promptTokens: m.promptTokenCount ?? 0,
    candidatesTokens: m.candidatesTokenCount ?? 0,
    totalTokens: m.totalTokenCount ?? 0,
  };
}

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
): Promise<AnalyzeResult> {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent(
    `${buildPrompt(lang)}\n\nAnalyze this food input: "${text}"`
  );
  return {
    data: parseGeminiResponse(result.response.text()),
    usage: extractUsage(result.response),
  };
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
): Promise<AnalyzeResult> {
  return analyzeImages([{ data: base64Data, mimeType }], extraContext, lang);
}

export async function analyzeImages(
  images: ImagePart[],
  extraContext?: string,
  lang: AnalyzeLang = "he"
): Promise<AnalyzeResult> {
  if (images.length === 0) {
    throw new Error("At least one image is required");
  }

  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

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
  return {
    data: parseGeminiResponse(result.response.text()),
    usage: extractUsage(result.response),
  };
}

// ─── Burn predictor chat ─────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface BurnProfile {
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
}

const BURN_DONE_MARKER = "[תחזית_מוכנה]";

export async function chatBurnPredictor(
  messages: ChatMessage[],
  profile: BurnProfile,
  lang: AnalyzeLang = "he"
): Promise<{ reply: string; isDone: boolean; usage: GeminiUsage }> {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const profileBlock = [
    profile.age != null ? `גיל: ${profile.age} שנים` : null,
    profile.weight_kg != null ? `משקל: ${profile.weight_kg} ק"ג` : null,
    profile.height_cm != null ? `גובה: ${profile.height_cm} ס"מ` : null,
  ].filter(Boolean).join(" | ") || "פרופיל לא זמין";

  const systemPrompt = lang === "he"
    ? `אתה עוזר תזונה ידידותי שמחשב תחזית שריפת קלוריות עד סוף היום.

פרופיל המשתמש: ${profileBlock}

שאל בדיוק 3 שאלות — אחת בכל תור, קצרה וברורה:
1. כמה קלוריות שרפת עד עכשיו?
2. עד איזו שעה ביממה?
3. האם ביצעת ספורט או פעילות נוספת לאחר מכן? אם כן — מה ומשך כמה זמן?

לאחר שאספת את 3 התשובות, הצג תחזית קצרה ומפורטת לסך השריפה עד חצות. בסיום הוסף בדיוק: ${BURN_DONE_MARKER}

ענה בעברית. שאלה אחת בלבד בכל תור.`
    : `You are a friendly nutrition assistant helping predict total calorie burn by end of day.

User profile: ${profileBlock}

Ask exactly 3 questions — one per turn, short and clear:
1. How many calories have you burned so far?
2. Until what time of day?
3. Did you do any additional sports or physical activity after that? If yes — what and for how long?

After collecting all 3 answers, provide a brief detailed prediction of total burn by midnight. End with exactly: ${BURN_DONE_MARKER}

Answer in English. One question per turn only.`;

  const history = messages
    .map(m => `${m.role === "user" ? "משתמש" : "עוזר"}: ${m.text}`)
    .join("\n");

  const prompt = messages.length === 0
    ? `${systemPrompt}\n\nענה עם השאלה הראשונה בלבד.`
    : `${systemPrompt}\n\nהיסטוריית שיחה:\n${history}\n\nעוזר:`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();
  const isDone = raw.includes(BURN_DONE_MARKER);

  return {
    reply: raw.replace(BURN_DONE_MARKER, "").trim(),
    isDone,
    usage: extractUsage(result.response),
  };
}

export async function transcribeAudio(
  base64Data: string,
  mimeType: string
): Promise<{ text: string; usage: GeminiUsage }> {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent([
    { inlineData: { data: base64Data, mimeType } },
    "תמלל את ההקלטה לטקסט בדיוק כפי שנאמר. החזר רק את הטקסט המתומלל, ללא פרשנות נוספת.",
  ]);
  return {
    text: result.response.text().trim(),
    usage: extractUsage(result.response),
  };
}

export async function analyzeAudio(
  base64Data: string,
  mimeType: string,
  extraContext?: string,
  lang: AnalyzeLang = "he"
): Promise<AnalyzeResult> {
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent([
    { inlineData: { data: base64Data, mimeType } },
    `${buildPrompt(lang)}\n\nThe user described food in an audio recording. Transcribe what they said and analyze the food mentioned. Apply the SPLITTING RULES — if the user listed multiple distinct foods (e.g. "pizza and salad", "burger and fries"), output them as separate items. If they described one composite dish (e.g. "pasta with sauce", "salad with chicken on top"), output a single item.${buildExtraContextBlock(extraContext)}`,
  ]);
  return {
    data: parseGeminiResponse(result.response.text()),
    usage: extractUsage(result.response),
  };
}
