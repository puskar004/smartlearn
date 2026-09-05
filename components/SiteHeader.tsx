"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  Brain,
  ChevronDown,
  Music2,
  Shield,
  Timer,
} from "lucide-react";
import NavAuth from "@/components/NavAuth";
import { cn } from "@/lib/utils";

const academic = [
  { href: "/ncert", label: "NCERT Books & Chapters" },
  { href: "/pyq", label: "Previous Year Questions" },
  { href: "/ai-tutor", label: "Gemini AI Tutor" },
  { href: "/safe-search", label: "In-App Safe YouTube" },
  { href: "/quiz", label: "Chapter Rapid Quizzes" },
  { href: "/feynman", label: "Feynman Mode (Teach-back)" },
  { href: "/mistakes", label: "Mistake Vault" },
];

const focusTools = [
  { href: "/blueprint", label: "Board Blueprint" },
  { href: "/extreme", label: "Extreme Mode (Paid)" },
  { href: "/common-room", label: "Common Room Q&A" },
  { href: "/profile", label: "Focus Profile & Camera" },
  { href: "/dashboard", label: "Study Dashboard" },
];

export default function SiteHeader() {
  const [open, setOpen] = useState<"academic" | "focus" | null>(null);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/smartlearn-logo.svg"
            alt="SmartLearn"
            className="h-10 w-10 rounded-xl shadow-lg shadow-indigo-500/25"
          />
          <div className="leading-tight">
            <div className="text-lg font-extrabold tracking-tight text-slate-900">
              Smart<span className="text-amber-500">Learn</span>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Learning, Personalized
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <Link
            href="/ncert"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <BookOpen className="h-4 w-4 text-indigo-500" />
            NCERT &amp; PYQs
          </Link>

          <div
            className="relative"
            onMouseEnter={() => setOpen("academic")}
            onMouseLeave={() => setOpen(null)}
          >
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <Brain className="h-4 w-4 text-violet-500" />
              Academic &amp; AI Suite
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {open === "academic" && (
              <div className="absolute left-0 top-full min-w-[240px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {academic.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {i.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div
            className="relative"
            onMouseEnter={() => setOpen("focus")}
            onMouseLeave={() => setOpen(null)}
          >
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <Timer className="h-4 w-4 text-rose-500" />
              Exam &amp; Focus Tools
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {open === "focus" && (
              <div className="absolute left-0 top-full min-w-[220px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {focusTools.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-700"
                  >
                    {i.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/parent"
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold",
              "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            )}
          >
            <Shield className="h-4 w-4" />
            Parent Portal
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/study-music"
            className="hidden items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:inline-flex"
          >
            <Music2 className="h-4 w-4" />
            Study Music
          </Link>
          <NavAuth />
        </div>
      </div>
    </header>
  );
}
