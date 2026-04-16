"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Lang, translations, Translations } from "./translations";

interface LangContextValue {
  lang: Lang;
  toggleLang: () => void;
  T: Translations;
}

const LangContext = createContext<LangContextValue>({
  lang: "he",
  toggleLang: () => {},
  T: translations.he,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("he");

  useEffect(() => {
    const saved = localStorage.getItem("cf-lang");
    if (saved === "en" || saved === "he") setLang(saved);
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === "he" ? "en" : "he";
      localStorage.setItem("cf-lang", next);
      return next;
    });
  }, []);

  return (
    <LangContext.Provider value={{ lang, toggleLang, T: translations[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
