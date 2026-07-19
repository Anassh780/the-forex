import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeProofImages, serializeStrategyRecord } from "@/lib/strategy-serialize";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const strategy = await prisma.strategy.findUnique({
      where: { id: params.id },
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

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if ((session?.user as { role?: string })?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.strategy.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete strategy.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if ((session?.user as { role?: string })?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (typeof body.title === "string") data.title = body.title.trim();
    if (typeof body.slug === "string") data.slug = body.slug.trim();
    if (typeof body.concept === "string") data.concept = body.concept.trim();
    if (typeof body.instrument === "string") data.instrument = body.instrument.trim();
    if (typeof body.timeframe === "string") data.timeframe = body.timeframe.trim();
    if (typeof body.description === "string") data.description = body.description.trim();
    if (typeof body.accessTier === "string") data.accessTier = body.accessTier;
    if (typeof body.published === "boolean") data.published = body.published;
    if (typeof body.heroImage === "string" || body.heroImage === null) data.heroImage = body.heroImage;
    if (typeof body.reportUrl === "string" || body.reportUrl === null) data.reportUrl = body.reportUrl;
    if ("proofImages" in body) data.proofImages = serializeProofImages(body.proofImages);

    const strategy = await prisma.strategy.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(serializeStrategyRecord(strategy as unknown as Record<string, unknown>));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update strategy.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
