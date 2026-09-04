"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, ExternalLink, FileText } from "lucide-react";
import { CURRICULUM, type Grade } from "@/lib/curriculum";

export default function NcertPage() {
  const [grade, setGrade] = useState<Grade>("12");
  const pack = useMemo(() => CURRICULUM.find((g) => g.grade === grade)!, [grade]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
            NCERT &amp; Chapters
          </p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">
            Complete CBSE bookshelf
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Class 10–12 subjects, every listed chapter, NCERT entry points, and
            topic maps for rapid study.
          </p>
        </div>
        <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
          {(["10", "11", "12"] as Grade[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrade(g)}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                grade === g
                  ? "bg-white text-indigo-700 shadow"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Class {g}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {pack.subjects.map((subject) => (
          <div
            key={subject.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{subject.icon}</span>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {subject.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {subject.chapters.length} chapters · PYQs{" "}
                    {subject.pyqYears[0]}–{subject.pyqYears.at(-1)}
                  </p>
                </div>
              </div>
              <Link
                href={`/pyq?grade=${grade}&subject=${subject.id}`}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Open PYQs
              </Link>
            </div>

            <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
              {subject.chapters.map((ch) => (
                <li
                  key={ch.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      Ch {ch.number}. {ch.title}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {ch.topics.slice(0, 3).join(" · ")}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {ch.ncertPdf && (
                      <a
                        href={ch.ncertPdf}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline"
                      >
                        <FileText className="h-3 w-3" /> NCERT
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <Link
                      href={`/quiz/${ch.id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline"
                    >
                      <BookOpen className="h-3 w-3" /> Quiz
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
