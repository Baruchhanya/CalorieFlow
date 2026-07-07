type Tone = "neutral" | "brand" | "protein" | "carbs" | "fat" | "over" | "warn";

const TONES: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-2 border-line",
  brand: "bg-brand-50 text-brand-700 border-brand-100",
  protein: "bg-protein/8 text-protein border-protein/15",
  carbs: "bg-carbs/8 text-carbs border-carbs/15",
  fat: "bg-fat/8 text-fat border-fat/15",
  over: "bg-over/8 text-over border-over/15",
  warn: "bg-warn/8 text-warn border-warn/15",
};

export default function Chip({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
