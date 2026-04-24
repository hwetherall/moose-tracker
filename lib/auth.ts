import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_DOMAIN = "innovera.ai";

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: { hd: ALLOWED_DOMAIN, prompt: "select_account" }
      }
    })
  ],
  callbacks: {
    signIn({ profile }) {
      const email = profile?.email ?? "";
      return email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
    },
    session({ session }) {
      return session;
    }
  },
  pages: { signIn: "/signin" }
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
