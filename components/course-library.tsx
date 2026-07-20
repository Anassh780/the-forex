"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ArrowLeft, BookOpen, CheckCircle2, Clock3, FileText, Film, PlayCircle } from "lucide-react";
import { CandleLoader } from "@/components/candle-loader";
import { SecureVideoPlayer } from "@/components/secure-video-player";
import { Reveal } from "@/components/ui";
import { uniqueBy } from "@/lib/collections";

type Course = { id: string; name: string; modifiedTime?: string; thumbnail?: string | null; videoCount?: number };
type Video = { id: string; index: number; name: string; durationMillis?: string | null; thumbnail?: string | null };
type Resource = { id: string; name: string; mimeType?: string };

function duration(ms?: string | null) {
  const total = Number(ms);
  if (!Number.isFinite(total) || total <= 0) return "";
  const secs = Math.round(total / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` : `${m}:${s.toString().padStart(2, "0")}`;
}

// LocalStorage-backed watched markers keep progress without a database.
function watchedKey(courseId: string) {
  return `edgeledger:watched:${courseId}`;
}

export function CourseLibrary() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState<Course | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [videoLoading, setVideoLoading] = useState(false);
  const [current, setCurrent] = useState<Video | null>(null);
  const [watched, setWatched] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/catalog", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          if (!cancelled) {
            setError("Sign in to access the course library.");
            setCourses([]);
          }
          return;
        }
        if (!res.ok) throw new Error(data.error || "Unable to load courses.");
        const returnedCourses = (Array.isArray(data.courses) ? data.courses : []) as Course[];
        if (!cancelled) setCourses(uniqueBy(returnedCourses, course => course.id));
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load courses.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openCourse = useCallback(async (course: Course) => {
    setActive(course);
    setVideoLoading(true);
    setError("");
    setCurrent(null);
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(watchedKey(course.id)) : null;
      const storedWatched = stored ? JSON.parse(stored) : [];
      setWatched(uniqueBy(Array.isArray(storedWatched) ? storedWatched : [], id => String(id)));
      const res = await fetch(`/api/catalog?id=${encodeURIComponent(course.id)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to open this course.");
      const returnedVideos = (Array.isArray(data.videos) ? data.videos : []) as Video[];
      const returnedResources = (Array.isArray(data.resources) ? data.resources : []) as Resource[];
      const nextVideos = uniqueBy(returnedVideos, video => video.id);
      setVideos(nextVideos);
      setResources(uniqueBy(returnedResources, resource => resource.id));
      setCurrent(nextVideos[0] || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open this course.");
    } finally {
      setVideoLoading(false);
    }
  }, []);

  function markWatched(videoId: string) {
    if (!active) return;
    setWatched(prev => {
      if (prev.includes(videoId)) return prev;
      const next = [...prev, videoId];
      window.localStorage.setItem(watchedKey(active.id), JSON.stringify(next));
      return next;
    });
  }

  function backToLibrary() {
    setActive(null);
    setVideos([]);
    setResources([]);
    setCurrent(null);
  }

  // ---- Course player view ----
  if (active) {
    const watchedCount = videos.filter(v => watched.includes(v.id)).length;
    const percent = videos.length ? Math.round((watchedCount / videos.length) * 100) : 0;
    return (
      <div className="container-shell py-12">
        <button onClick={backToLibrary} className="cl-back"><ArrowLeft size={16} /> All courses</button>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="eyebrow">Course</div>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-.04em]">{active.name}</h1>

            {videoLoading ? (
              <div className="cl-player-loading"><CandleLoader size="md" label="Loading course" /></div>
            ) : current ? (
              <div className="mt-6 cl-watch-shell">
                <SecureVideoPlayer
                  key={current.id}
                  videoUrl={`/api/drive/stream/${current.id}`}
                  title={current.name}
                  poster={current.thumbnail || undefined}
                />
                <div className="cl-now-playing">
                  <div className="cl-current-kicker">
                    <span className="cl-seq">{String(current.index).padStart(2, "0")}</span>
                    <span>Now playing</span>
                    {duration(current.durationMillis) && <em>{duration(current.durationMillis)}</em>}
                  </div>
                  <div className="cl-current-main">
                    <div>
                      <strong>{current.name}</strong>
                      <small>{watched.includes(current.id) ? "Completed lesson" : "Protected stream · progress saved on this device"}</small>
                    </div>
                    <button className={watched.includes(current.id) ? "cl-complete done" : "cl-complete"} onClick={() => markWatched(current.id)}>
                      <CheckCircle2 size={15} /> {watched.includes(current.id) ? "Completed" : "Mark complete"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="cl-empty"><Film size={30} /><p>No videos in this course yet.</p></div>
            )}

            {resources.length > 0 && (
              <div className="cl-resources">
                <div className="cl-resources-head"><h3>Resources</h3><span>{resources.length} file{resources.length === 1 ? "" : "s"}</span></div>
                {resources.map(r => (
                  <a key={r.id} href={`/api/drive/stream/${r.id}`} target="_blank" rel="noreferrer" className="cl-resource">
                    <FileText size={15} /><span>{r.name}</span><em>{r.mimeType?.split("/").pop() || "file"}</em>
                  </a>
                ))}
              </div>
            )}
          </div>

          <aside className="cl-playlist">
            <div className="cl-playlist-head">
              <div className="flex items-center justify-between">
                <h3>Lessons</h3>
                <span className="font-mono text-[11px] text-muted">{watchedCount}/{videos.length}</span>
              </div>
              <div className="cl-progress"><div style={{ width: `${percent}%` }} /></div>
            </div>
            <div className="cl-playlist-body">
              {videos.map(v => {
                const isCurrent = current?.id === v.id;
                const done = watched.includes(v.id);
                return (
                  <button key={v.id} onClick={() => setCurrent(v)} className={`cl-lesson ${isCurrent ? "active" : ""}`}>
                    <span className={`cl-lesson-seq ${done ? "done" : ""}`}>
                      {done ? <CheckCircle2 size={14} /> : isCurrent ? <PlayCircle size={14} /> : String(v.index).padStart(2, "0")}
                    </span>
                    <span className="cl-lesson-name">{v.name}</span>
                    {duration(v.durationMillis) && <span className="cl-lesson-time">{duration(v.durationMillis)}</span>}
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  // ---- Library grid view ----
  return (
    <div className="container-shell py-16">
      <Reveal>
        <div className="eyebrow">Course library</div>
        <h1 className="mt-4 font-display text-5xl font-semibold tracking-[-.05em]">Build a trader’s eye.</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted">
          Structured video courses, streamed securely. Pick a course and work through the lessons in order.
        </p>
      </Reveal>

      {loading ? (
        <div className="py-24"><CandleLoader size="lg" label="Loading library" /></div>
      ) : error ? (
        <div className="cl-empty mt-12">
          <p className="error-text">{error}</p>
          {error.toLowerCase().includes("sign in") && (
            <a href="/login?callbackUrl=/courses" className="cta-primary" style={{ marginTop: 16 }}>
              Sign in to continue
            </a>
          )}
        </div>
      ) : courses.length === 0 ? (
        <div className="cl-empty mt-12">
          <BookOpen size={34} />
          <p>No courses published yet. Check back soon.</p>
        </div>
      ) : (
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course, i) => (
            <Reveal key={course.id} delay={(i % 3) * 0.05}>
              <button onClick={() => openCourse(course)} className="cl-card">
                <div className="cl-card-art">
                  {course.thumbnail && (
                    <Image src={`/api/drive/image/${course.thumbnail}`} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" unoptimized className="cl-card-thumbnail" />
                  )}
                  <span className="cl-card-shade" />
                  <span className="cl-card-icon"><PlayCircle size={26} /></span>
                  <span className="cl-card-badge">COURSE / {String(i + 1).padStart(2, "0")}</span>
                  <span className="cl-card-lessons">{course.videoCount || 0} lessons</span>
                </div>
                <div className="cl-card-body">
                  <h3>{course.name}</h3>
                  <div className="cl-card-meta"><Clock3 size={13} /> Self-paced · streamed securely</div>
                </div>
              </button>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
