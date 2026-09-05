"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import {
  BookOpen,
  Brain,
  MessageSquare,
  Shield,
  Trophy,
  Zap,
  AlertTriangle,
  Target,
  ArrowRight,
  Star,
  Flame,
  PlayCircle,
} from "lucide-react";
import {
  accuracy,
  loadProgress,
  weaknessMap,
  type UserProgress,
} from "@/lib/user-store";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/display-name";

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

  useEffect(() => {
    if (userId) setP(loadProgress(userId));
  }, [userId]);

  const acc = p ? accuracy(p) : null;
  const weak = p ? weaknessMap(p) : [];
  const first =
    user?.firstName ||
    displayName(user).split(" ")[0] ||
    displayName(user);

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-[28px] border border-violet-100 bg-gradient-to-r from-[#f3e8ff] via-[#eef2ff] to-[#e0f2fe] p-6 shadow-sm sm:p-8">
        <div className="relative z-10 max-w-xl">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              {first}!
            </span>{" "}
            <span aria-hidden>👋</span>
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Your learning journey continues. Stay curious, keep learning!
          </p>
        </div>
        <div className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 text-right md:block">
          <p className="font-serif text-lg italic text-indigo-700/80">
            “A better you,
            <br />
            brighter tomorrow.”
          </p>
          <div className="mt-3 ml-auto flex h-24 w-36 items-end justify-center gap-1 rounded-2xl bg-white/70 p-2 shadow-sm backdrop-blur">
            <div className="h-10 w-8 rounded bg-sky-300/80" />
            <div className="h-14 w-8 rounded bg-indigo-400/80" />
            <div className="h-8 w-8 rounded bg-violet-300/80" />
            <div className="mb-1 text-[9px] font-bold leading-tight text-indigo-700">
              Progress
              <br />
              Over
              <br />
              Perfection
            </div>
          </div>
        </div>
      </div>

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
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-white">
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
            className="sl-card group flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:border-violet-200"
          >
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                t.tone
              )}
            >
              <t.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-slate-900 group-hover:text-violet-800">
                {t.title}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">{t.desc}</p>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-100 text-slate-400 transition group-hover:border-violet-200 group-hover:bg-violet-50 group-hover:text-violet-600">
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
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-xl",
            iconBg
          )}
        >
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div>
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
