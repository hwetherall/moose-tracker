import { signIn } from "@/lib/auth";

export default function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  return (
    <SignInContent searchParams={searchParams} />
  );
}

async function SignInContent({
  searchParams
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;
  return (
    <main className="min-h-screen grid place-items-center bg-paper-soft">
      <div className="max-w-sm w-full rounded-lg border border-paper-line bg-paper p-6 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight text-ink">Moose Dashboard</h1>
        <p className="mt-1 text-sm text-ink-mute">Sign in with your @innovera.ai account.</p>
        {error === "domain" && (
          <p className="mt-3 text-sm text-status-blocked">
            That account isn't in the innovera.ai workspace.
          </p>
        )}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl ?? "/" });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:brightness-95"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
