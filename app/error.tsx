"use client";

export default function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-md border border-border-subtle bg-status-blocked-soft p-6">
      <h2 className="text-body font-medium text-status-blocked-text">Something broke on this page.</h2>
      <p className="mt-1 text-label text-text-secondary">{error.message}</p>
      <button
        onClick={reset}
        className="mt-3 rounded-md border border-border-subtle bg-bg-surface px-2.5 py-1.5 text-label hover:bg-bg-muted"
      >
        Retry
      </button>
    </div>
  );
}
