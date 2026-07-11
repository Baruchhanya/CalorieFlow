import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { chatBurnPredictor, transcribeAudio, type ChatMessage } from "@/lib/gemini";

export async function POST(req: Request) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const lang: "he" | "en" = body.lang === "en" ? "en" : "he";

  try {
    if (body.action === "transcribe") {
      const { audio } = body as { audio: { data: string; mimeType: string } };
      const { text, usage } = await transcribeAudio(audio.data, audio.mimeType);
      return NextResponse.json({ text, usage });
    }

    const messages: ChatMessage[] = body.messages ?? [];

    const { data: profile } = await supabase
      .from("user_profile")
      .select("age, weight_kg, height_cm")
      .eq("user_id", user.id)
      .single();

    const { reply, isDone, usage } = await chatBurnPredictor(
      messages,
      profile ?? { age: null, weight_kg: null, height_cm: null },
      lang
    );

    return NextResponse.json({ reply, isDone, usage });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[burn-predictor] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
