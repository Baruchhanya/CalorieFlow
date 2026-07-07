export default function Card({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-surface rounded-(--radius-card) border border-line shadow-(--shadow-card) ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
