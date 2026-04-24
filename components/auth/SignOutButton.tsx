import { signOut } from "@/lib/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/signin" });
      }}
    >
      <button className="rounded-md border border-paper-line bg-paper px-2.5 py-1.5 text-xs text-ink-soft hover:bg-paper-mute">
        Sign out
      </button>
    </form>
  );
}
