import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.status === "suspended" || !(await bcrypt.compare(credentials.password, user.passwordHash))) return null;
        return { id: user.id, email: user.email, role: user.role, name: user.name || user.email.split("@")[0], image: user.image };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger }) => {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.email = user.email;
        token.name = user.name || user.email?.split("@")[0];
        token.picture = user.image;
      }
      // Only hydrate missing identity claims — avoid a DB hit on every request.
      if (!user && token.email && typeof token.email === "string" && (!token.id || !token.role)) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: token.email.toLowerCase() },
            select: { id: true, role: true },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
          }
        } catch {
          // DB may be temporarily unavailable — keep existing token claims
        }
      }
      if (trigger === "update" && token.email && typeof token.email === "string") {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email.toLowerCase() },
          select: { id: true, role: true, name: true, image: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.name = dbUser.name || token.email.split("@")[0];
          token.picture = dbUser.image;
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = (token.id as string) || (token.sub as string) || "";
        session.user.role = (token.role as string) || "free";
        session.user.email = token.email as string | undefined;
        session.user.name = (token.name as string | undefined) || session.user.email?.split("@")[0] || "Trader";
        session.user.image = (token.picture as string | undefined) || null;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
};
