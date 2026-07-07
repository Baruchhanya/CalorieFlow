export default function Loading() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
        <div className="h-14 bg-surface rounded-(--radius-card) border border-line animate-pulse-soft" />
        <div className="h-64 bg-surface rounded-(--radius-card) border border-line animate-pulse-soft" />
        <div className="h-40 bg-surface rounded-(--radius-card) border border-line animate-pulse-soft" />
        <div className="h-40 bg-surface rounded-(--radius-card) border border-line animate-pulse-soft" />
      </div>
    </div>
  );
}
