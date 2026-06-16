/**
 * Client-side date helpers. All operate in LOCAL time (the user's calendar
 * day), which is intentionally different from the server routes' UTC date
 * handling — do not consolidate the two.
 */

/** Today as a local-time YYYY-MM-DD string. */
export function getToday(): string {
  return toLocalIso(new Date());
}

/** Format a Date as a local-time YYYY-MM-DD string. */
export function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Shift a YYYY-MM-DD string by `days` (anchored at local noon to avoid DST edges). */
export function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toLocalIso(d);
}

/** Human-readable weekday + month + day for the given locale. */
export function formatDate(dateStr: string, lang: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(
    lang === "he" ? "he-IL" : "en-US",
    { weekday: "long", month: "long", day: "numeric" }
  );
}
