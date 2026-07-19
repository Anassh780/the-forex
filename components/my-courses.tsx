"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Clock, BarChart3, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { SecureVideoPlayer } from "@/components/secure-video-player";
import { CandleLoader } from "@/components/candle-loader";

type CourseWithAccess = {
  id: string;
  title: string;
  description: string;
  slug: string;
  level: string;
  market: string;
  price: number;
  videoAssetId?: string;
  curriculum?: string;
  instructor?: string;
  published: boolean;
  createdAt: string;
  purchases?: Array<{ status: string }>;
  progress?: Array<{ percent: number }>;
};

export function MyCourses() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseWithAccess[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseWithAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await fetch("/api/user-courses", { cache: "no-store" });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Unable to load courses");
        }
        const data = await response.json();
        setCourses(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load courses");
      } finally {
        setLoading(false);
      }
    };

    void fetchCourses();
  }, []);

  if (loading) {
    return (
      <div className="container-shell py-20">
        <CandleLoader size="lg" label="Loading your courses" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-shell py-20">
        <p className="text-center text-red-500">{error}</p>
      </div>
    );
  }

  if (selectedCourse) {
    const videoUrl = selectedCourse.videoAssetId
      ? `/api/drive/stream/${encodeURIComponent(selectedCourse.videoAssetId)}`
      : null;

    return (
      <div className="container-shell py-12">
        <button
          onClick={() => setSelectedCourse(null)}
          className="flex items-center gap-2 mb-8 text-sm text-muted hover:text-foreground transition"
        >
          <ArrowLeft size={16} />
          Back to courses
        </button>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                {selectedCourse.market} · {selectedCourse.level}
              </span>
            </div>
            <h1 className="text-4xl font-display font-semibold mb-4">
              {selectedCourse.title}
            </h1>
            <p className="text-lg leading-relaxed max-w-2xl">
              {selectedCourse.description}
            </p>
          </div>

          {videoUrl ? (
            <div className="my-8 rounded-lg overflow-hidden border border-border">
              <SecureVideoPlayer
                videoUrl={videoUrl}
                title={selectedCourse.title}
                courseId={selectedCourse.id}
              />
              <div className="bg-surface p-6 border-t border-border">
                <p className="text-sm text-muted">
                  📢 This video is protected. Download and unauthorized copying are disabled.
                </p>
              </div>
            </div>
          ) : (
            <div className="my-8 p-8 bg-surface rounded-lg border border-border text-center">
              <Lock size={32} className="mx-auto mb-4 text-muted" />
              <p className="text-muted">Video player unavailable</p>
            </div>
          )}

          {selectedCourse.curriculum && (
            <div className="my-8">
              <h2 className="text-2xl font-semibold mb-4">Curriculum</h2>
              <div className="prose prose-invert max-w-none">
                <pre>{(() => {
                  try {
                    return JSON.stringify(JSON.parse(selectedCourse.curriculum), null, 2);
                  } catch {
                    return selectedCourse.curriculum;
                  }
                })()}</pre>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="p-4 rounded border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-muted" />
                <span className="text-sm text-muted">Estimated time</span>
              </div>
              <p className="font-semibold">Self-paced</p>
            </div>
            <div className="p-4 rounded border border-border">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={16} className="text-muted" />
                <span className="text-sm text-muted">Level</span>
              </div>
              <p className="font-semibold">{selectedCourse.level}</p>
            </div>
            <div className="p-4 rounded border border-border">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={16} className="text-muted" />
                <span className="text-sm text-muted">Market</span>
              </div>
              <p className="font-semibold">{selectedCourse.market}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-shell py-20">
      <div className="mb-12">
        <h1 className="text-4xl font-display font-semibold mb-4">My Learning</h1>
        <p className="text-lg text-muted">
          Access your purchased courses and watch progress as you learn.
        </p>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen size={48} className="mx-auto mb-4 text-muted" />
          <h2 className="text-xl font-semibold mb-2">No courses yet</h2>
          <p className="text-muted mb-6">Explore our course library and start learning today.</p>
          <button
            onClick={() => router.push("/courses")}
            className="cta-primary"
          >
            Browse courses
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map(course => {
            const progress = course.progress?.[0]?.percent || 0;
            const isPurchased = course.purchases?.some(p => p.status === "completed");

            return (
              <button
                key={course.id}
                onClick={() => setSelectedCourse(course)}
                className="group text-left p-4 rounded-lg border border-border hover:border-primary/50 transition overflow-hidden"
              >
                <div className="mb-4 h-32 bg-gradient-to-br from-primary/20 to-primary/5 rounded flex items-center justify-center">
                  <BookOpen size={48} className="text-primary/40" />
                </div>
                <h3 className="font-semibold mb-2 line-clamp-2 group-hover:text-primary transition">
                  {course.title}
                </h3>
                <p className="text-sm text-muted mb-4 line-clamp-2">
                  {course.description}
                </p>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{course.level}</span>
                  <span>{course.market}</span>
                </div>
                {progress > 0 && (
                  <div className="mt-3 bg-border rounded-full h-1 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
