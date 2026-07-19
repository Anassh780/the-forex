"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, BookOpen, Bookmark, CalendarDays,
  CheckCircle2, CircleHelp, Clock3, CreditCard, GraduationCap, Layers3,
  MessageSquareText, RefreshCw, ShieldCheck, Sparkles, TrendingUp,
} from "lucide-react";
import { Button, Reveal } from "@/components/ui";
import { CandleLoader } from "@/components/candle-loader";
import type { ProfileData } from "@/components/profile-editor";
import { uniqueBy } from "@/lib/collections";

type DashboardData = {
  role: string;
  memberSince: string;
  refreshedAt: string;
  profile: ProfileData;
  subscription: { tier: string; status: string; renewsAt: string } | null;
  stats: {
    totalStrategies: number;
    totalCourses: number;
    savedStrategies: number;
    coursesEnrolled: number;
    coursesInProgress: number;
    coursesCompleted: number;
    feedbackSent: number;
  };
  coursesInProgress: Array<{
    courseId: string;
    title: string;
    slug: string;
    lessonIndex: number;
    percent: number;
    totalLessons: number;
    updatedAt: string;
  }>;
  savedStrategies: Array<{
    id: string;
    slug: string;
    title: string;
    instrument: string;
    timeframe: string;
    accessTier: string;
  }>;
  recentPurchases: Array<{
    courseId: string;
    title: string;
    slug: string;
    purchasedAt: string;
  }>;
  recentFeedback: Array<{ id: string; category: string; createdAt: string }>;
};

type ActivityItem = { id: string; title: string; detail: string; at: string; kind: "course" | "purchase" | "feedback" };

const TIER_COLORS: Record<string, string> = { free: "text-muted", member: "text-profit", vip: "text-brass", admin: "text-brass" };

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatTime(iso: string | Date) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "now";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function timeAgo(iso: string) {
  const distance = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(distance) || distance < 60_000) return "just now";
  if (distance < 3_600_000) return `${Math.floor(distance / 60_000)}m ago`;
  if (distance < 86_400_000) return `${Math.floor(distance / 3_600_000)}h ago`;
  return formatDate(iso);
}

function isDashboardData(value: unknown): value is DashboardData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DashboardData>;
  return Boolean(
    candidate.stats && typeof candidate.stats.totalStrategies === "number" &&
    candidate.profile && typeof candidate.profile.email === "string" &&
    Array.isArray(candidate.coursesInProgress) && Array.isArray(candidate.savedStrategies) &&
    Array.isArray(candidate.recentPurchases) && Array.isArray(candidate.recentFeedback),
  );
}

function withoutDuplicateDashboardRows(data: DashboardData): DashboardData {
  return {
    ...data,
    coursesInProgress: uniqueBy(data.coursesInProgress, course => course.courseId),
    savedStrategies: uniqueBy(data.savedStrategies, strategy => strategy.id || strategy.slug),
    recentPurchases: uniqueBy(data.recentPurchases, purchase => `${purchase.courseId}:${purchase.purchasedAt}`),
    recentFeedback: uniqueBy(data.recentFeedback, feedback => feedback.id),
  };
}

