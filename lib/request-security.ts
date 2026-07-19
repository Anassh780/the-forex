import { prisma } from "@/lib/prisma";

function requestMeta(request: Request) {
  return {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
  };
}

export async function requireActiveAccount(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
  if (!user) throw new Error("ACCOUNT_NOT_FOUND");
  if (user.status === "suspended") throw new Error("ACCOUNT_SUSPENDED");
  return user;
}

export async function logVideoAccess(request: Request, userId: string, fileId: string, action: "token" | "stream") {
  const meta = requestMeta(request);
  const range = request.headers.get("range")?.slice(0, 160) || null;
  await prisma.videoAccessLog.create({ data: { userId, fileId, action, range, ...meta } });

  const now = Date.now();
  const since = new Date(now - 5 * 60 * 1000);
  const recentCount = await prisma.videoAccessLog.count({ where: { userId, action, createdAt: { gte: since } } });
  const threshold = action === "token" ? 8 : 90;
  if (recentCount < threshold) return;

  const type = action === "token" ? "rapid_stream_token_requests" : "excessive_video_ranges";
  const duplicate = await prisma.securityEvent.findFirst({
    where: { userId, type, status: "open", createdAt: { gte: new Date(now - 30 * 60 * 1000) } },
  });
  if (duplicate) return;

  await prisma.$transaction([
    prisma.securityEvent.create({
      data: {
        userId,
        type,
        severity: action === "token" ? "high" : "medium",
        fileId,
        details: JSON.stringify({ recentCount, windowMinutes: 5, signal: "Automated server threshold; review before taking action." }),
        ...meta,
      },
    }),
    prisma.user.update({ where: { id: userId }, data: { status: "review" } }),
  ]);
}

export async function logInvalidStreamAttempt(request: Request, userId: string, fileId: string) {
  const meta = requestMeta(request);
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const duplicate = await prisma.securityEvent.findFirst({ where: { userId, type: "invalid_stream_token", status: "open", createdAt: { gte: since } } });
  if (duplicate) return;
  await prisma.securityEvent.create({
    data: { userId, fileId, type: "invalid_stream_token", severity: "medium", details: "A protected stream was requested with a missing, invalid, or expired token.", ...meta },
  });
}
