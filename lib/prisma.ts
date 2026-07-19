import { createClient } from "@libsql/client/web";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  const remoteUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (remoteUrl) {
    const remote = createClient({ url: remoteUrl, authToken: process.env.TURSO_AUTH_TOKEN?.trim() });
    return new PrismaClient({ adapter: new PrismaLibSQL(remote) });
  }
  if (process.env.VERCEL) {
    console.warn("Turso is not configured; database-backed features will remain unavailable until Vercel environment variables are added.");
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
