import { createClient } from "@libsql/client/web";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { envValue } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function remoteDatabase() {
  const tursoUrl = envValue("TURSO_DATABASE_URL");
  if (tursoUrl) return { url: tursoUrl, authToken: envValue("TURSO_AUTH_TOKEN") };

  const databaseUrl = envValue("DATABASE_URL");
  if (databaseUrl?.startsWith("libsql://") || databaseUrl?.startsWith("https://")) {
    return { url: databaseUrl, authToken: envValue("TURSO_AUTH_TOKEN") };
  }

  return null;
}

function createPrismaClient() {
  const remote = remoteDatabase();
  if (remote) {
    const client = createClient({ url: remote.url, authToken: remote.authToken });
    return new PrismaClient({ adapter: new PrismaLibSQL(client) });
  }
  if (process.env.VERCEL) {
    throw new Error("Production database is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel; do not use DATABASE_URL=file:./dev.db in production.");
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
