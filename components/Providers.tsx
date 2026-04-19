"use client";

import { LangProvider } from "@/lib/i18n/context";
import { ToastProvider } from "@/lib/toast/context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <ToastProvider>{children}</ToastProvider>
    </LangProvider>
  );
}
