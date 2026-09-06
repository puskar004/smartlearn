"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { BookOpen, GraduationCap } from "lucide-react";
import { getRole } from "@/lib/teacher-store";
import { ROLE_EVENT } from "@/lib/role-events";
import {
  loadProgress,
  saveProgress,
  type UserProgress,
} from "@/lib/user-store";
import type { Grade } from "@/lib/curriculum";

const GRADES: { g: Grade; label: string; blurb: string }[] = [
  { g: "10", label: "Class 10", blurb: "Board basics · Science & Maths focus" },
  { g: "11", label: "Class 11", blurb: "Foundation year · PCM / PCB streams" },
  { g: "12", label: "Class 12", blurb: "Board year · full NCERT + PYQs" },
];

/**
 * After student login: force class 10/11/12 pick once.
 * Content (NCERT, Quiz, Plan, PYQ) follows this grade.
 */
export default function GradeGate() {
  const { userId, isSignedIn } = useAuth();
  const path = usePathname() || "";
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [need, setNeed] = useState(false);

  useEffect(() => {
    const sync = () => {
      if (!userId) {
        setRole("student");
        setNeed(false);
        return;
      }
      const r = getRole(userId);
      setRole(r);
      if (r !== "student") {
        setNeed(false);
        return;
      }
      const p = loadProgress(userId);
      setNeed(!p.gradeChosen);
    };
    sync();
    window.addEventListener(ROLE_EVENT, sync);
    window.addEventListener("sl-grade-changed", sync);
    return () => {
      window.removeEventListener(ROLE_EVENT, sync);
      window.removeEventListener("sl-grade-changed", sync);
    };
  }, [userId]);

  if (!isSignedIn || !userId || role !== "student") return null;
  if (path.startsWith("/teacher") || path.startsWith("/login")) return null;
  if (!need) return null;

  const pick = (g: Grade) => {
    const p = loadProgress(userId);
    const next: UserProgress = {
      ...p,
      grade: g,
      gradeChosen: true,
      // reset plan when class changes first time
      planChapterIds: p.grade === g ? p.planChapterIds : [],
    };
    saveProgress(next);
    setNeed(false);
    try {
      window.dispatchEvent(new Event("sl-grade-changed"));
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl border border-violet-200 bg-white p-6 shadow-2xl sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg">
          <GraduationCap className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-black text-slate-900">
          Which class are you in?
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          NCERT, quizzes, study plan and PYQs will match your class. You can
          change this later in Settings.
        </p>

        <div className="mt-6 grid gap-3">
          {GRADES.map((item) => (
            <button
              key={item.g}
              type="button"
              onClick={() => pick(item.g)}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-violet-400 hover:bg-violet-50 hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-lg font-black text-white">
                {item.g}
              </span>
              <span>
                <span className="block text-base font-extrabold text-slate-900">
                  {item.label}
                </span>
                <span className="block text-xs text-slate-500">{item.blurb}</span>
              </span>
              <BookOpen className="ml-auto h-5 w-5 text-violet-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
