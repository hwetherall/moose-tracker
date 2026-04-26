export default function Loading() {
  return (
    <div className="space-y-3">
      <div className="h-6 w-48 animate-pulse rounded bg-bg-muted" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-md border border-border-subtle bg-bg-surface" />
        ))}
      </div>
    </div>
  );
}
