export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-5">
        <div className="h-14 bg-surface rounded-(--radius-card) border border-line animate-pulse-soft" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-surface rounded-(--radius-card) border border-line animate-pulse-soft" />
          ))}
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-surface rounded-(--radius-card) border border-line animate-pulse-soft" />
        ))}
      </div>
    </div>
  );
}
