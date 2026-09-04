"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { CURRICULUM, type Grade } from "@/lib/curriculum";

export default function QuizIndexPage() {
  const [grade, setGrade] = useState<Grade>("12");
  const pack = useMemo(() => CURRICULUM.find((g) => g.grade === grade)!, [grade]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
        <Trophy className="h-3.5 w-3.5" /> Rapid revision quizzes
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Chapter levels for board speed
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">
        Short, high-yield MCQs so you can revise a full chapter in minutes —
        definitions, traps, PYQ mindset, and presentation tips.
      </p>

      <div className="mt-6 flex gap-2">
        {(["10", "11", "12"] as Grade[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGrade(g)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${
              grade === g ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            Class {g}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-8">
        {pack.subjects.map((s) => (
          <section key={s.id}>
            <h2 className="text-lg font-bold text-slate-900">
              {s.icon} {s.name}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {s.chapters.map((ch) => (
                <Link
                  key={ch.id}
                  href={`/quiz/${ch.id}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-amber-300 hover:shadow-md"
                >
                  <div className="text-xs font-bold text-amber-600">
                    LEVEL {ch.number} · +20 XP
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-900">
                    {ch.title}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    10 rapid questions
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
