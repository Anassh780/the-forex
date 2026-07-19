import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listDriveFolders } from "@/lib/google-drive";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function curriculumLessonCount(curriculum: string | null) {
  if (!curriculum) return 0;
  try {
    const parsed = JSON.parse(curriculum);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        createdAt: true,
        _count: { select: { feedback: true } },
        feedback: {
          orderBy: { createdAt: "desc" },
          take: 4,
          select: { id: true, category: true, createdAt: true },
        },
        subscriptions: {
          where: { status: { in: ["active", "trialing"] } },
          orderBy: { currentPeriodEnd: "desc" },
          take: 1,
        },
        purchases: {
          where: { status: "completed" },
          include: { course: { select: { id: true, title: true, slug: true } } },
          orderBy: { purchasedAt: "desc" },
        },
        progress: {
          include: { course: { select: { id: true, title: true, slug: true, curriculum: true } } },
          orderBy: { updatedAt: "desc" },
        },
        savedStrategies: {
          include: {
            strategy: {
              select: { id: true, slug: true, title: true, instrument: true, timeframe: true, accessTier: true },

            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const totalStrategies = await prisma.strategy.count({ where: { published: true } });
    let totalCourses = await prisma.course.count({ where: { published: true } });
    try {
      totalCourses = (await listDriveFolders()).folders.length;
    } catch {
      // Keep the database count when Drive is temporarily unavailable.
    }

    const subscription = user.subscriptions[0] || null;

    const coursesInProgress = user.progress.map(p => {
      const lessonCount = curriculumLessonCount(p.course.curriculum);
      return {
        courseId: p.course.id,
        title: p.course.title,
        slug: p.course.slug,
        lessonIndex: p.lessonIndex,
        percent: p.percent,
        totalLessons: lessonCount,
        updatedAt: p.updatedAt,
      };
    });

    const savedStrategies = user.savedStrategies.map(s => s.strategy);

    return NextResponse.json({
      role: user.role,
      memberSince: user.createdAt,
      profile: { name: user.name, image: user.image, email: user.email },
      subscription: subscription ? {
        tier: subscription.tier,
        status: subscription.status,
        renewsAt: subscription.currentPeriodEnd,
      } : null,
      stats: {
        totalStrategies,
        totalCourses,
        savedStrategies: user.savedStrategies.length,
        coursesEnrolled: user.purchases.length,
        coursesInProgress: coursesInProgress.filter(c => c.percent < 100).length,
        coursesCompleted: coursesInProgress.filter(c => c.percent >= 100).length,
        feedbackSent: user._count.feedback,
      },
      coursesInProgress,
      savedStrategies,
      recentPurchases: user.purchases.slice(0, 5).map(p => ({
        courseId: p.course.id,
        title: p.course.title,
        slug: p.course.slug,
        purchasedAt: p.purchasedAt,
      })),
      recentFeedback: user.feedback,
      refreshedAt: new Date(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load dashboard.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
