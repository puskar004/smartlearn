"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  BookOpen,
  Calendar,
  Check,
  CheckSquare,
  Sparkles,
  Square,
  Target,
} from "lucide-react";
import { CURRICULUM, type Chapter, type Grade } from "@/lib/curriculum";
import {
  loadProgress,
  saveProgress,
  weaknessMap,
  type UserProgress,
} from "@/lib/user-store";
import { daysUntilLocal, formatLocalYmd, toLocalYmd } from "@/lib/dates";
import { cn } from "@/lib/utils";

type PlanDay = {
  day: number;
  dateLabel: string;
  items: { subject: string; chapter: Chapter; focus: string }[];
};

function buildPlan(
  chapterIds: string[],
  grade: Grade,
  examDate: string | null
): PlanDay[] {
  const pack = CURRICULUM.find((g) => g.grade === grade)!;
  const selected: { subject: string; chapter: Chapter }[] = [];
  for (const s of pack.subjects) {
    for (const ch of s.chapters) {
      if (chapterIds.includes(ch.id)) {
        selected.push({ subject: s.name, chapter: ch });
      }
    }
  }
  if (selected.length === 0) return [];

  const daysLeft =
    examDate && daysUntilLocal(examDate) != null
      ? Math.max(3, daysUntilLocal(examDate)!)
      : 21;
  const planDays = Math.min(45, Math.max(5, Math.min(daysLeft, selected.length * 2)));
  const perDay = Math.max(1, Math.ceil(selected.length / planDays));

  const out: PlanDay[] = [];
  let idx = 0;
  const start = new Date();
  for (let d = 0; d < planDays && idx < selected.length; d++) {
    const date = new Date(start);
    date.setDate(date.getDate() + d);
    const items = [];
    for (let k = 0; k < perDay && idx < selected.length; k++) {
      const pick = selected[idx++];
      items.push({
        ...pick,
        focus:
          k === 0
            ? "NCERT read + notes"
            : k === 1
              ? "Board-style quiz"
              : "PYQ + Feynman explain",
      });
    }
    // recycle remainder for revision days
    if (items.length === 0 && selected.length) {
      const pick = selected[d % selected.length];
      items.push({ ...pick, focus: "Quick revision" });
    }
    out.push({
      day: d + 1,
      dateLabel: toLocalYmd(date),
      items,
    });
  }
  return out;
}

