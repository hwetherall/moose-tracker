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
  const redirectTo = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  return (
    <main className="grid min-h-screen place-items-center bg-bg-page px-5">
      <div className="w-full max-w-sm rounded-lg border border-border-subtle bg-bg-surface p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-[22px] w-[22px] items-center justify-center rounded-md bg-brand font-medium text-text-inverse">A</div>
          <span className="font-serif text-[15px] font-medium text-text-primary">Antler</span>
        </div>
        <h1 className="font-serif text-page text-text-primary">Antler</h1>
        <p className="mt-1 text-body text-text-secondary">Sign in with your @innovera.ai account.</p>
        {error === "domain" && (
          <p className="mt-3 text-body text-status-blocked-text">
            That account isn't in the innovera.ai workspace.
          </p>
        )}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="w-full rounded-md bg-brand px-3 py-2 text-body font-medium text-text-inverse hover:brightness-95"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
