"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import {
  BookOpen,
  Brain,
  MessageSquare,
  Trophy,
  Zap,
  AlertTriangle,
  Target,
  ArrowRight,
  Star,
  Flame,
  PlayCircle,
  GraduationCap,
  Radio,
} from "lucide-react";
import {
  accuracy,
  loadProgress,
  weaknessMap,
  type UserProgress,
} from "@/lib/user-store";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/display-name";
import {
  dropJoinedClasses,
  getJoinedClasses,
  getRole,
  setRole,
} from "@/lib/teacher-store";
import { emitRoleChanged } from "@/lib/role-events";

const tiles = [
  {
    href: "/ncert",
    title: "NCERT Library",
    desc: "Complete CBSE bookshelf with in-app PDFs",
    icon: BookOpen,
    tone: "bg-indigo-50 text-indigo-600",
  },
  {
    href: "/blueprint",
    title: "Board Blueprint",
    desc: "Countdown + daily missions",
    icon: Target,
    tone: "bg-violet-50 text-violet-600",
  },
  {
    href: "/mistakes",
    title: "Mistake Vault",
    desc: "Your personal error DNA",
    icon: AlertTriangle,
    tone: "bg-rose-50 text-rose-600",
  },
  {
    href: "/ai-tutor",
    title: "Gemini Tutor",
    desc: "Step-by-step NCERT solutions",
    icon: Brain,
    tone: "bg-emerald-50 text-emerald-600",
  },
  {
    href: "/feynman",
    title: "Feynman Mode",
    desc: "Explain like you're 12 · AI grades you",
    icon: Brain,
    tone: "bg-violet-50 text-violet-700",
  },
  {
    href: "/safe-search",
    title: "Safe YouTube",
    desc: "Education videos in-app only",
    icon: PlayCircle,
    tone: "bg-amber-50 text-amber-600",
  },
  {
    href: "/quiz",
    title: "Rapid Quizzes",
    desc: "Chapter levels + XP",
    icon: Trophy,
    tone: "bg-sky-50 text-sky-600",
  },
  {
    href: "/common-room",
    title: "Common Room",
    desc: "Timed peer Q&A",
    icon: MessageSquare,
    tone: "bg-pink-50 text-pink-600",
  },
  {
    href: "/extreme",
    title: "Extreme Mode",
    desc: "Paid deep-focus lock",
    icon: Zap,
    tone: "bg-violet-50 text-violet-700",
  },
];

