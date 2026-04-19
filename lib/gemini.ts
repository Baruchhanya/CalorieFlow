import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiResponse } from "@/types";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const NUTRITION_PROMPT = `You are a professional nutritionist and food analysis expert. Analyze the food described and return ONLY a valid JSON object with accurate nutritional information.

Return this exact JSON structure (no markdown, no code blocks, raw JSON only):
{
  "items": [
    {
      "name": "food name (in the same language as input, Hebrew or English)",
      "quantity": "amount with unit (e.g. '1 cup', '200g', '2 slices')",
      "calories": <number>,
      "protein_g": <number>,
      "carbs_g": <number>,
      "fat_g": <number>
    }
  ],
  "total_calories": <number>,
  "needs_clarification": <boolean>,
  "note": "any important notes (same language as input)"
}

CRITICAL GROUPING RULES – DEFAULT IS ONE ITEM:
- ALWAYS combine everything the user described into ONE single meal item by default.
- Sum up all calories and macros from all components into that one item.
- Name the item after the MAIN dish or the meal context. Examples:
  • "chicken with rice, salad and bread" → ONE item: "עוף עם אורז, סלט ולחם" / "Chicken with rice, salad and bread"
  • "pasta with tomato sauce and cheese, and a cola" → ONE item: "פסטה עם רוטב עגבניות וגבינה" + drink combined, or split if the user clearly called them out as separate occasions
  • "ארוחת ערב: שניצל, תפוחי אדמה, סלט" → ONE item: "ארוחת ערב – שניצל, תפוחי אדמה וסלט"
  • "breakfast eggs and toast, then later lunch sandwich" → TWO items (different meal occasions)
- ONLY create MULTIPLE items if the user EXPLICITLY mentions different meal occasions/times (breakfast + lunch, morning snack + dinner, etc.)
- Do NOT split individual ingredients or side dishes into separate items
- Use realistic nutritional estimates based on typical serving sizes
- All numeric values must be positive numbers (not strings)
- If the food is completely unclear, set needs_clarification to true
- Return ONLY the JSON object, no other text`;

function parseGeminiResponse(text: string): GeminiResponse {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

export async function analyzeText(text: string): Promise<GeminiResponse> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(
    `${NUTRITION_PROMPT}\n\nAnalyze this food input: "${text}"`
  );
  return parseGeminiResponse(result.response.text());
}

export async function analyzeImage(
  base64Data: string,
  mimeType: string
): Promise<GeminiResponse> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent([
    { inlineData: { data: base64Data, mimeType } },
    `${NUTRITION_PROMPT}\n\nAnalyze all the food visible in this image and provide nutritional information.`,
  ]);
  return parseGeminiResponse(result.response.text());
}

export async function analyzeAudio(
  base64Data: string,
  mimeType: string
): Promise<GeminiResponse> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent([
    { inlineData: { data: base64Data, mimeType } },
    `${NUTRITION_PROMPT}\n\nThe user described food in an audio recording. Transcribe what they said and analyze the food mentioned.`,
  ]);
  return parseGeminiResponse(result.response.text());
}
