"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Calendar, Sparkles, Target } from "lucide-react";
import { CURRICULUM, type Grade } from "@/lib/curriculum";
import {
  loadProgress,
  saveProgress,
  weaknessMap,
  type UserProgress,
} from "@/lib/user-store";
import { daysUntilLocal, formatLocalYmd, toLocalYmd } from "@/lib/dates";

export default function BlueprintPage() {
  const { userId, isSignedIn } = useAuth();
  const [p, setP] = useState<UserProgress | null>(null);
  const [examDate, setExamDate] = useState("");

  useEffect(() => {
    if (!userId) return;
    const prog = loadProgress(userId);
    setP(prog);
    // Only accept clean YYYY-MM-DD already stored
    const raw = prog.boardExamDate || "";
    setExamDate(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "");
  }, [userId]);

  const daysLeft = useMemo(() => {
    if (!examDate) return null;
    return daysUntilLocal(examDate);
  }, [examDate]);

  const grade = (p?.grade || "12") as Grade;
  const pack = CURRICULUM.find((g) => g.grade === grade)!;
  const weak = p ? weaknessMap(p) : [];

  const todayKey = toLocalYmd(new Date());

  const todayPlan = useMemo(() => {
    const day = new Date().getDate();
    const subjects = pack.subjects;
    const picks = [0, 1, 2].map((i) => {
      const s = subjects[(day + i) % subjects.length];
      const ch = s.chapters[(day + i * 3) % s.chapters.length];
      return { subject: s.name, chapter: ch, href: `/quiz/${ch.id}` };
    });
    if (weak.length) {
      const wName = weak[0][0];
      const s = pack.subjects.find((x) => x.name === wName);
      if (s) {
        picks[0] = {
          subject: s.name,
          chapter: s.chapters[day % s.chapters.length],
          href: `/quiz/${s.chapters[day % s.chapters.length].id}`,
        };
      }
    }
    return picks;
  }, [pack, weak, todayKey]);

  const minDate = toLocalYmd(new Date());
  const maxDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 5);
    return toLocalYmd(d);
  })();

  const saveDate = () => {
    if (!userId || !p) return;
    if (examDate && daysUntilLocal(examDate) == null) {
      alert("Please pick a valid date (YYYY-MM-DD).");
      return;
    }
    const next = { ...p, boardExamDate: examDate || null };
    saveProgress(next);
    setP(next);
  };

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-slate-500">
        Sign in to unlock your personal Board Blueprint (fresh per account).
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
        <Target className="h-3.5 w-3.5" /> Unique · Board Blueprint
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Today&apos;s micro-plan to board day
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Built from <em>your</em> mistake vault + class + countdown. New login
        starts at day zero.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Calendar className="h-4 w-4 text-indigo-500" />
          Your first board exam date
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={examDate}
            min={minDate}
            max={maxDate}
            onChange={(e) => {
              const v = e.target.value; // always YYYY-MM-DD from browser
              setExamDate(v);
            }}
            className="min-w-[11rem] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
          />
          <button
            type="button"
            onClick={saveDate}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white"
          >
            Save
          </button>
        </div>
        {examDate && (
          <p className="mt-2 text-xs text-slate-500">
            Saved as: <strong>{formatLocalYmd(examDate)}</strong> ({examDate})
          </p>
        )}
        {daysLeft != null && (
          <p className="mt-3 text-2xl font-black text-indigo-600">
            {daysLeft > 0
              ? `${daysLeft} days left`
              : daysLeft === 0
                ? "Exam is today — stay calm & revise"
                : `Exam was ${Math.abs(daysLeft)} days ago`}
          </p>
        )}
      </div>

      <h2 className="mt-8 text-lg font-bold text-slate-900">
        <Sparkles className="mr-1 inline h-4 w-4 text-amber-500" />
        Today&apos;s 3 missions
      </h2>
      <div className="mt-3 space-y-3">
        {todayPlan.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300"
          >
            <div className="text-[11px] font-bold text-indigo-600">
              MISSION {i + 1}
            </div>
            <div className="mt-1 font-bold text-slate-900">
              {item.subject} · {item.chapter.title}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              10-min rapid quiz + NCERT skim
            </div>
          </Link>
        ))}
      </div>

      {weak.length > 0 && (
        <div className="mt-8 rounded-2xl border border-rose-100 bg-rose-50 p-4">
          <h3 className="text-sm font-bold text-rose-800">Weakness heat</h3>
          <ul className="mt-2 space-y-1 text-xs text-rose-700">
            {weak.map(([name, n]) => (
              <li key={name}>
                {name}: {n} stored mistakes
              </li>
            ))}
          </ul>
          <Link
            href="/mistakes"
            className="mt-2 inline-block text-xs font-bold text-rose-800 underline"
          >
            Open Mistake Vault
          </Link>
        </div>
      )}
    </div>
  );
}
