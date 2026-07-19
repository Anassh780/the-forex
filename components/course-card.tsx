"use client";

import { motion } from "framer-motion";
import { Play, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Card } from "./ui";

type CourseCardData = {
  title: string;
  level: string;
  market: string;
  lessons: number;
  duration: string;
  tone?: string;
  href?: string;
};

export function CourseCard({ course, index }: { course: CourseCardData; index: number }) {
  const colors: Record<string, string> = { profit: "#3FA796", brass: "#C9A227", loss: "#B5473C" };
  const tone = course.tone || "profit";
  const href = course.href || "/courses";

  return (
    <Card className="group overflow-hidden">
      <div className="relative h-44 overflow-hidden border-b hairline grid-lines">
        <motion.div className="absolute inset-0" whileHover={{ scale: 1.035 }}>
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background: `radial-gradient(circle at ${30 + index * 20}% 30%, ${colors[tone] || colors.profit}44, transparent 36%)`,
            }}
          />
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
            <div className="font-mono text-[10px] tracking-[.15em] text-muted">MODULE / 0{index + 1}</div>
            <motion.span whileHover={{ scale: 1.08 }} className="grid size-11 place-items-center rounded-full border border-white/20 bg-ink/70">
              <Play size={15} fill="white" />
            </motion.span>
          </div>
        </motion.div>
      </div>
      <div className="p-5">
        <div className="mb-3 flex gap-2 text-[9px] font-bold tracking-[.12em] text-muted">
          <span>{course.level.toUpperCase()}</span>
          <span>•</span>
          <span>{course.market.toUpperCase()}</span>
        </div>
        <h3 className="min-h-14 font-display text-xl font-semibold leading-tight">{course.title}</h3>
        <div className="mt-5 flex items-center justify-between border-t hairline pt-4 text-xs text-muted">
          <span className="font-mono">
            {course.lessons} LESSONS · {course.duration}
          </span>
          <Link href={href} className="text-paper" aria-label={`Open ${course.title}`}>
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
    </Card>
  );
}
