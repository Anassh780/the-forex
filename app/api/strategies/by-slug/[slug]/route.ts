import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeStrategyRecord } from "@/lib/strategy-serialize";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const strategy = await prisma.strategy.findUnique({
      where: { slug: params.slug },
      include: { backtest: { include: { trades: { orderBy: { date: "desc" }, take: 50 } } } },
    });
    if (!strategy) return NextResponse.json({ error: "Strategy not found." }, { status: 404 });

    const session = await getServerSession(authOptions);
    const isAdmin = (session?.user as { role?: string })?.role === "admin";
    if (!strategy.published && !isAdmin) {
      return NextResponse.json({ error: "Strategy not found." }, { status: 404 });
    }

    return NextResponse.json(serializeStrategyRecord(strategy as unknown as Record<string, unknown>));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch strategy.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
