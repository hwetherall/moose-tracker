"use client";

export default function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-md border border-status-blocked/30 bg-red-50 p-6">
      <h2 className="text-sm font-semibold text-status-blocked">Something broke on this page.</h2>
      <p className="mt-1 text-xs text-ink-soft">{error.message}</p>
      <button
        onClick={reset}
        className="mt-3 rounded-md border border-paper-line bg-paper px-2.5 py-1.5 text-xs hover:bg-paper-mute"
      >
        Retry
      </button>
    </div>
  );
}
