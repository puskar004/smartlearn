"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  BookOpen,
  Calendar,
  CalendarDays,
  Check,
  Clock,
  LineChart,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { CURRICULUM, type Chapter, type Grade } from "@/lib/curriculum";
import {
  loadProgress,
  saveProgress,
  type UserProgress,
} from "@/lib/user-store";
import { daysUntilLocal, formatLocalYmd, toLocalYmd } from "@/lib/dates";
import { cn } from "@/lib/utils";

type PlanDay = {
  day: number;
  dateLabel: string;
  items: { subject: string; subjectId: string; chapter: Chapter; focus: string }[];
};

const SUBJECT_TABS: {
  id: string;
  label: string;
  match: (name: string, id: string) => boolean;
  icon: string;
}[] = [
  {
    id: "physics",
    label: "Physics",
    match: (n, id) => id === "physics" || n.includes("Physics"),
    icon: "⚛️",
  },
  {
    id: "chemistry",
    label: "Chemistry",
    match: (n, id) => id === "chemistry" || n.includes("Chemistry"),
    icon: "🧪",
  },
  {
    id: "maths",
    label: "Mathematics",
    match: (n, id) => id === "maths" || n.includes("Math"),
    icon: "∑",
  },
  {
    id: "biology",
    label: "Biology",
    match: (n, id) => id === "biology" || n.includes("Biology"),
    icon: "🌿",
  },
  {
    id: "english",
    label: "English",
    match: (n, id) => id === "english" || n.includes("English"),
    icon: "📘",
  },
  {
    id: "other",
    label: "Other",
    match: (n, id) =>
      !["physics", "chemistry", "maths", "biology", "english"].includes(id) &&
      !/physics|chemistry|math|biology|english/i.test(n),
    icon: "▦",
  },
];

function buildPlan(
  chapterIds: string[],
  grade: Grade,
  examDate: string | null
): PlanDay[] {
  const pack = CURRICULUM.find((g) => g.grade === grade)!;
  const selected: PlanDay["items"][number][] = [];
  for (const s of pack.subjects) {
    for (const ch of s.chapters) {
      if (chapterIds.includes(ch.id)) {
        selected.push({
          subject: s.name,
          subjectId: s.id,
          chapter: ch,
          focus: "NCERT + practice",
        });
      }
    }
  }
  if (!selected.length) return [];

  const daysLeftRaw =
    examDate && daysUntilLocal(examDate) != null
      ? daysUntilLocal(examDate)!
      : 30;
  const daysLeft = Math.max(7, daysLeftRaw);
  const planDays = Math.min(
    60,
    Math.max(7, Math.min(daysLeft, Math.ceil(selected.length * 1.5)))
  );
  const perDay = Math.max(1, Math.ceil(selected.length / planDays));

  const out: PlanDay[] = [];
  let idx = 0;
  const start = new Date();
  for (let d = 0; d < planDays && idx < selected.length; d++) {
    const date = new Date(start);
    date.setDate(date.getDate() + d);
    const items: PlanDay["items"] = [];
    for (let k = 0; k < perDay && idx < selected.length; k++) {
      const pick = selected[idx++];
      items.push({
        ...pick,
        focus:
          k % 3 === 0
            ? "NCERT read + notes"
            : k % 3 === 1
              ? "Board-style quiz"
              : "PYQ + revision",
      });
    }
    if (!items.length && selected.length) {
      const pick = selected[d % selected.length];
      items.push({ ...pick, focus: "Quick revision" });
    }
    out.push({ day: d + 1, dateLabel: toLocalYmd(date), items });
  }
  return out;
}

