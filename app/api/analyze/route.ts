import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeText, analyzeImage, analyzeAudio } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  // Auth check – Gemini key must never be exposed client-side
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { type, text, data, mimeType } = body;

    let result;
    switch (type) {
      case "text":
        if (!text?.trim())
          return NextResponse.json({ error: "Text is required" }, { status: 400 });
        result = await analyzeText(text);
        break;
      case "image":
        if (!data || !mimeType)
          return NextResponse.json({ error: "Image data required" }, { status: 400 });
        result = await analyzeImage(data, mimeType);
        break;
      case "audio":
        if (!data || !mimeType)
          return NextResponse.json({ error: "Audio data required" }, { status: 400 });
        result = await analyzeAudio(data, mimeType);
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Analyze error:", error);
    const message = error instanceof Error ? error.message : "Failed to analyze food";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
