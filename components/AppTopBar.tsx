"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Bell, Flame, Search, Sparkles, Star } from "lucide-react";
import NavAuth from "@/components/NavAuth";
import { loadProgress } from "@/lib/user-store";

export default function AppTopBar() {
  const { userId } = useAuth();
  const { user } = useUser();
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!userId) return;
    const p = loadProgress(userId);
    setXp(p.xp);
    setStreak(p.streak);
  }, [userId]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
        <form
          action="/ncert"
          className="relative min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim())
              window.location.href = `/ncert?q=${encodeURIComponent(q.trim())}`;
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for chapters, topics, concepts…"
            className="w-full rounded-full border border-slate-200/80 bg-white/90 py-2.5 pl-10 pr-16 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-violet-200 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:inline">
            Ctrl K
          </kbd>
        </form>

        <Link
          href="/blueprint"
          className="hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/25 transition hover:brightness-110 sm:inline-flex"
        >
          <Sparkles className="h-3.5 w-3.5" />
          What should I study now?
        </Link>

        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white p-2 text-slate-400 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        <div className="hidden items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1.5 text-xs font-bold text-orange-600 sm:flex">
          <Flame className="h-3.5 w-3.5" />
          {streak} Day Streak
        </div>

        <div className="hidden items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700 md:flex">
          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
          {xp.toLocaleString()} XP
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <div className="hidden text-right leading-tight xl:block">
              <div className="text-xs font-bold text-slate-800">
                {user.fullName || "Student"}
              </div>
              <div className="text-[10px] text-slate-400">CBSE learner</div>
            </div>
          )}
          <NavAuth />
        </div>
      </div>
    </header>
  );
}
