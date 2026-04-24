import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-md border border-paper-line bg-paper p-8 text-center">
      <h2 className="text-sm font-semibold text-ink">Not found</h2>
      <p className="mt-1 text-xs text-ink-mute">That item or page doesn't exist in the current cache.</p>
      <Link href="/" className="mt-3 inline-block text-xs text-brand hover:underline">
        Go back
      </Link>
    </div>
  );
}
