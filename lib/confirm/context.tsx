"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useLang } from "@/lib/i18n/context";

export interface ConfirmOptions {
  /** Main question shown to the user. */
  message: string;
  /** Optional dialog heading (defaults to a generic "Confirm action"). */
  title?: string;
  /** Confirm button label (defaults to the localized "Delete"). */
  confirmLabel?: string;
  /** Cancel button label (defaults to the localized "Cancel"). */
  cancelLabel?: string;
  /** Red/destructive styling for the confirm button. Defaults to true. */
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

/**
 * Styled replacement for the native window.confirm(). Returns a promise that
 * resolves true when the user confirms, false when they cancel/dismiss.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ message: "Delete?", confirmLabel: "Delete" }))) return;
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { T } = useLang();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    setOpts(next);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOpts(null);
  }, []);

  const danger = opts?.danger ?? true;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!opts}
        onClose={() => settle(false)}
        title={opts?.title ?? T.confirmTitle}
        closeLabel={opts?.cancelLabel ?? T.cancel}
      >
        {opts && (
          <div className="p-5 sm:p-6 flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                danger ? "bg-over/10 text-over" : "bg-brand-50 text-brand-600"
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </span>
            <p className="text-sm leading-relaxed text-ink-2 pt-1.5">{opts.message}</p>
          </div>
        )}
        <div
          className="flex gap-2 px-5 sm:px-6 pb-5"
          style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
        >
          <button
            type="button"
            onClick={() => settle(false)}
            className="flex-1 min-h-[44px] rounded-xl border border-line text-ink-2 text-sm font-semibold hover:bg-canvas active:scale-[0.98] touch-manipulation transition-all"
          >
            {opts?.cancelLabel ?? T.cancel}
          </button>
          <button
            type="button"
            onClick={() => settle(true)}
            className={`flex-1 min-h-[44px] rounded-xl text-white text-sm font-bold active:scale-[0.98] touch-manipulation transition-all ${
              danger ? "bg-over hover:bg-[#B23636]" : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            {opts?.confirmLabel ?? T.delete}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
