import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPlanFeature } from "@/lib/plan-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function resolveUserId(session: { user?: { id?: string; email?: string | null } }) {
  if (session.user?.id) {
    const byId = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } });
    if (byId) return byId.id;
  }
  if (session.user?.email) {
    const byEmail = await prisma.user.findUnique({
      where: { email: session.user.email.toLowerCase() },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = await resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    const url = new URL(request.url);
    const courseId = url.searchParams.get("courseId");
    const role = (session.user as { role?: string }).role;
    if (!(await hasPlanFeature(role, "courses"))) {
      return NextResponse.json({ error: "Your current plan does not include course access." }, { status: 403 });
    }

    if (courseId) {
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

      const purchase = await prisma.purchase.findFirst({
        where: { userId, courseId },
      });

      if (!course.published && purchase?.status !== "completed" && role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return NextResponse.json(course);
    }

    const userCourses = await prisma.course.findMany({
      where: {
        OR: [
          { published: true },
          {
            purchases: {
              some: { userId, status: "completed" },
            },
          },
        ],
      },
      include: {
        purchases: { where: { userId } },
        progress: { where: { userId } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(userCourses || []);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch courses.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
