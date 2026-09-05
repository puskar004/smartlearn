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
  Sparkles,
} from "lucide-react";
import {
  accuracy,
  loadProgress,
  weaknessMap,
  type UserProgress,
} from "@/lib/user-store";

const tiles = [
  {
    href: "/ncert",
    title: "NCERT Library",
    desc: "All subjects · chapter PDFs",
    icon: BookOpen,
    color: "text-indigo-600 bg-indigo-50",
  },
  {
    href: "/blueprint",
    title: "Board Blueprint",
    desc: "Your countdown + daily missions",
    icon: Target,
    color: "text-blue-600 bg-blue-50",
  },
  {
    href: "/mistakes",
    title: "Mistake Vault",
    desc: "Personal error DNA only",
    icon: AlertTriangle,
    color: "text-rose-600 bg-rose-50",
  },
  {
    href: "/feynman",
    title: "Feynman Mode",
    desc: "Teach back · AI grades you",
    icon: Sparkles,
    color: "text-violet-600 bg-violet-50",
  },
  {
    href: "/ai-tutor",
    title: "Gemini Tutor",
    desc: "Step-by-step doubt clearing",
    icon: Brain,
    color: "text-violet-600 bg-violet-50",
  },
  {
    href: "/safe-search",
    title: "Safe YouTube",
    desc: "Education-only video search",
    icon: Shield,
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    href: "/quiz",
    title: "Rapid Quizzes",
    desc: "Chapter levels + XP",
    icon: Trophy,
    color: "text-amber-700 bg-amber-50",
  },
  {
    href: "/common-room",
    title: "Common Room",
    desc: "Timed peer Q&A",
    icon: MessageSquare,
    color: "text-sky-600 bg-sky-50",
  },
  {
    href: "/extreme",
    title: "Extreme Mode",
    desc: "Paid no-back timer lock",
    icon: Zap,
    color: "text-rose-600 bg-rose-50",
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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold text-slate-900">
        Welcome{user?.firstName ? `, ${user.firstName}` : ""}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        {isSignedIn
          ? "Your private desk — progress is isolated to this account (fresh if you just signed up)."
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
        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          <strong>Focus next:</strong> {weak.map(([n]) => n).join(" · ")}
          {" — "}
          <Link href="/mistakes" className="font-bold underline">
            Mistake Vault
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={`inline-flex rounded-xl p-2.5 ${t.color}`}>
              <t.icon className="h-5 w-5" />
            </div>
            <h2 className="mt-3 font-bold text-slate-900">{t.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}
