import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-surface p-8 text-center">
      <h2 className="font-serif text-section text-text-primary">Not found</h2>
      <p className="mt-1 text-label text-text-tertiary">That item or page doesn't exist in the current cache.</p>
      <Link href="/" className="mt-3 inline-block text-label text-brand hover:underline">
        Go back
      </Link>
    </div>
  );
}
