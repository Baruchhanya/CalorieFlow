"use client";

import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white font-bold hover:bg-brand-700 active:bg-brand-700 disabled:hover:bg-brand-600",
  secondary:
    "bg-surface text-ink border border-line font-semibold hover:bg-canvas active:bg-line/50 disabled:hover:bg-surface",
  ghost:
    "text-ink-2 font-semibold hover:bg-ink/5 active:bg-ink/10 disabled:hover:bg-transparent",
  danger:
    "bg-over text-white font-bold hover:bg-[#B23636] active:bg-[#9E2F2F] disabled:hover:bg-over",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-[36px] px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "min-h-[44px] px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "min-h-[48px] px-5 py-3 text-sm rounded-xl gap-2",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center transition-colors touch-manipulation
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40
        disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
});

export default Button;
