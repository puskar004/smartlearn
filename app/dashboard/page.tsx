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
} from "lucide-react";
import {
  accuracy,
  loadProgress,
  weaknessMap,
  type UserProgress,
} from "@/lib/user-store";
import { cn } from "@/lib/utils";

const tiles = [
  {
    href: "/ncert",
    title: "NCERT Library",
    desc: "Complete CBSE bookshelf with in-app PDFs",
    icon: BookOpen,
    color: "text-indigo-600 bg-indigo-50 group-hover:bg-indigo-500 group-hover:text-white",
  },
  {
    href: "/blueprint",
    title: "Board Blueprint",
    desc: "Countdown + daily missions",
    icon: Target,
    color: "text-blue-600 bg-blue-50 group-hover:bg-blue-500 group-hover:text-white",
  },
  {
    href: "/mistakes",
    title: "Mistake Vault",
    desc: "Your personal error DNA",
    icon: AlertTriangle,
    color: "text-rose-600 bg-rose-50 group-hover:bg-rose-500 group-hover:text-white",
  },
  {
    href: "/ai-tutor",
    title: "Gemini Tutor",
    desc: "Step-by-step NCERT solutions",
    icon: Brain,
    color: "text-fuchsia-600 bg-fuchsia-50 group-hover:bg-fuchsia-500 group-hover:text-white",
  },
  {
    href: "/safe-search",
    title: "Safe YouTube",
    desc: "Education videos in-app only",
    icon: Shield,
    color: "text-emerald-600 bg-emerald-50 group-hover:bg-emerald-500 group-hover:text-white",
  },
  {
    href: "/quiz",
    title: "Rapid Quizzes",
    desc: "Chapter levels + XP",
    icon: Trophy,
    color: "text-amber-700 bg-amber-50 group-hover:bg-amber-500 group-hover:text-white",
  },
  {
    href: "/common-room",
    title: "Common Room",
    desc: "Timed peer Q&A",
    icon: MessageSquare,
    color: "text-sky-600 bg-sky-50 group-hover:bg-sky-500 group-hover:text-white",
  },
  {
    href: "/extreme",
    title: "Extreme Mode",
    desc: "Paid deep-focus lock",
    icon: Zap,
    color: "text-rose-600 bg-rose-50 group-hover:bg-rose-500 group-hover:text-white",
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

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/60 p-6 shadow-sm backdrop-blur-sm sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-600">
          Student home
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          Welcome{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          {isSignedIn
            ? "Your private desk — progress is isolated to this account."
            : "Sign in to start a fresh personal journey."}
        </p>

        {isSignedIn && p && (
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <Stat label="XP" value={String(p.xp)} />
            <Stat label="Streak" value={`${p.streak}d`} />
            <Stat label="Quiz accuracy" value={acc != null ? `${acc}%` : "—"} />
            <Stat label="Mistakes stored" value={String(p.mistakes.length)} />
          </div>
        )}

        {weak.length > 0 && (
          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/90 px-4 py-3 text-xs text-rose-800">
            <strong>Focus next:</strong> {weak.map(([n]) => n).join(" · ")}
            {" — "}
            <Link href="/mistakes" className="font-bold underline">
              Mistake Vault
            </Link>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="sl-card group rounded-3xl border border-white/80 bg-white/70 p-5 shadow-sm hover:border-violet-200"
          >
            <div
              className={cn(
                "inline-flex rounded-2xl p-3 transition-all duration-200",
                t.color
              )}
            >
              <t.icon className="h-5 w-5" />
            </div>
            <h2 className="mt-3 flex items-center gap-1 font-bold text-slate-900 group-hover:text-violet-800">
              {t.title}
              <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </h2>
            <p className="mt-1 text-sm text-slate-500">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="sl-card rounded-2xl border border-slate-100/80 bg-white/90 p-4">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}
