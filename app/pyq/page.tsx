"use client";

import { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileText, Download } from "lucide-react";
import { CURRICULUM, type Grade } from "@/lib/curriculum";
import { getPyqPapers } from "@/lib/pyq-catalog";
import PdfReaderModal from "@/components/PdfReaderModal";

function PyqInner() {
  const sp = useSearchParams();
  const [grade, setGrade] = useState<Grade>(
    (sp.get("grade") as Grade) || "12"
  );
  const pack = useMemo(
    () => CURRICULUM.find((g) => g.grade === grade)!,
    [grade]
  );
  const initialSubject = sp.get("subject") || pack.subjects[0]?.id;
  const [subjectId, setSubjectId] = useState(initialSubject);
  const subject =
    pack.subjects.find((s) => s.id === subjectId) || pack.subjects[0];

  const papers = useMemo(
    () => getPyqPapers(grade, subject.id, subject.name),
    [grade, subject.id, subject.name]
  );

  const [reader, setReader] = useState<{ title: string; link: string } | null>(
    null
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold text-slate-900">
        Previous Year Questions
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Last 10 years · PCM / PCB / all subjects · open PDF inside SmartLearn
        (sample papers + board archives).
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

      <div className="mt-8 space-y-3">
        {papers.map((p) => (
          <div
            key={p.year}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div>
              <h2 className="text-base font-bold text-slate-900">{p.label}</h2>
              <p className="text-xs text-slate-500">
                {p.pdfUrl
                  ? "PDF ready · open in-app"
                  : "Open CBSE archive · pair with Gemini solutions"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.pdfUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setReader({
                      title: p.label,
                      link: p.pdfUrl!,
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                >
                  <FileText className="h-3.5 w-3.5" /> Open PDF
                </button>
              )}
              <Link
                href={`/ai-tutor?q=${encodeURIComponent(
                  `Solve a typical CBSE ${p.year} Class ${grade} ${subject.name} board question step by step with marking scheme`
                )}`}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500"
              >
                Solve with Gemini
              </Link>
              {p.portalUrl && (
                <a
                  href={p.portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" /> CBSE archive
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
        <strong>Tip:</strong> Chapter-wise practice — open a chapter quiz after
        each paper year.
        <div className="mt-2 flex flex-wrap gap-2">
          {subject.chapters.slice(0, 8).map((ch) => (
            <Link
              key={ch.id}
              href={`/quiz/${ch.id}`}
              className="rounded-full bg-white px-2.5 py-1 font-semibold text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-50"
            >
              Ch {ch.number}
            </Link>
          ))}
        </div>
      </div>

      <PdfReaderModal
        open={Boolean(reader)}
        title={reader?.title || ""}
        ncertLink={reader?.link}
        onClose={() => setReader(null)}
      />
    </div>
  );
}

export default function PyqPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center text-sm text-slate-400">Loading…</div>
      }
    >
      <PyqInner />
    </Suspense>
  );
}