function MetricCard({ icon: Icon, label, value, detail, accent = "lime" }: { icon: typeof Activity; label: string; value: string | number; detail: string; accent?: "lime" | "mint" | "blue" | "amber" }) {
  return (
    <article className={`dashboard-metric dashboard-metric-${accent}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="dashboard-metric-icon"><Icon size={17} /></span>
        <Activity size={12} className="text-white/20" />
      </div>
      <div className="mt-5 font-display text-4xl font-semibold tracking-[-.04em]">{value}</div>
      <div className="mt-3 text-[10px] font-bold uppercase tracking-[.14em] text-paper/80">{label}</div>
      <div className="mt-1 text-[10px] text-muted">{detail}</div>
    </article>
  );
}

function ProgressRing({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * 42;
  return (
    <div className="relative grid size-28 shrink-0 place-items-center">
      <svg className="size-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
        <circle className="dashboard-ring-track" cx="50" cy="50" r="42" fill="none" strokeWidth="7" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="url(#progressGradient)" strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - safe / 100)} />
        <defs><linearGradient id="progressGradient"><stop stopColor="#9BF56A" /><stop offset="1" stopColor="#62F6B2" /></linearGradient></defs>
      </svg>
      <span className="absolute font-display text-2xl font-semibold">{safe}%</span>
    </div>
  );
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const body = await response.json().catch(() => null) as unknown;
      if (!response.ok) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "The dashboard service is temporarily unavailable.";
        throw new Error(message);
      }
      if (!isDashboardData(body)) throw new Error("The dashboard returned incomplete data. Please try again.");
      setDashboard(withoutDuplicateDashboardRows(body));
      setLastUpdated(new Date(body.refreshedAt));
      setLoadError(null);
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : "Unable to load the dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const interval = window.setInterval(() => void loadDashboard(true), 30_000);
    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  const activity = useMemo<ActivityItem[]>(() => {
    if (!dashboard) return [];
    const items: ActivityItem[] = [
      ...dashboard.coursesInProgress.map(course => ({ id: `course-${course.courseId}`, title: "Learning progress", detail: `${course.title} · ${course.percent}% complete`, at: course.updatedAt, kind: "course" as const })),
      ...dashboard.recentPurchases.map(purchase => ({ id: `purchase-${purchase.courseId}`, title: "Course added", detail: purchase.title, at: purchase.purchasedAt, kind: "purchase" as const })),
      ...dashboard.recentFeedback.map(item => ({ id: `feedback-${item.id}`, title: "Feedback sent", detail: `${item.category} request`, at: item.createdAt, kind: "feedback" as const })),
    ];
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6);
  }, [dashboard]);

  if (status === "loading" || loading) return <div className="container-shell grid min-h-[55vh] place-items-center"><CandleLoader label="Opening live workspace" /></div>;

  if (loadError && !dashboard) {
    return (
      <div className="container-shell py-20"><div className="mx-auto max-w-xl rounded-2xl border border-loss/20 bg-loss/[.04] p-8 text-center"><AlertTriangle size={34} className="mx-auto text-loss" /><h1 className="mt-5 font-display text-3xl font-semibold">Dashboard unavailable</h1><p className="mt-3 text-sm text-muted">{loadError}</p><Button className="mt-6" onClick={() => void loadDashboard()}><RefreshCw size={14} className="mr-2 inline" /> RETRY</Button></div></div>
    );
  }

  const stats = dashboard?.stats;
  const role = dashboard?.role || (session?.user as { role?: string })?.role || "free";
  const activeTier = dashboard?.subscription?.tier || role;
  const displayName = dashboard?.profile.name || session?.user?.name || session?.user?.email?.split("@")[0] || "Trader";
  const completionRate = stats?.coursesEnrolled ? Math.round((stats.coursesCompleted / stats.coursesEnrolled) * 100) : 0;

  return (
    <div className="dashboard-v2">
      <div className="container-shell py-8 md:py-10">
        <Reveal>
          <section className="dashboard-live-hero">
            <div className="dashboard-live-grid" aria-hidden />
            <div className="relative z-10 flex flex-wrap items-start justify-between gap-8">
              <div className="max-w-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="dashboard-live-badge"><i /> LIVE WORKSPACE</span>
                  <span className={`text-[10px] font-bold uppercase tracking-[.16em] ${TIER_COLORS[activeTier] || "text-muted"}`}>{activeTier}</span>
                </div>
                <h1 className="mt-6 font-display text-4xl font-semibold tracking-[-.045em] md:text-5xl">{greetingForHour(new Date().getHours())}, {displayName}.</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">Your learning, strategy saves, account activity and support history update automatically every 30 seconds.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="dashboard-refresh" onClick={() => void loadDashboard(true)} disabled={refreshing} aria-label="Refresh dashboard data"><RefreshCw size={14} className={refreshing ? "opacity-60" : ""} /> {refreshing ? "SYNCING" : "REFRESH"}</button>
                <Link href="/courses"><Button variant="outline"><BookOpen size={14} className="mr-2 inline" /> COURSES</Button></Link>
                <Link href="/vip"><Button><CreditCard size={14} className="mr-2 inline" /> PLANS</Button></Link>
              </div>
            </div>
            <div className="dashboard-live-footer">
              <span><Clock3 size={13} /> Synced {lastUpdated ? formatTime(lastUpdated) : "now"}</span>
              <span><CalendarDays size={13} /> Member since {dashboard?.memberSince ? formatDate(dashboard.memberSince) : "—"}</span>
              <span><ShieldCheck size={13} /> Account {role === "admin" ? "administrator" : "active"}</span>
              {loadError && <span className="text-loss"><AlertTriangle size={13} /> Sync retry scheduled</span>}
            </div>
          </section>
        </Reveal>

        <Reveal delay={0.05}>
          <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard icon={Layers3} label="Strategies" value={stats?.savedStrategies ?? 0} detail={`${stats?.totalStrategies ?? 0} available · saved library`} />
            <MetricCard icon={GraduationCap} label="Course track" value={stats?.coursesEnrolled ?? 0} detail={`${stats?.totalCourses ?? 0} available · ${stats?.coursesInProgress ?? 0} active`} accent="blue" />
            <MetricCard icon={CheckCircle2} label="Completed" value={stats?.coursesCompleted ?? 0} detail={`${completionRate}% enrollment completion`} accent="mint" />
            <MetricCard icon={MessageSquareText} label="Feedback" value={stats?.feedbackSent ?? 0} detail="requests and product ideas sent" accent="amber" />
          </section>
        </Reveal>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_370px]">
          <div className="space-y-5">
            <Reveal delay={0.08}>
              <section className="dashboard-glow-card overflow-hidden">
                <div className="dashboard-section-head"><div><span className="eyebrow">Learning queue</span><h2>Continue learning</h2></div><Link href="/courses">View courses <ArrowRight size={13} /></Link></div>
                <div className="p-4 md:p-5">
                  {!dashboard?.coursesInProgress.length ? (
                    <div className="dashboard-empty"><span><GraduationCap size={22} /></span><div><strong>Your learning queue is clear</strong><p>Choose a course and your live progress will appear here.</p></div><Link href="/courses">Browse courses</Link></div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {dashboard.coursesInProgress.filter(course => course.percent < 100).slice(0, 4).map(course => (
                        <Link key={course.courseId} href={`/my-courses?courseId=${course.courseId}`} className="dashboard-course-row">
                          <div className="flex items-start justify-between gap-4"><div className="min-w-0"><span>COURSE</span><h3>{course.title}</h3><p>Lesson {course.lessonIndex + 1}{course.totalLessons ? ` of ${course.totalLessons}` : ""}</p></div><strong>{course.percent}%</strong></div>
                          <div><i style={{ width: `${course.percent}%` }} /></div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </Reveal>

            <Reveal delay={0.1}>
              <section className="dashboard-glow-card overflow-hidden">
                <div className="dashboard-section-head"><div><span className="eyebrow">Research vault</span><h2>Saved strategies</h2></div><Link href="/strategies">Open library <ArrowRight size={13} /></Link></div>
                <div className="p-4 md:p-5">
                  {!dashboard?.savedStrategies.length ? (
                    <div className="dashboard-empty"><span><Bookmark size={21} /></span><div><strong>No strategies saved yet</strong><p>Save a verified setup to build your personal research vault.</p></div><Link href="/strategies">Explore strategy</Link></div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {dashboard.savedStrategies.slice(0, 6).map(strategy => (
                        <Link key={strategy.id} href={`/strategies/${strategy.slug}`} className="dashboard-strategy-row"><span className="dashboard-strategy-icon"><BarChart3 size={16} /></span><div className="min-w-0 flex-1"><h3>{strategy.title}</h3><p>{strategy.instrument} · {strategy.timeframe}</p></div><span>{strategy.accessTier}</span><ArrowRight size={14} /></Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </Reveal>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-[98px]">
            <Reveal delay={0.08}>
              <section className="dashboard-glow-card p-5">
                <div className="flex items-center justify-between"><div><span className="eyebrow">Momentum</span><h2 className="mt-2 font-display text-2xl">Learning pulse</h2></div><span className="dashboard-live-badge"><i /> LIVE</span></div>
                <div className="mt-5 flex items-center gap-5"><ProgressRing value={completionRate} /><div className="space-y-3 text-xs"><div><strong className="block text-lg">{stats?.coursesInProgress ?? 0}</strong><span className="text-muted">courses active</span></div><div><strong className="block text-lg">{stats?.coursesCompleted ?? 0}</strong><span className="text-muted">courses completed</span></div></div></div>
              </section>
            </Reveal>

            <Reveal delay={0.1}>
              <section className="dashboard-glow-card p-5">
                <div className="flex items-center justify-between"><div><span className="eyebrow">Timeline</span><h2 className="mt-2 font-display text-2xl">Live activity</h2></div><Activity size={17} className="text-profit" /></div>
                <div className="dashboard-activity-list">
                  {activity.length ? activity.map(item => (
                    <div key={item.id} className="dashboard-activity-item"><span className={`dashboard-activity-dot dashboard-activity-${item.kind}`} /><div className="min-w-0 flex-1"><strong>{item.title}</strong><p>{item.detail}</p></div><time>{timeAgo(item.at)}</time></div>
                  )) : <div className="py-6 text-center"><Sparkles size={20} className="mx-auto text-brass" /><p className="mt-3 text-xs leading-5 text-muted">Your workspace is ready. New progress and activity will appear here automatically.</p></div>}
                </div>
              </section>
            </Reveal>

            <Reveal delay={0.12}>
              <section className="dashboard-command-card">
                <div><span className="eyebrow">Command center</span><h2>Quick actions</h2></div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link href="/strategies"><TrendingUp size={16} /> Strategy</Link>
                  <Link href="/courses"><BookOpen size={16} /> Courses</Link>
                  <Link href="/support"><CircleHelp size={16} /> Support</Link>
                  <Link href="/feedback"><MessageSquareText size={16} /> Feedback</Link>
                  {role === "admin" && <Link href="/admin-ui" className="col-span-2"><ShieldCheck size={16} /> Open admin workspace <ArrowRight size={14} className="ml-auto" /></Link>}
                </div>
              </section>
            </Reveal>
          </aside>
        </div>
      </div>
    </div>
  );
}
