"use client";

import { LangProvider } from "@/lib/i18n/context";
import { ToastProvider } from "@/lib/toast/context";
import { ConfirmProvider } from "@/lib/confirm/context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <ToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </ToastProvider>
    </LangProvider>
  );
}
