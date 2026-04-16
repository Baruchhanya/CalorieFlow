"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<"he" | "en">("he");

  useEffect(() => {
    const saved = localStorage.getItem("cf-lang");
    if (saved === "en" || saved === "he") setLang(saved);
  }, []);

  const T = {
    he: {
      title: "ברוך הבא ל-CalorieFlow",
      subtitle: "יומן תזונה אישי מבוסס AI",
      desc: "עקוב אחר הארוחות שלך עם ניתוח מולטימודלי – טקסט, תמונה, וקול.",
      signIn: "כניסה עם Google",
      signing: "מתחבר...",
      unauthorized: "הגישה נדחתה – האימייל שלך אינו מורשה.",
      authFailed: "שגיאה בהתחברות. נסה שוב.",
    },
    en: {
      title: "Welcome to CalorieFlow",
      subtitle: "AI-powered personal nutrition diary",
      desc: "Track your meals with multimodal analysis – text, image, and voice.",
      signIn: "Sign in with Google",
      signing: "Signing in...",
      unauthorized: "Access denied – your email is not authorized.",
      authFailed: "Authentication failed. Please try again.",
    },
  }[lang];

  const handleSignIn = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const toggleLang = () => {
    const next = lang === "he" ? "en" : "he";
    setLang(next);
    localStorage.setItem("cf-lang", next);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}
    >
      {/* Lang toggle */}
      <button
        onClick={toggleLang}
        className="absolute top-4 left-4 text-xs text-emerald-100 hover:text-white border border-white/30 px-2.5 py-1 rounded-lg transition-colors"
      >
        {lang === "he" ? "EN" : "עב"}
      </button>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, #059669, #0d9488)" }}>
            <span className="text-white text-2xl font-black">CF</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-800">{T.title}</h1>
            <p className="text-sm text-slate-500 mt-1">{T.subtitle}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-center text-sm text-slate-500 leading-relaxed">{T.desc}</p>

        {/* Error message */}
        {error && (
          <div className="w-full bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 text-center">
            {error === "unauthorized" ? T.unauthorized : T.authFailed}
          </div>
        )}

        {/* Sign in button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-emerald-400 hover:shadow-md text-slate-700 font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
          ) : (
            <GoogleIcon />
          )}
          {loading ? T.signing : T.signIn}
        </button>

        <p className="text-xs text-slate-400 text-center">
          CalorieFlow · Powered by Gemini AI
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)" }}>
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
