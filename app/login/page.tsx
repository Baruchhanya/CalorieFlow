"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ShieldCheck, Zap, BarChart3 } from "lucide-react";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

const FEATURES = [
  { icon: <Zap className="w-4 h-4" />, he: "ניתוח AI של ארוחות בשניות", en: "AI meal analysis in seconds" },
  { icon: <BarChart3 className="w-4 h-4" />, he: "מעקב קלורי ומאקרו אישי", en: "Personal calorie & macro tracking" },
  { icon: <ShieldCheck className="w-4 h-4" />, he: "מאובטח ופרטי לחלוטין", en: "Secure and fully private" },
];

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const actualEmail = searchParams.get("actual");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<"he" | "en">("he");

  useEffect(() => {
    const saved = localStorage.getItem("cf-lang");
    if (saved === "en" || saved === "he") setLang(saved);
  }, []);

  const T = {
    he: {
      tag: "יומן תזונה מבוסס AI",
      title: "ברוך הבא ל-CalorieFlow",
      subtitle: "עקוב אחר מה שאתה אוכל בקלות ובמהירות",
      signIn: "כניסה עם Google",
      signing: "מתחבר...",
      unauthorized: "הגישה נדחתה – האימייל שלך אינו מורשה.",
      authFailed: "שגיאה בהתחברות. נסה שוב.",
      poweredBy: "מופעל על ידי Gemini AI",
    },
    en: {
      tag: "AI-powered nutrition diary",
      title: "Welcome to CalorieFlow",
      subtitle: "Track what you eat, effortlessly and accurately",
      signIn: "Sign in with Google",
      signing: "Signing in...",
      unauthorized: "Access denied – your email is not authorized.",
      authFailed: "Authentication failed. Please try again.",
      poweredBy: "Powered by Gemini AI",
    },
  }[lang];

  const handleSignIn = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const toggleLang = () => {
    const next = lang === "he" ? "en" : "he";
    setLang(next);
    localStorage.setItem("cf-lang", next);
    document.documentElement.dir = next === "he" ? "rtl" : "ltr";
  };

  return (
    <div className="min-h-screen flex" style={{ direction: lang === "he" ? "rtl" : "ltr" }}>

      {/* Left / top panel – branding */}
      <div className="hidden sm:flex flex-col justify-between w-96 p-10 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(160deg,#059669 0%,#0d9488 50%,#0284c7 100%)" }}>
        {/* Pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-xl mb-6 ring-4 ring-white/20">
            <Image src="/logo.png" alt="CalorieFlow" width={56} height={56} className="w-full h-full object-cover" />
          </div>
          <p className="text-emerald-100 text-xs font-semibold uppercase tracking-widest mb-2">{T.tag}</p>
          <h1 className="text-3xl font-black leading-tight mb-3">CalorieFlow</h1>
          <p className="text-emerald-100 text-base leading-relaxed">{T.subtitle}</p>
        </div>
        <div className="relative flex flex-col gap-3">
          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
              <span className="text-emerald-200">{f.icon}</span>
              <span className="text-sm font-medium">{lang === "he" ? f.he : f.en}</span>
            </div>
          ))}
          <p className="text-emerald-100/50 text-xs mt-2 text-center">{T.poweredBy}</p>
        </div>
      </div>

      {/* Right / main – login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 relative">
        {/* Lang toggle */}
        <button onClick={toggleLang}
          className="absolute top-5 end-5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 bg-white px-3 py-1.5 rounded-xl font-semibold transition-colors shadow-sm">
          {lang === "he" ? "EN" : "עב"}
        </button>

        <div className="w-full max-w-sm flex flex-col gap-6">
          {/* Mobile logo */}
          <div className="sm:hidden flex flex-col items-center gap-3 mb-2">
            <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-xl ring-4 ring-emerald-100">
              <Image src="/logo.png" alt="CalorieFlow" width={80} height={80} className="w-full h-full object-cover" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-black text-slate-800">CalorieFlow</h1>
              <p className="text-slate-400 text-sm mt-1">{T.subtitle}</p>
            </div>
          </div>

          {/* Desktop title */}
          <div className="hidden sm:block">
            <h2 className="text-2xl font-black text-slate-800">{T.title}</h2>
            <p className="text-slate-400 text-sm mt-1">{T.subtitle}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-600 text-center">
              {error === "unauthorized" ? T.unauthorized : T.authFailed}
              {actualEmail && <div className="mt-1 text-xs text-red-400">{actualEmail}</div>}
            </div>
          )}

          {/* Sign in */}
          <button onClick={handleSignIn} disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-emerald-400 hover:shadow-lg text-slate-700 font-bold py-4 px-6 rounded-2xl transition-all duration-200 disabled:opacity-60 shadow-sm text-sm">
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> : <GoogleIcon />}
            {loading ? T.signing : T.signIn}
          </button>

          {/* Mobile features */}
          <div className="sm:hidden flex flex-col gap-2">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl px-4 py-2.5 shadow-sm">
                <span className="text-emerald-500">{f.icon}</span>
                <span className="text-sm text-slate-600">{lang === "he" ? f.he : f.en}</span>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-400">{T.poweredBy}</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
