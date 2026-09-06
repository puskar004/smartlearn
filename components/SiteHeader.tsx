"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  Brain,
  ChevronDown,
  Shield,
  Target,
} from "lucide-react";
import NavAuth from "@/components/NavAuth";
import { cn } from "@/lib/utils";

const ncertMenu = [
  { href: "/ncert", label: "NCERT Books & Chapters" },
  { href: "/pyq", label: "Previous Year Questions" },
];

const aiMenu = [
  { href: "/ai-tutor", label: "Gemini AI Tutor" },
  { href: "/feynman", label: "Feynman Mode" },
  { href: "/safe-search", label: "Safe YouTube" },
];

const practiceMenu = [
  { href: "/quiz", label: "Chapter Quizzes" },
  { href: "/test", label: "Live Class Test" },
  { href: "/mistakes", label: "Mistake Vault" },
];

const examMenu = [
  { href: "/blueprint", label: "Study Plan" },
  { href: "/extreme", label: "Extreme Mode" },
  { href: "/common-room", label: "Common Room" },
  { href: "/feynman", label: "Feynman Mode" },
];

function Drop({
  label,
  icon,
  items,
  open,
  onOpen,
  onClose,
}: {
  label: string;
  icon: React.ReactNode;
  items: { href: string; label: string }[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-800"
      >
        {icon}
        {label}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 min-w-[200px] rounded-xl border border-slate-100 bg-white py-2 shadow-xl">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="block px-4 py-2 text-sm text-slate-600 hover:bg-violet-50 hover:text-violet-800"
            >
              {it.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SiteHeader() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 border-b border-violet-100/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/smartlearn-logo.svg"
            alt="SmartLearn"
            className="h-10 w-10 rounded-xl shadow-lg shadow-violet-500/25"
          />
          <div className="leading-tight">
            <div className="text-lg font-extrabold tracking-tight text-slate-900">
              Smart<span className="text-violet-600">Learn</span>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Learning, Personalized
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          <Drop
            label="NCERT & PYQs"
            icon={<BookOpen className="mr-1 h-4 w-4 text-indigo-500" />}
            items={ncertMenu}
            open={open === "ncert"}
            onOpen={() => setOpen("ncert")}
            onClose={() => setOpen(null)}
          />
          <Drop
            label="AI Tutor"
            icon={<Brain className="mr-1 h-4 w-4 text-violet-500" />}
            items={aiMenu}
            open={open === "ai"}
            onOpen={() => setOpen("ai")}
            onClose={() => setOpen(null)}
          />
          <Drop
            label="Practice"
            icon={<Target className="mr-1 h-4 w-4 text-amber-500" />}
            items={practiceMenu}
            open={open === "practice"}
            onOpen={() => setOpen("practice")}
            onClose={() => setOpen(null)}
          />
          <Drop
            label="Exam & Focus Tools"
            icon={<SparkleDot />}
            items={examMenu}
            open={open === "exam"}
            onOpen={() => setOpen("exam")}
            onClose={() => setOpen(null)}
          />
          <Link
            href="/parent"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <Shield className="h-4 w-4 text-emerald-500" />
            Parent Portal
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={cn(
              "hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline"
            )}
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-600/25 hover:bg-violet-500"
          >
            Get Started →
          </Link>
          <div className="sm:hidden">
            <NavAuth />
          </div>
        </div>
      </div>
    </header>
  );
}

function SparkleDot() {
  return (
    <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded bg-fuchsia-100 text-[10px] text-fuchsia-600">
      ✦
    </span>
  );
}
