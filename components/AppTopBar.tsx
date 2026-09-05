"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Bell, Flame, Sparkles, Star } from "lucide-react";
import NavAuth from "@/components/NavAuth";
import { loadProgress } from "@/lib/user-store";
import { getRole } from "@/lib/teacher-store";
import { ROLE_EVENT } from "@/lib/role-events";

export default function AppTopBar() {
  const { userId } = useAuth();
  const { user } = useUser();
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [role, setRole] = useState<"student" | "teacher">("student");

  useEffect(() => {
    const sync = () => {
      if (!userId) return;
      const p = loadProgress(userId);
      setXp(p.xp);
      setStreak(p.streak);
      setRole(getRole(userId));
    };
    sync();
    window.addEventListener(ROLE_EVENT, sync);
    return () => window.removeEventListener(ROLE_EVENT, sync);
  }, [userId]);

  const isTeacher = role === "teacher";

  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 backdrop-blur-xl">
      <div className="flex items-center justify-end gap-3 px-4 py-3 lg:px-6">
        {!isTeacher && (
          <Link
            href="/blueprint"
            className="hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/25 transition hover:brightness-110 sm:inline-flex"
          >
            <Sparkles className="h-3.5 w-3.5" />
            What should I study now?
          </Link>
        )}

        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white p-2 text-slate-400 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-600"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        {!isTeacher && (
          <>
            <div className="hidden items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1.5 text-xs font-bold text-orange-600 sm:flex">
              <Flame className="h-3.5 w-3.5" />
              {streak} Day Streak
            </div>
            <div className="hidden items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-700 md:flex">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              {xp.toLocaleString()} XP
            </div>
          </>
        )}

        {isTeacher && (
          <div className="hidden rounded-full bg-indigo-100 px-3 py-1.5 text-[11px] font-bold text-indigo-800 sm:block">
            TEACHER
          </div>
        )}

        <div className="flex items-center gap-2">
          {user && (
            <div className="hidden text-right leading-tight xl:block">
              <div className="text-xs font-bold text-slate-800">
                {user.fullName || "User"}
              </div>
              <div className="text-[10px] text-slate-400">
                {isTeacher ? "Teacher" : "Student"}
              </div>
            </div>
          )}
          <NavAuth />
        </div>
      </div>
    </header>
  );
}