export default function BlueprintPage() {
  const { userId, isSignedIn } = useAuth();
  const [p, setP] = useState<UserProgress | null>(null);
  const [examDate, setExamDate] = useState("");
  const [grade, setGrade] = useState<Grade>("12");
  const [selected, setSelected] = useState<string[]>([]);
  const [doneChapters, setDoneChapters] = useState<string[]>([]);
  const [doneDays, setDoneDays] = useState<string[]>([]);
  const [subjectTab, setSubjectTab] = useState("physics");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanDay[]>([]);
  const [view, setView] = useState<"builder" | "plan">("builder");

  const pack = CURRICULUM.find((g) => g.grade === grade)!;

  useEffect(() => {
    if (!userId) return;
    const prog = loadProgress(userId);
    setP(prog);
    setGrade(prog.grade);
    setSelected(prog.planChapterIds || []);
    setDoneChapters(prog.planDoneChapterIds || []);
    setDoneDays(prog.planDoneDays || []);
    const raw = prog.boardExamDate || "";
    setExamDate(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "");
    if ((prog.planChapterIds || []).length) {
      const built = buildPlan(
        prog.planChapterIds,
        prog.grade,
        prog.boardExamDate
      );
      setPlan(built);
    }
    // default subject tab to first available
    const first = SUBJECT_TABS.find((t) =>
      prog.grade
        ? CURRICULUM.find((g) => g.grade === prog.grade)!.subjects.some((s) =>
            t.match(s.name, s.id)
          )
        : true
    );
    if (first) setSubjectTab(first.id);
  }, [userId]);

  const daysLeft = useMemo(() => {
    if (!examDate) return null;
    return daysUntilLocal(examDate);
  }, [examDate]);

  const subjectsForTab = useMemo(() => {
    const tab = SUBJECT_TABS.find((t) => t.id === subjectTab) || SUBJECT_TABS[0];
    return pack.subjects.filter((s) => tab.match(s.name, s.id));
  }, [pack, subjectTab]);

  const totalInTab = subjectsForTab.reduce(
    (n, s) => n + s.chapters.length,
    0
  );
  const selectedInGrade = selected.filter((id) =>
    pack.subjects.some((s) => s.chapters.some((c) => c.id === id))
  );

  /** Real progress metrics */
  const progress = useMemo(() => {
    if (!p) {
      return {
        selectedCount: 0,
        totalChapters: 0,
        openedCount: 0,
        quizDoneCount: 0,
        doneCount: 0,
        dayDoneCount: 0,
        planDays: 0,
        pct: 0,
        quizAvg: null as number | null,
      };
    }
    const sel = new Set(selected);
    const opened = p.chaptersOpened.filter((id) => sel.has(id)).length;
    const quizChapters = new Set(
      p.quizResults.filter((q) => sel.has(q.chapterId)).map((q) => q.chapterId)
    );
    const done = doneChapters.filter((id) => sel.has(id)).length;
    const dayDone = doneDays.filter((d) =>
      plan.some((pd) => pd.dateLabel === d)
    ).length;
    const quizOnSel = p.quizResults.filter((q) => sel.has(q.chapterId));
    const quizAvg =
      quizOnSel.length > 0
        ? Math.round(
            (quizOnSel.reduce((a, q) => a + q.score / Math.max(1, q.total), 0) /
              quizOnSel.length) *
              100
          )
        : null;
    const factors = [
      selected.length ? done / selected.length : 0,
      selected.length ? opened / selected.length : 0,
      selected.length ? quizChapters.size / selected.length : 0,
      plan.length ? dayDone / plan.length : 0,
    ];
    const pct = Math.round(
      (factors.reduce((a, b) => a + b, 0) / factors.length) * 100
    );
    return {
      selectedCount: selected.length,
      totalChapters: pack.subjects.reduce((n, s) => n + s.chapters.length, 0),
      openedCount: opened,
      quizDoneCount: quizChapters.size,
      doneCount: done,
      dayDoneCount: dayDone,
      planDays: plan.length,
      pct: Math.min(100, Math.max(0, pct)),
      quizAvg,
    };
  }, [p, selected, doneChapters, doneDays, plan, pack]);

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

  const selectAllInTab = () => {
    const ids = subjectsForTab.flatMap((s) => s.chapters.map((c) => c.id));
    const allOn = ids.every((id) => selected.includes(id));
    setSelected((prev) =>
      allOn
        ? prev.filter((id) => !ids.includes(id))
        : Array.from(new Set([...prev, ...ids]))
    );
  };

  const persist = (extra?: Partial<UserProgress>) => {
    if (!userId) return null;
    const prog = loadProgress(userId);
    const next: UserProgress = {
      ...prog,
      grade,
      boardExamDate: examDate || null,
      planChapterIds: selected,
      planDoneChapterIds: doneChapters,
      planDoneDays: doneDays,
      ...extra,
    };
    saveProgress(next);
    setP(next);
    return next;
  };

  const createPlan = () => {
    if (!userId) {
      setSaveMsg("Sign in first.");
      return;
    }
    if (selected.length === 0) {
      setSaveMsg("Select at least one chapter.");
      return;
    }
    const built = buildPlan(selected, grade, examDate || null);
    setPlan(built);
    persist({ planChapterIds: selected, grade, boardExamDate: examDate || null });
    setView("plan");
    setSaveMsg(
      `Plan ready · ${selected.length} chapters · ${built.length} days`
    );
    window.setTimeout(() => setSaveMsg(null), 3500);
  };

  const toggleChapterDone = (id: string) => {
    setDoneChapters((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      if (userId) {
        const prog = loadProgress(userId);
        saveProgress({ ...prog, planDoneChapterIds: next });
      }
      return next;
    });
  };

  const toggleDayDone = (dateLabel: string) => {
    setDoneDays((prev) => {
      const next = prev.includes(dateLabel)
        ? prev.filter((x) => x !== dateLabel)
        : [...prev, dateLabel];
      if (userId) {
        const prog = loadProgress(userId);
        saveProgress({ ...prog, planDoneDays: next });
      }
      return next;
    });
  };

  const todayKey = toLocalYmd(new Date());
  const todayPlan =
    plan.find((d) => d.dateLabel === todayKey) || plan[0] || null;

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-slate-500">
        Sign in to build your personal Study Plan.
      </div>
    );
  }

  const ring = progress.pct;
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (ring / 100) * c;

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[28px] border border-violet-100 bg-gradient-to-r from-[#f5f3ff] via-[#eef2ff] to-[#e0f2fe] p-6 shadow-sm sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-600">
          Study Plan
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Build your syllabus plan
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Select class + chapters that will come in your exam. SmartLearn
              builds a full day-by-day plan till board day.
            </p>
          </div>
          <div className="hidden text-right md:block">
            <p className="font-serif text-lg italic text-indigo-700/80">
              “A well planned day
              <br />
              is a step closer to your dream.”
            </p>
            <div className="ml-auto mt-3 flex h-20 w-28 items-end justify-center gap-1 rounded-2xl bg-white/80 p-2 shadow-sm">
              {["DISCIPLINE", "PRACTICE", "PROGRESS", "RESULTS"].map((t, i) => (
                <div
                  key={t}
                  className="flex w-5 flex-col justify-end rounded-sm text-[5px] font-black text-white"
                  style={{
                    height: `${40 + i * 8}px`,
                    background: ["#818cf8", "#a78bfa", "#34d399", "#f59e0b"][i],
                  }}
                >
                  <span className="rotate-180 p-0.5 [writing-mode:vertical-rl]">
                    {t}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Pill
            icon={<CalendarDays className="h-4 w-4 text-violet-600" />}
            title="Personalized Plan"
            sub="Based on your syllabus"
            tone="bg-violet-50"
          />
          <Pill
            icon={<Clock className="h-4 w-4 text-sky-600" />}
            title="Smart Scheduling"
            sub="Balanced & realistic"
            tone="bg-sky-50"
          />
          <Pill
            icon={<LineChart className="h-4 w-4 text-emerald-600" />}
            title="Track Your Progress"
            sub="Stay consistent"
            tone="bg-emerald-50"
          />
        </div>
      </div>

      {/* Exam row */}
      <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Calendar className="h-4 w-4 text-indigo-500" />
            Board exam date
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="date"
              value={examDate}
              min={minDate}
              max={maxDate}
              onChange={(e) => {
                setExamDate(e.target.value);
                if (userId) {
                  const prog = loadProgress(userId);
                  saveProgress({
                    ...prog,
                    boardExamDate: e.target.value || null,
                  });
                }
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
            />
            <select
              value={grade}
              onChange={(e) => {
                const g = e.target.value as Grade;
                setGrade(g);
                setSelected([]);
                setPlan([]);
                setSubjectTab("physics");
                if (userId) {
                  const prog = loadProgress(userId);
                  saveProgress({ ...prog, grade: g, planChapterIds: [] });
                }
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800"
            >
              <option value="10">Class 10</option>
              <option value="11">Class 11</option>
              <option value="12">Class 12</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 p-4 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-black text-violet-900">
              {daysLeft == null
                ? "Set exam date"
                : daysLeft > 0
                  ? `Only ${daysLeft} days left!`
                  : daysLeft === 0
                    ? "Exam is today!"
                    : "Exam date passed"}
            </div>
            <div className="text-xs text-violet-700/80">
              {examDate
                ? `Let’s make it count · ${formatLocalYmd(examDate)}`
                : "Pick your board date"}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs italic text-slate-500">
            “Discipline turns goals into reality.”
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setView("builder")}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-bold",
                view === "builder"
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              Builder
            </button>
            <button
              type="button"
              onClick={() => setView("plan")}
              disabled={!plan.length}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-bold disabled:opacity-40",
                view === "plan"
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-600"
              )}
            >
              View Plan
            </button>
          </div>
        </div>
      </div>

      {view === "builder" ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_280px]">
          {/* Chapter picker */}
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <BookOpen className="h-4 w-4 text-indigo-500" />
                  Select your syllabus chapters
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Tick only chapters that are coming / you need to cover.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700">
                  {selectedInGrade.length} selected
                </span>
                <button
                  type="button"
                  onClick={selectAllInTab}
                  className="text-[11px] font-bold text-violet-600 hover:underline"
                >
                  Select all
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {SUBJECT_TABS.map((t) => {
                const has = pack.subjects.some((s) => t.match(s.name, s.id));
                if (!has) return null;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSubjectTab(t.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition",
                      subjectTab === t.id
                        ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
                        : "bg-slate-50 text-slate-600 hover:bg-violet-50 hover:text-violet-800"
                    )}
                  >
                    <span>{t.icon}</span> {t.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {subjectsForTab.flatMap((s) =>
                s.chapters.map((ch) => {
                  const on = selected.includes(ch.id);
                  const done = doneChapters.includes(ch.id);
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => toggle(ch.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition",
                        on
                          ? "border-violet-300 bg-violet-50 text-violet-900"
                          : "border-slate-100 bg-white text-slate-600 hover:border-slate-200"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          on
                            ? "border-violet-600 bg-violet-600 text-white"
                            : "border-slate-300"
                        )}
                      >
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">Ch {ch.number}.</span>{" "}
                        {ch.title}
                      </span>
                      {done && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                          DONE
                        </span>
                      )}
                    </button>
                  );
                })
              )}
              {subjectsForTab.length === 0 && (
                <p className="text-xs text-slate-400 sm:col-span-2">
                  No chapters in this tab for Class {grade}.
                </p>
              )}
            </div>
          </div>

          {/* Progress card */}
          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <LineChart className="h-4 w-4 text-violet-600" /> Your Progress
                </h3>
                <button
                  type="button"
                  onClick={() => plan.length && setView("plan")}
                  className="text-[11px] font-bold text-violet-600 hover:underline"
                >
                  View Plan →
                </button>
              </div>

              <div className="mt-4 flex items-center gap-4">
                <div className="relative h-24 w-24 shrink-0">
                  <svg className="h-24 w-24 -rotate-90" viewBox="0 0 88 88">
                    <circle
                      cx="44"
                      cy="44"
                      r={r}
                      fill="none"
                      stroke="#ede9fe"
                      strokeWidth="8"
                    />
                    <circle
                      cx="44"
                      cy="44"
                      r={r}
                      fill="none"
                      stroke="#7c3aed"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${dash} ${c}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-black text-slate-900">
                      {progress.selectedCount}/
                      {Math.max(progress.selectedCount, totalInTab || progress.selectedCount)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    Chapters Selected
                  </div>
                  <div className="text-xs text-slate-500">
                    {progress.selectedCount === 0
                      ? "Pick chapters to begin"
                      : "You’re off to a great start!"}
                  </div>
                  <div className="mt-2 text-[11px] font-semibold text-violet-700">
                    Overall progress {progress.pct}%
                  </div>
                </div>
              </div>

              <ul className="mt-4 space-y-1.5 text-[11px] text-slate-600">
                <li className="flex justify-between">
                  <span>Opened in NCERT</span>
                  <strong>
                    {progress.openedCount}/{progress.selectedCount || 0}
                  </strong>
                </li>
                <li className="flex justify-between">
                  <span>Quiz attempted</span>
                  <strong>
                    {progress.quizDoneCount}/{progress.selectedCount || 0}
                  </strong>
                </li>
                <li className="flex justify-between">
                  <span>Marked done</span>
                  <strong>
                    {progress.doneCount}/{progress.selectedCount || 0}
                  </strong>
                </li>
                <li className="flex justify-between">
                  <span>Plan days done</span>
                  <strong>
                    {progress.dayDoneCount}/{progress.planDays || 0}
                  </strong>
                </li>
                <li className="flex justify-between">
                  <span>Quiz avg (selected)</span>
                  <strong>
                    {progress.quizAvg != null ? `${progress.quizAvg}%` : "—"}
                  </strong>
                </li>
              </ul>

              <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
                💡 Consistent progress today, success tomorrow.
              </div>

              <button
                type="button"
                onClick={createPlan}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500"
              >
                <Sparkles className="h-4 w-4" />
                Create My Study Plan →
              </button>
              <p className="mt-2 text-center text-[10px] text-slate-400">
                Get a personalized day-wise plan with revision, practice and
                tests.
              </p>
              {saveMsg && (
                <p className="mt-2 text-center text-xs font-semibold text-emerald-700">
                  {saveMsg}
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : (
        /* Plan view */
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              Your day-by-day plan ({plan.length} days)
            </h2>
            <button
              type="button"
              onClick={() => setView("builder")}
              className="text-xs font-bold text-violet-600 hover:underline"
            >
              ← Edit syllabus
            </button>
          </div>

          {todayPlan && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-violet-900">
                <Target className="h-4 w-4" /> Today’s missions
                <span className="text-xs font-semibold text-violet-600">
                  · {formatLocalYmd(todayPlan.dateLabel)}
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {todayPlan.items.map((it, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs shadow-sm"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {it.subject} · Ch {it.chapter.number}. {it.chapter.title}
                      </div>
                      <div className="text-slate-500">{it.focus}</div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/ncert?q=${encodeURIComponent(it.chapter.title)}`}
                        className="rounded-lg bg-indigo-50 px-2 py-1 font-bold text-indigo-700"
                      >
                        NCERT
                      </Link>
                      <Link
                        href={`/quiz/${it.chapter.id}`}
                        className="rounded-lg bg-amber-50 px-2 py-1 font-bold text-amber-800"
                      >
                        Quiz
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleChapterDone(it.chapter.id)}
                        className={cn(
                          "rounded-lg px-2 py-1 font-bold",
                          doneChapters.includes(it.chapter.id)
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {doneChapters.includes(it.chapter.id)
                          ? "Done ✓"
                          : "Mark done"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => toggleDayDone(todayPlan.dateLabel)}
                className="mt-3 text-xs font-bold text-violet-700 hover:underline"
              >
                {doneDays.includes(todayPlan.dateLabel)
                  ? "✓ Today marked complete"
                  : "Mark full day complete"}
              </button>
            </div>
          )}

          <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
            {plan.map((d) => {
              const isToday = d.dateLabel === todayKey;
              const complete = doneDays.includes(d.dateLabel);
              return (
                <div
                  key={d.day}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-xs",
                    isToday
                      ? "border-violet-300 bg-violet-50"
                      : complete
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-slate-100 bg-white"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-slate-800">
                      Day {d.day} · {formatLocalYmd(d.dateLabel)}
                      {isToday && (
                        <span className="ml-2 text-violet-600">TODAY</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleDayDone(d.dateLabel)}
                      className="text-[10px] font-bold text-slate-500 hover:text-violet-700"
                    >
                      {complete ? "Completed ✓" : "Complete day"}
                    </button>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-slate-600">
                    {d.items.map((it, j) => (
                      <li key={j} className="flex flex-wrap gap-2">
                        <Link
                          href={`/quiz/${it.chapter.id}`}
                          className="hover:text-violet-700 hover:underline"
                        >
                          {it.subject}: {it.chapter.title}
                        </Link>
                        <span className="text-slate-400">— {it.focus}</span>
                        {doneChapters.includes(it.chapter.id) && (
                          <span className="text-emerald-600">✓</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 text-xs text-slate-600 shadow-sm">
            <div className="font-bold text-slate-900">Progress snapshot</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <Stat label="Overall" value={`${progress.pct}%`} />
              <Stat
                label="Chapters done"
                value={`${progress.doneCount}/${progress.selectedCount}`}
              />
              <Stat
                label="Days done"
                value={`${progress.dayDoneCount}/${progress.planDays}`}
              />
              <Stat
                label="Quiz avg"
                value={
                  progress.quizAvg != null ? `${progress.quizAvg}%` : "—"
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({
  icon,
  title,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  tone: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-white/80 px-3 py-2.5 shadow-sm",
        tone
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
        {icon}
      </div>
      <div>
        <div className="text-xs font-bold text-slate-900">{title}</div>
        <div className="text-[10px] text-slate-500">{sub}</div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="text-sm font-black text-slate-900">{value}</div>
    </div>
  );
}