export default function BlueprintPage() {
  const { userId, isSignedIn } = useAuth();
  const [p, setP] = useState<UserProgress | null>(null);
  const [examDate, setExamDate] = useState("");
  const [grade, setGrade] = useState<Grade>("12");
  const [selected, setSelected] = useState<string[]>([]);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<PlanDay[]>([]);

  useEffect(() => {
    if (!userId) return;
    const prog = loadProgress(userId);
    setP(prog);
    setGrade(prog.grade);
    setSelected(prog.planChapterIds || []);
    const raw = prog.boardExamDate || "";
    setExamDate(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "");
    if ((prog.planChapterIds || []).length) {
      setPlan(
        buildPlan(prog.planChapterIds, prog.grade, prog.boardExamDate)
      );
    }
  }, [userId]);

  const daysLeft = useMemo(() => {
    if (!examDate) return null;
    return daysUntilLocal(examDate);
  }, [examDate]);

  const pack = CURRICULUM.find((g) => g.grade === grade)!;
  const weak = p ? weaknessMap(p) : [];
  const todayKey = toLocalYmd(new Date());

  const todayMissions = useMemo(() => {
    if (plan.length) {
      const today = plan.find((d) => d.dateLabel === todayKey) || plan[0];
      return today.items.map((it) => ({
        subject: it.subject,
        chapter: it.chapter,
        focus: it.focus,
        href: `/quiz/${it.chapter.id}`,
      }));
    }
    // fallback random if no syllabus yet
    const subjects = pack.subjects;
    const day = new Date().getDate();
    return [0, 1, 2].map((i) => {
      const s = subjects[(day + i) % subjects.length];
      const ch = s.chapters[(day + i * 3) % s.chapters.length];
      return {
        subject: s.name,
        chapter: ch,
        focus: "Pick syllabus below for a full plan",
        href: `/quiz/${ch.id}`,
      };
    });
  }, [plan, pack, todayKey]);

  const minDate = toLocalYmd(new Date());
  const maxDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 5);
    return toLocalYmd(d);
  })();

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllSubject = (subjectId: string) => {
    const s = pack.subjects.find((x) => x.id === subjectId);
    if (!s) return;
    const ids = s.chapters.map((c) => c.id);
    setSelected((prev) => {
      const allOn = ids.every((id) => prev.includes(id));
      if (allOn) return prev.filter((id) => !ids.includes(id));
      return Array.from(new Set([...prev, ...ids]));
    });
  };

  const saveAndBuild = () => {
    if (!userId) {
      setSaveMsg("Please sign in first.");
      return;
    }
    if (selected.length === 0) {
      setSaveMsg("Select at least one chapter from your syllabus.");
      return;
    }
    setSaving(true);
    try {
      const prog = loadProgress(userId);
      const next: UserProgress = {
        ...prog,
        grade,
        boardExamDate: examDate || null,
        planChapterIds: selected,
      };
      saveProgress(next);
      setP(next);
      const built = buildPlan(selected, grade, examDate || null);
      setPlan(built);
      setSaveMsg(
        `Plan ready · ${selected.length} chapters · ${built.length} days`
      );
      window.setTimeout(() => setSaveMsg(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-slate-500">
        Sign in to unlock your personal Board Blueprint.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
        <Target className="h-3.5 w-3.5" /> Study Plan
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Build your syllabus plan
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Select class + chapters that will come in your exam. SmartLearn builds a
        full day-by-day plan till board day.
      </p>

      {/* Exam date + grade */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Calendar className="h-4 w-4 text-indigo-500" />
          Board exam date
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={examDate}
            min={minDate}
            max={maxDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="min-w-[12rem] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
          />
          <select
            value={grade}
            onChange={(e) => {
              setGrade(e.target.value as Grade);
              setSelected([]);
              setPlan([]);
            }}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
          >
            <option value="10">Class 10</option>
            <option value="11">Class 11</option>
            <option value="12">Class 12</option>
          </select>
        </div>
        {examDate && (
          <p className="mt-2 text-xs text-slate-500">
            Selected: <strong>{formatLocalYmd(examDate)}</strong>
            {daysLeft != null && (
              <span className="ml-2 font-bold text-indigo-600">
                · {daysLeft > 0 ? `${daysLeft} days left` : "Exam day"}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Syllabus picker */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <BookOpen className="h-4 w-4 text-indigo-500" />
            Select your syllabus chapters
          </h2>
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
            {selected.length} selected
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Tick only chapters that are coming / you need to cover.
        </p>

        <div className="mt-4 space-y-5">
          {pack.subjects.map((s) => {
            const ids = s.chapters.map((c) => c.id);
            const allOn = ids.every((id) => selected.includes(id));
            return (
              <div key={s.id}>
                <button
                  type="button"
                  onClick={() => selectAllSubject(s.id)}
                  className="mb-2 flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-left text-sm font-bold text-slate-800 hover:bg-indigo-50"
                >
                  <span>
                    {s.icon} {s.name}
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-600">
                    {allOn ? "Unselect all" : "Select all"}
                  </span>
                </button>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {s.chapters.map((ch) => {
                    const on = selected.includes(ch.id);
                    return (
                      <li key={ch.id}>
                        <button
                          type="button"
                          onClick={() => toggle(ch.id)}
                          className={cn(
                            "flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs transition",
                            on
                              ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                              : "border-slate-100 bg-white text-slate-600 hover:border-slate-200"
                          )}
                        >
                          {on ? (
                            <CheckSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600" />
                          ) : (
                            <Square className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                          )}
                          <span>
                            <span className="font-semibold">Ch {ch.number}.</span>{" "}
                            {ch.title}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={saveAndBuild}
          disabled={saving}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-500 disabled:opacity-60 sm:w-auto sm:px-8"
        >
          {saveMsg?.startsWith("Plan") ? <Check className="h-4 w-4" /> : null}
          {saving ? "Building…" : "Save syllabus & generate full plan"}
        </button>
        {saveMsg && (
          <p className="mt-2 text-xs font-semibold text-emerald-700">{saveMsg}</p>
        )}
      </div>

      {/* Today */}
      <h2 className="mt-8 text-lg font-bold text-slate-900">
        <Sparkles className="mr-1 inline h-4 w-4 text-amber-500" />
        Today&apos;s missions
      </h2>
      <div className="mt-3 space-y-3">
        {todayMissions.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
          >
            <div className="text-[11px] font-bold text-indigo-600">
              MISSION {i + 1}
            </div>
            <div className="mt-1 font-bold text-slate-900">
              {item.subject} · {item.chapter.title}
            </div>
            <div className="mt-1 text-xs text-slate-500">{item.focus}</div>
          </Link>
        ))}
      </div>

      {/* Full plan calendar */}
      {plan.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-slate-900">
            Full plan ({plan.length} days)
          </h2>
          <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {plan.map((d) => (
              <div
                key={d.day}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-xs",
                  d.dateLabel === todayKey
                    ? "border-indigo-300 bg-indigo-50"
                    : "border-slate-100 bg-white"
                )}
              >
                <div className="font-bold text-slate-800">
                  Day {d.day} · {formatLocalYmd(d.dateLabel)}
                  {d.dateLabel === todayKey && (
                    <span className="ml-2 text-indigo-600">TODAY</span>
                  )}
                </div>
                <ul className="mt-1 space-y-0.5 text-slate-600">
                  {d.items.map((it, j) => (
                    <li key={j}>
                      <Link
                        href={`/ncert?q=${encodeURIComponent(it.chapter.title)}`}
                        className="hover:text-indigo-700 hover:underline"
                      >
                        {it.subject}: {it.chapter.title}
                      </Link>
                      <span className="text-slate-400"> — {it.focus}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

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
