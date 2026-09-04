"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  BookOpen,
  Brain,
  MessageSquare,
  Shield,
  Trophy,
  Zap,
} from "lucide-react";

const tiles = [
  {
    href: "/ncert",
    title: "NCERT Library",
    desc: "Class 10–12 chapters & PDFs",
    icon: BookOpen,
    color: "text-indigo-600 bg-indigo-50",
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold text-slate-900">
        Welcome{user?.firstName ? `, ${user.firstName}` : ""}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Your focus desk. Stay on SmartLearn — tab switches notify parents when
        Focus Lock is on.
      </p>

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
