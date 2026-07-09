import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient, getAuthUser } from "@/lib/auth";
import {
  analyzeText,
  analyzeImages,
  analyzeAudio,
  GEMINI_MODEL,
  type AnalyzeResult,
  type ImagePart,
  type AnalyzeLang,
  type GeminiUsage,
} from "@/lib/gemini";

function pickLang(raw: unknown): AnalyzeLang {
  return raw === "en" ? "en" : "he";
}

interface LogParams {
  userId: string;
  userEmail: string | null;
  requestType: "text" | "image" | "audio";
  imageCount: number;
  durationMs: number;
  status: "success" | "error";
  usage?: GeminiUsage;
  errorMessage?: string;
}

async function logUsage(params: LogParams): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    await admin.from("gemini_usage").insert({
      user_id: params.userId,
      user_email: params.userEmail,
      request_type: params.requestType,
      model: GEMINI_MODEL,
      image_count: params.imageCount,
      prompt_tokens: params.usage?.promptTokens ?? null,
      candidates_tokens: params.usage?.candidatesTokens ?? null,
      total_tokens: params.usage?.totalTokens ?? null,
      duration_ms: params.durationMs,
      status: params.status,
      error_message: params.errorMessage ?? null,
    });
  } catch (err) {
    console.error("gemini_usage insert failed:", err);
  }
}

export async function POST(request: NextRequest) {
  // Auth check – Gemini key must never be exposed client-side
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startedAt = Date.now();
  let requestType: "text" | "image" | "audio" = "text";
  let imageCount = 0;

  try {
    const body = await request.json();
    const { type, text, data, mimeType, images, note, lang } = body;
    const extraContext = typeof note === "string" ? note : undefined;
    const outputLang = pickLang(lang);

    let result: AnalyzeResult;
    switch (type) {
      case "text":
        requestType = "text";
        if (!text?.trim())
          return NextResponse.json({ error: "Text is required" }, { status: 400 });
        result = await analyzeText(text, outputLang);
        break;
      case "image": {
        requestType = "image";
        const parts: ImagePart[] = Array.isArray(images)
          ? images
              .filter(
                (it: unknown): it is ImagePart =>
                  !!it &&
                  typeof (it as ImagePart).data === "string" &&
                  typeof (it as ImagePart).mimeType === "string"
              )
          : data && mimeType
          ? [{ data, mimeType }]
          : [];

        if (parts.length === 0)
          return NextResponse.json(
            { error: "Image data required" },
            { status: 400 }
          );
        if (parts.length > 8)
          return NextResponse.json(
            { error: "Too many images (max 8)" },
            { status: 400 }
          );

        imageCount = parts.length;
        result = await analyzeImages(parts, extraContext, outputLang);
        break;
      }
      case "audio":
        requestType = "audio";
        if (!data || !mimeType)
          return NextResponse.json({ error: "Audio data required" }, { status: 400 });
        result = await analyzeAudio(data, mimeType, extraContext, outputLang);
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    await logUsage({
      userId: user.id,
      userEmail: user.email ?? null,
      requestType,
      imageCount,
      durationMs: Date.now() - startedAt,
      status: "success",
      usage: result.usage,
    });

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Analyze error:", error);
    const message = error instanceof Error ? error.message : "Failed to analyze food";
    await logUsage({
      userId: user.id,
      userEmail: user.email ?? null,
      requestType,
      imageCount,
      durationMs: Date.now() - startedAt,
      status: "error",
      errorMessage: message.slice(0, 500),
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