export default function DashboardPage() {
  const { user } = useUser();
  const { userId, isSignedIn } = useAuth();
  const [p, setP] = useState<UserProgress | null>(null);
  const [liveBanner, setLiveBanner] = useState<{
    title: string;
    code: string;
    subject?: string;
    joinUntil?: number;
  } | null>(null);

  useEffect(() => {
    if (userId) setP(loadProgress(userId));
  }, [userId]);

  // Show teacher live session on student home after join
  useEffect(() => {
    if (!userId || !isSignedIn) return;
    if (getRole(userId) === "teacher") return;

    const pull = async () => {
      try {
        const codes = getJoinedClasses(userId);
        if (!codes.length) {
          setLiveBanner(null);
          return;
        }
        // Fast path: dedicated liveStatus (shared index + Clerk fallback)
        const q = new URLSearchParams({
          action: "liveStatus",
          codes: codes.join(","),
          _: String(Date.now()),
        });
        const res = await fetch(`/api/classroom?${q}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = await res.json();
        const live = (data.live || data.sessions?.[0]) as
          | {
              code: string;
              active?: boolean;
              title?: string;
              subject?: string;
              joinUntil?: number;
              startedAt?: number;
            }
          | null
          | undefined;
        if (live?.active && live.code) {
          setLiveBanner({
            title: live.title || "Live class",
            code: live.code,
            subject: live.subject,
            joinUntil:
              live.joinUntil ||
              (live.startedAt || Date.now()) + 15 * 60_000,
          });
          return;
        }
        // Fallback full joined payload
        const q2 = new URLSearchParams({
          action: "joined",
          codes: codes.join(","),
          _: String(Date.now()),
        });
        const res2 = await fetch(`/api/classroom?${q2}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data2 = await res2.json();
        if (Array.isArray(data2.deleted) && data2.deleted.length) {
          dropJoinedClasses(userId, data2.deleted as string[]);
        }
        const rooms = (data2.classrooms ||
          (data2.classroom ? [data2.classroom] : [])) as {
          code: string;
          liveSession?: {
            active?: boolean;
            title?: string;
            subject?: string;
          } | null;
        }[];
        const hit = rooms.find((r) => r.liveSession?.active);
        if (hit?.liveSession?.active) {
          const ju =
            (hit.liveSession as { joinUntil?: number }).joinUntil ||
            ((hit.liveSession as { startedAt?: number }).startedAt ||
              Date.now()) +
              15 * 60_000;
          setLiveBanner({
            title: hit.liveSession.title || "Live class",
            code: hit.code,
            subject: hit.liveSession.subject,
            joinUntil: ju,
          });
        } else {
          setLiveBanner(null);
        }
      } catch {
        // ignore
      }
    };

    void pull();
    const id = setInterval(() => void pull(), 5_000);
    return () => clearInterval(id);
  }, [userId, isSignedIn]);

  const acc = p ? accuracy(p) : null;
  const weak = p ? weaknessMap(p) : [];
  const first =
    user?.firstName ||
    displayName(user).split(" ")[0] ||
    displayName(user);

  return (
    <div className="relative w-full max-w-[100%] px-3 py-4 sm:px-4 sm:py-6 lg:px-8 lg:py-8">
      {/* Ambient lighting (visual only) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-24 -top-16 h-72 w-72 rounded-full bg-violet-400/25 blur-3xl" />
        <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-fuchsia-300/15 blur-3xl" />
        <div className="absolute right-1/4 top-1/2 h-48 w-48 rounded-full bg-indigo-400/10 blur-2xl" />
      </div>

      {liveBanner && (
        <Link
          href="/live-class"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-3 text-white shadow-lg shadow-rose-500/25 transition hover:brightness-105"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <Radio className="h-5 w-5 animate-pulse" />
            </span>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-rose-100">
                Live now · class {liveBanner.code}
                {liveBanner.joinUntil && liveBanner.joinUntil > Date.now()
                  ? ` · join ${Math.max(1, Math.ceil((liveBanner.joinUntil - Date.now()) / 60000))} min`
                  : ""}
              </div>
              <div className="text-sm font-extrabold">
                {liveBanner.title}
                {liveBanner.subject ? ` · ${liveBanner.subject}` : ""}
              </div>
            </div>
          </div>
          <span className="rounded-xl bg-white px-4 py-2 text-xs font-black text-rose-700">
            Join live class →
          </span>
        </Link>
      )}

      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-br from-[#f5e9ff] via-[#eef2ff] to-[#dbeafe] p-4 shadow-[0_20px_60px_-20px_rgba(109,40,217,0.35),0_0_0_1px_rgba(255,255,255,0.6)_inset] sm:rounded-[28px] sm:p-6 lg:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/50 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-12 left-10 h-40 w-40 rounded-full bg-violet-400/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-1/3 top-0 h-24 w-64 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-xl"
        />
        <div className="relative z-10 flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 drop-shadow-sm sm:text-3xl lg:text-4xl">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-600 bg-clip-text text-transparent">
                {first}!
              </span>{" "}
              <span aria-hidden>👋</span>
            </h1>
            <p className="mt-2 text-sm text-slate-600/90">
              {p?.gradeChosen
                ? `Class ${p.grade} desk — NCERT, quizzes & plan match your class.`
                : "Your learning journey continues. Stay curious, keep learning!"}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-3 self-end md:self-center">
            <p className="text-right font-serif text-base italic leading-snug text-indigo-800/90 sm:text-lg">
              “A better you,
              <br />
              brighter tomorrow.”
            </p>
            <div className="flex h-20 w-40 items-end justify-end gap-1.5 rounded-2xl border border-white/80 bg-white/60 p-2 shadow-[0_12px_40px_-12px_rgba(79,70,229,0.45)] backdrop-blur-md sm:h-24 sm:w-44">
              <div className="h-10 w-7 rounded-md bg-gradient-to-t from-sky-400 to-sky-200 shadow-md shadow-sky-400/40 sm:w-8" />
              <div className="h-14 w-7 rounded-md bg-gradient-to-t from-indigo-500 to-indigo-300 shadow-md shadow-indigo-500/40 sm:w-8" />
              <div className="h-8 w-7 rounded-md bg-gradient-to-t from-violet-400 to-violet-200 shadow-md shadow-violet-400/40 sm:w-8" />
              <div className="mb-1 max-w-[4.5rem] text-right text-[9px] font-bold leading-tight text-indigo-800">
                Progress
                <br />
                Over
                <br />
                Perfection
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Separate teacher panel entry — not mixed into student tools */}
      {isSignedIn && userId && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100/80 bg-white/80 px-4 py-3 shadow-[0_8px_30px_-12px_rgba(79,70,229,0.25)] backdrop-blur-sm">
          <div>
            <div className="text-sm font-bold text-slate-900">
              Are you a teacher?
            </div>
            <p className="text-[11px] text-slate-500">
              Opens a separate Teacher panel (classes, PDFs, live). Student tools
              stay here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setRole(userId, "teacher");
              emitRoleChanged();
              window.location.href = "/teacher";
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/35 ring-1 ring-white/30"
          >
            <GraduationCap className="h-4 w-4" />
            Join as Teacher
          </button>
        </div>
      )}

      {/* Stats row */}
      {isSignedIn && p && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Star className="h-4 w-4 fill-violet-500 text-violet-500" />}
            iconBg="bg-violet-50"
            label="XP Points"
            value={String(p.xp)}
            hint="+ progress this week"
            hintClass="text-emerald-600 bg-emerald-50"
          />
          <StatCard
            icon={<Flame className="h-4 w-4 text-orange-500" />}
            iconBg="bg-orange-50"
            label="Study Streak"
            value={`${p.streak} day${p.streak === 1 ? "" : "s"}`}
            hint="Keep it going!"
            hintClass="text-orange-600 bg-orange-50"
          />
          <StatCard
            icon={<Target className="h-4 w-4 text-emerald-600" />}
            iconBg="bg-emerald-50"
            label="Quiz Accuracy"
            value={acc != null ? `${acc}%` : "—"}
            hint="Keep practicing!"
            hintClass="text-emerald-600 bg-emerald-50"
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
            iconBg="bg-rose-50"
            label="Mistakes Stored"
            value={String(p.mistakes.length)}
            hint="Learn from them!"
            hintClass="text-rose-600 bg-rose-50"
          />
        </div>
      )}

      {/* Focus next */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-200/60 bg-gradient-to-r from-violet-100/90 via-fuchsia-50/80 to-indigo-100/90 px-4 py-3 shadow-[0_0_40px_-10px_rgba(139,92,246,0.45)] ring-1 ring-white/60">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-white shadow-md shadow-violet-600/50">
            <Target className="h-3.5 w-3.5" />
          </span>
          <span className="font-bold text-violet-800">Focus Next:</span>
          <span className="text-slate-700">
            {weak.length > 0
              ? weak.map(([n]) => n).slice(0, 2).join(" · ")
              : "Physics"}
            {" — "}
            <Link
              href="/mistakes"
              className="font-semibold text-violet-700 underline underline-offset-2"
            >
              Mistake Vault
            </Link>
          </span>
        </div>
        <Link
          href="/mistakes"
          className="text-xs font-semibold text-violet-600 hover:underline"
        >
          Turn your mistakes into strengths! →
        </Link>
      </div>

      {/* Feature tiles — 3 columns like screenshot */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="sl-card group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/80 bg-white/85 p-4 shadow-[0_10px_40px_-18px_rgba(15,23,42,0.18)] backdrop-blur-sm hover:border-violet-200/80 hover:shadow-[0_18px_50px_-16px_rgba(109,40,217,0.35)]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-violet-400/10 blur-2xl transition group-hover:bg-violet-400/25"
            />
            <div
              className={cn(
                "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-inner ring-1 ring-white/60",
                t.tone
              )}
            >
              <t.icon className="h-5 w-5" />
            </div>
            <div className="relative min-w-0 flex-1">
              <h2 className="font-bold text-slate-900 group-hover:text-violet-800">
                {t.title}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">{t.desc}</p>
            </div>
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-100 bg-white/80 text-slate-400 shadow-sm transition group-hover:border-violet-200 group-hover:bg-violet-50 group-hover:text-violet-600 group-hover:shadow-md group-hover:shadow-violet-500/20">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
  hint,
  hintClass,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  hint: string;
  hintClass: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/80 bg-white/90 p-4 shadow-[0_12px_40px_-16px_rgba(79,70,229,0.28)] ring-1 ring-slate-100/80 backdrop-blur-sm">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-violet-400/15 blur-2xl"
      />
      <div className="relative flex items-center gap-2 text-xs font-medium text-slate-500">
        <span
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-xl shadow-sm ring-1 ring-white/70",
            iconBg
          )}
        >
          {icon}
        </span>
        {label}
      </div>
      <div className="relative mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
        {value}
      </div>
      <div
        className={cn(
          "mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
          hintClass
        )}
      >
        {hint}
      </div>
    </div>
  );
}
