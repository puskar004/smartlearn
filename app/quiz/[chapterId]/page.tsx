"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Check, X } from "lucide-react";
import { allChapters } from "@/lib/curriculum";
import { getQuizByChapterId } from "@/lib/quiz-engine";
import { recordQuiz } from "@/lib/user-store";
import { bumpTask } from "@/lib/tasks";

export default function ChapterQuizPage() {
  const params = useParams();
  const { userId } = useAuth();
  const chapterId = String(params.chapterId || "");
  const chapter = useMemo(
    () => allChapters().find((c) => c.id === chapterId),
    [chapterId]
  );
  const questions = useMemo(() => {
    const n = chapterId === "12-maths-ch1" ? 25 : 10;
    return getQuizByChapterId(chapterId, n) || [];
  }, [chapterId]);

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [misses, setMisses] = useState<
    {
      prompt: string;
      yourAnswer: string;
      correctAnswer: string;
      explanation: string;
    }[]
  >([]);
  const [saved, setSaved] = useState(false);

  if (!chapter || questions.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-600">Quiz not found.</p>
        <Link href="/quiz" className="mt-4 inline-block text-indigo-600">
          Back to quizzes
        </Link>
      </div>
    );
  }

  const q = questions[idx];

  const choose = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    if (i === q.correctIndex) {
      setScore((s) => s + 1);
    } else {
      setMisses((m) => [
        ...m,
        {
          prompt: q.prompt,
          yourAnswer: q.options[i],
          correctAnswer: q.options[q.correctIndex],
          explanation: q.explanation,
        },
      ]);
    }
  };

  const nextAndMaybeSave = () => {
    if (idx + 1 >= questions.length) {
      if (userId && !saved) {
        const finalScore = score;
        recordQuiz(
          userId,
          {
            chapterId,
            score: finalScore,
            total: questions.length,
            at: Date.now(),
          },
          misses.map((m) => ({
            chapterId,
            chapterTitle: chapter.title,
            subjectName: chapter.subjectName,
            grade: chapter.grade,
            ...m,
          }))
        );
        bumpTask(userId, "daily-quiz", 1);
        bumpTask(userId, "weekly-pyq", Math.max(1, finalScore));
        setSaved(true);
      }
      setDone(true);
      return;
    }
    setIdx((v) => v + 1);
    setSelected(null);
  };

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Rapid revision complete
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {chapter.subjectName} · {chapter.title}
          </p>
          <p className="mt-6 text-5xl font-black text-indigo-600">{pct}%</p>
          <p className="mt-2 text-sm text-slate-600">
            {score} / {questions.length} correct · +{score * 2} XP
            {userId ? " · saved to your profile" : " · sign in to save"}
          </p>
          {misses.length > 0 && (
            <p className="mt-2 text-xs text-rose-600">
              {misses.length} mistake{misses.length > 1 ? "s" : ""} added to your
              Mistake Vault
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setIdx(0);
                setSelected(null);
                setScore(0);
                setMisses([]);
                setDone(false);
                setSaved(false);
              }}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white"
            >
              Retry
            </button>
            <Link
              href="/mistakes"
              className="rounded-xl bg-rose-100 px-4 py-2 text-sm font-bold text-rose-800"
            >
              Mistake Vault
            </Link>
            <Link
              href="/quiz"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
            >
              More chapters
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="text-xs font-bold uppercase tracking-wide text-amber-600">
        Class {chapter.grade} · {chapter.subjectName} · Q {idx + 1}/
        {questions.length}
      </div>
      <h1 className="mt-1 text-xl font-extrabold text-slate-900">
        {chapter.title}
      </h1>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-amber-500 transition-all"
          style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-base font-semibold text-slate-900">{q.prompt}</p>
        <div className="mt-4 space-y-2">
          {q.options.map((opt, i) => {
            let cls =
              "border-slate-200 hover:border-indigo-300 bg-white text-slate-800";
            if (selected !== null) {
              if (i === q.correctIndex)
                cls = "border-emerald-500 bg-emerald-50 text-emerald-900";
              else if (i === selected)
                cls = "border-rose-400 bg-rose-50 text-rose-900";
              else cls = "border-slate-100 bg-slate-50 text-slate-400";
            }
            return (
              <button
                key={i}
                type="button"
                disabled={selected !== null}
                onClick={() => choose(i)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${cls}`}
              >
                <span>
                  <span className="mr-2 text-slate-400">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {opt}
                </span>
                {selected !== null && i === q.correctIndex && (
                  <Check className="h-4 w-4 text-emerald-600" />
                )}
                {selected !== null &&
                  i === selected &&
                  i !== q.correctIndex && (
                    <X className="h-4 w-4 text-rose-500" />
                  )}
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
            <strong className="text-slate-800">Insight: </strong>
            {q.explanation}
            <div className="mt-3">
              <button
                type="button"
                onClick={nextAndMaybeSave}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
              >
                {idx + 1 >= questions.length ? "See score" : "Next question"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
