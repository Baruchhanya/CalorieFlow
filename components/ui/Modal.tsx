"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  closeDisabled = false,
  closeLabel = "Close",
  maxWidthClass = "sm:max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeDisabled?: boolean;
  closeLabel?: string;
  maxWidthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closeDisabled) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, closeDisabled]);

  if (!open) return null;

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !closeDisabled) onClose();
  };

  return (
    <div
      onClick={onBackdropClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 animate-fade-in"
    >
      <div
        className={`bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl w-full ${maxWidthClass} max-h-[92vh] overflow-y-auto animate-slide-up sm:animate-scale-in`}
        role="dialog"
        aria-modal="true"
      >
        {title != null && (
          <div className="sticky top-0 z-10 bg-surface flex items-center justify-between p-4 sm:p-5 border-b border-line">
            <h3 className="text-lg font-bold text-ink">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              aria-label={closeLabel}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full hover:bg-canvas active:bg-line/60 transition-colors disabled:opacity-50 touch-manipulation"
            >
              <X className="w-5 h-5 text-ink-3" />
            </button>
          </div>
        )}
        {children}
        {footer != null && (
          <div
            className="sticky bottom-0 bg-surface border-t border-line sm:border-t-0 px-4 sm:px-5 pt-2"
            style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom, 8px))" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
