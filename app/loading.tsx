// Streams instantly while the server component awaits auth + the critical DB
// batch, so first open paints an app-shaped skeleton instead of a blank page.
export default function Loading() {
  return (
    <div className="min-h-screen pb-28 sm:pb-8">
      <header className="sticky top-0 z-40 bg-surface border-b border-line">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-canvas animate-pulse-soft" />
              <div className="h-4 w-24 rounded bg-canvas animate-pulse-soft" />
            </div>
            <div className="w-8 h-8 rounded-full bg-canvas animate-pulse-soft" />
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 pb-1">
            <div className="w-9 h-9 rounded-lg bg-canvas animate-pulse-soft" />
            <div className="h-4 w-40 rounded bg-canvas animate-pulse-soft" />
            <div className="w-9 h-9 rounded-lg bg-canvas animate-pulse-soft" />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
        <div className="h-40 bg-surface rounded-(--radius-card) border border-line animate-pulse-soft" />
        <div className="h-28 bg-surface rounded-(--radius-card) border border-line animate-pulse-soft" style={{ opacity: 0.75 }} />
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-surface rounded-(--radius-card) border border-line animate-pulse-soft"
              style={{ opacity: 1 - i * 0.25 }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
