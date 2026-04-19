"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

/** Short haptic on supported devices (Android Chrome, some browsers). */
export function vibrateSuccess() {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([12, 40, 12]);
    }
  } catch { /* ignore */ }
}

interface ToastState {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, variant: ToastVariant = "info") => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const id = Date.now();
    setToast({ id, message, variant });
    if (variant === "success") vibrateSuccess();
    timeoutRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const colors = {
    success: "bg-emerald-600 text-white border-emerald-500",
    error: "bg-red-600 text-white border-red-500",
    info: "bg-slate-800 text-white border-slate-700",
  };

  const Icon = toast?.variant === "success" ? CheckCircle2 : toast?.variant === "error" ? AlertCircle : Info;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div
          className="fixed z-[100] inset-x-0 bottom-24 sm:bottom-6 flex justify-center px-4 pointer-events-none"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-auto max-w-[min(92vw,24rem)] px-4 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 animate-toast-in ${colors[toast.variant]}`}
          >
            <Icon className="w-5 h-5 shrink-0 opacity-90" aria-hidden />
            <span className="text-sm font-semibold leading-snug">{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
