import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessStrategyTier } from "@/lib/plan-access";
import { prisma } from "@/lib/prisma";
import { serializeProofImages, serializeStrategyRecord } from "@/lib/strategy-serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const isAdmin = (session?.user as { role?: string })?.role === "admin";
    const strategies = await prisma.strategy.findMany({
      where: isAdmin ? {} : { published: true },
      include: {
        backtest: { select: { winRate: true, avgRR: true, maxDrawdown: true, totalTrades: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const visible = isAdmin ? strategies : [];
    if (!isAdmin) {
      for (const strategy of strategies) {
        if (await canAccessStrategyTier((session?.user as { role?: string } | undefined)?.role, strategy.accessTier)) visible.push(strategy);
      }
    }
    return NextResponse.json(visible.map(s => serializeStrategyRecord(s as unknown as Record<string, unknown>)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch strategies.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if ((session?.user as { role?: string })?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    if (!title || !slug) {
      return NextResponse.json({ error: "Title and slug are required." }, { status: 400 });
    }

    const strategy = await prisma.strategy.create({
      data: {
        title,
        slug,
        concept: typeof body.concept === "string" ? body.concept.trim() : "Admin published strategy",
        instrument: typeof body.instrument === "string" ? body.instrument.trim() : "Multi-market",
        timeframe: typeof body.timeframe === "string" ? body.timeframe.trim() : "1H",
        description: typeof body.description === "string" ? body.description.trim() : "",
        accessTier: typeof body.accessTier === "string" ? body.accessTier : "member",
        published: Boolean(body.published),
        heroImage: typeof body.heroImage === "string" ? body.heroImage : null,
        proofImages: serializeProofImages(body.proofImages),
        reportUrl: typeof body.reportUrl === "string" ? body.reportUrl : null,
      },
    });

    return NextResponse.json(serializeStrategyRecord(strategy as unknown as Record<string, unknown>), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create strategy.";
    const status = message.toLowerCase().includes("unique") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
