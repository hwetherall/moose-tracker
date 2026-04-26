import { signOut } from "@/lib/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/signin" });
      }}
    >
      <button className="rounded-md px-1.5 py-0.5 text-label text-text-tertiary hover:text-text-primary">
        Sign out
      </button>
    </form>
  );
}
