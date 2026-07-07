export default function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return <div className={`bg-line/60 rounded-lg animate-pulse-soft ${className}`} />;
}
