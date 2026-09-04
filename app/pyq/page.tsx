"use client";

import { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CURRICULUM, type Grade } from "@/lib/curriculum";

function PyqInner() {
  const sp = useSearchParams();
  const [grade, setGrade] = useState<Grade>(
    (sp.get("grade") as Grade) || "12"
  );
  const pack = useMemo(() => CURRICULUM.find((g) => g.grade === grade)!, [grade]);
  const initialSubject = sp.get("subject") || pack.subjects[0]?.id;
  const [subjectId, setSubjectId] = useState(initialSubject);
  const subject =
    pack.subjects.find((s) => s.id === subjectId) || pack.subjects[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold text-slate-900">
        Previous Year Questions
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Year-wise PYQ practice lanes mapped to every subject. Pair with chapter
        quizzes for rapid revision.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(["10", "11", "12"] as Grade[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => {
              setGrade(g);
              setSubjectId(
                CURRICULUM.find((x) => x.grade === g)!.subjects[0].id
              );
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              grade === g
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            Class {g}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {pack.subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSubjectId(s.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              subject.id === s.id
                ? "bg-violet-100 text-violet-800"
                : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {s.icon} {s.name}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        {subject.pyqYears
          .slice()
          .reverse()
          .map((year) => (
            <div
              key={year}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {subject.name} · CBSE {year}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Full paper practice · chapter tags from NCERT list
                  </p>
                </div>
                <Link
                  href={`/ai-tutor?q=${encodeURIComponent(
                    `Solve a typical CBSE ${year} ${subject.name} board question from class ${grade} step by step`
                  )}`}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500"
                >
                  Solve with Gemini
                </Link>
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {subject.chapters.slice(0, 6).map((ch) => (
                  <li
                    key={ch.id}
                    className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  >
                    <span className="font-semibold text-slate-500">
                      {year} set ·
                    </span>{" "}
                    Focus: Ch {ch.number} {ch.title}
                    <div className="mt-1">
                      <Link
                        href={`/quiz/${ch.id}`}
                        className="text-xs font-semibold text-amber-700 hover:underline"
                      >
                        Rapid quiz →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </div>
  );
}

export default function PyqPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm text-slate-500">Loading PYQs…</div>}>
      <PyqInner />
    </Suspense>
  );
}
