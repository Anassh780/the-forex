import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  const [users, strategies, courses] = await Promise.all([
    prisma.user.count(),
    prisma.strategy.count(),
    prisma.course.count(),
  ]);
  const sample = await prisma.strategy.findMany({
    take: 5,
    select: { slug: true, title: true, published: true, proofImages: true },
  });
  console.log(JSON.stringify({ users, strategies, courses, sample }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
