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
    throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required for persistent Vercel data.");
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
