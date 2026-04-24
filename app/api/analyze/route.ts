import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  analyzeText,
  analyzeImages,
  analyzeAudio,
  type ImagePart,
} from "@/lib/gemini";

export async function POST(request: NextRequest) {
  // Auth check – Gemini key must never be exposed client-side
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { type, text, data, mimeType, images, note } = body;
    const extraContext = typeof note === "string" ? note : undefined;

    let result;
    switch (type) {
      case "text":
        if (!text?.trim())
          return NextResponse.json({ error: "Text is required" }, { status: 400 });
        result = await analyzeText(text);
        break;
      case "image": {
        // Accept either a multi-image array (preferred) or single data+mimeType for back-compat
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

        result = await analyzeImages(parts, extraContext);
        break;
      }
      case "audio":
        if (!data || !mimeType)
          return NextResponse.json({ error: "Audio data required" }, { status: 400 });
        result = await analyzeAudio(data, mimeType, extraContext);
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
