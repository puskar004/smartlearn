"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  ClipboardList,
  Copy,
  FileUp,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Users,
  XCircle,
  Monitor,
} from "lucide-react";

type Mcq = {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

type Moment = {
  at: number;
  imageDataUrl?: string;
  imageKey?: string;
  audioKey?: string;
  audioDataUrl?: string;
  note?: string;
  videoKey?: string;
};

type TestRow = {
  id: string;
  code: string;
  title: string;
  durationMin: number;
  active: boolean;
  questions: Mcq[];
  submissions: Record<
    string,
    {
      name: string;
      score: number;
      total: number;
      at: number;
      moments?: Moment[];
      videoKeys?: string[];
    }
  >;
  endsAt: number;
};

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const parts: string[] = [];
  const max = Math.min(doc.numPages, 30);
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => ("str" in it ? String((it as { str: string }).str) : ""))
      .join(" ");
    parts.push(line);
  }
  return parts.join("\n");
}

export default function TeacherTestPage() {
  const { userId, isSignedIn } = useAuth();
  const [title, setTitle] = useState("Unit Test · Physics");
  const [durationMin, setDurationMin] = useState(30);
  const [rawText, setRawText] = useState("");
  const [questions, setQuestions] = useState<Mcq[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [momentsFor, setMomentsFor] = useState<{
    name: string;
    moments: Moment[];
    videoKeys: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tests?mine=1");
      const data = await res.json();
      if (data.tests) setTests(data.tests);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (userId) void load();
  }, [userId, load]);

  const onPdfFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const text = await extractPdfText(file);
      if (!text.trim()) {
        setError("No text found in PDF (scanned image?). Paste text manually.");
        return;
      }
      setRawText(text.slice(0, 30000));
      setMsg(`Extracted text from ${file.name} (${text.length} chars). Now Convert.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF read failed");
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/tests/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Convert failed");
      const qs = (data.questions || []) as Mcq[];
      if (!qs.length) throw new Error("No MCQs found — check format.");
      setQuestions(qs);
      setMsg(`Converted ${qs.length} MCQs (${data.source || "ok"})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const create = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      let qs = questions;
      // auto-convert if needed
      if (!qs.length && rawText.trim().length >= 15) {
        const resC = await fetch("/api/tests/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: rawText }),
        });
        const dataC = await resC.json();
        if (resC.ok && dataC.questions?.length) {
          qs = dataC.questions;
          setQuestions(qs);
        }
      }
      if (!qs.length) {
        throw new Error("Add MCQs first — Convert PDF/text, then Publish.");
      }
      const res = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title,
          durationMin,
          questions: qs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setMsg(`Test live · code ${data.test.code} — share with students`);
      setQuestions([]);
      setRawText("");
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const closeTest = async (code: string) => {
    await fetch("/api/tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", code }),
    });
    void load();
  };

  const deleteTest = async (code: string) => {
    if (
      !window.confirm(
        "Delete this test and all student moments/videos permanently?"
      )
    )
      return;
    await fetch("/api/tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", code }),
    });
    setMomentsFor(null);
    void load();
  };

  const copy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!isSignedIn) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Sign in as teacher.
      </div>
    );
  }

  const inputCls =
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
        <ClipboardList className="h-3.5 w-3.5" /> Teacher · Live Tests
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Create class test
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Upload PDF or paste text → <strong>Convert → MCQ</strong> →{" "}
        <strong>Publish</strong>. Students join at /test with the code.
      </p>

      <div className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder="e.g. Physics Unit 1 Test"
            />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Duration (minutes)
            <input
              type="number"
              min={5}
              max={180}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value) || 30)}
              className={inputCls}
            />
          </label>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">
              Question paper
            </span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
            >
              <FileUp className="h-3.5 w-3.5" /> Upload PDF (offline)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                void onPdfFile(e.target.files?.[0] || null);
                e.target.value = "";
              }}
            />
          </div>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={8}
            placeholder={`1. What is Ohm's law?\nA) V=IR\nB) V=I/R\nC) V=I+R\nD) V=R/I\nAnswer: A\n\n2. ...`}
            className={`${inputCls} font-mono text-xs leading-relaxed`}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || rawText.trim().length < 15}
            onClick={() => void convert()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Convert PDF text → MCQ
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void create()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Publish test + code
          </button>
        </div>

        {msg && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
            {msg}
          </p>
        )}
        {error && (
          <p className="whitespace-pre-wrap rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {error}
          </p>
        )}

        {questions.length > 0 && (
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
            <div className="text-xs font-bold text-violet-800">
              Preview · {questions.length} MCQs ready to publish
            </div>
            <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-[11px] text-slate-700">
              {questions.slice(0, 10).map((q, i) => (
                <li key={i}>
                  <strong>
                    Q{i + 1}. {q.prompt.slice(0, 100)}
                  </strong>
                  <div className="text-slate-500">
                    {q.options.map((o, j) => (
                      <span key={j} className="mr-2">
                        {String.fromCharCode(65 + j)}) {o.slice(0, 40)}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <h2 className="mt-10 text-lg font-bold text-slate-900">Your tests</h2>
      <ul className="mt-3 space-y-3">
        {tests.length === 0 && (
          <li className="text-sm text-slate-400">No tests yet.</li>
        )}
        {tests.map((t) => {
          const subs = Object.values(t.submissions || {});
          return (
            <li
              key={t.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900">{t.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono text-sm font-black text-indigo-700">
                      {t.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copy(t.code)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-0.5 font-semibold hover:bg-slate-50"
                    >
                      <Copy className="h-3 w-3" />
                      {copied === t.code ? "Copied" : "Copy code"}
                    </button>
                    <span>
                      {t.durationMin} min · {t.questions?.length || 0} Qs ·{" "}
                      {t.active ? "LIVE" : "closed"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {t.active && (
                    <button
                      type="button"
                      onClick={() => void closeTest(t.code)}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800"
                    >
                      <XCircle className="h-3 w-3" /> Close (stop joins)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void deleteTest(t.code)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700"
                  >
                    <Trash2 className="h-3 w-3" /> Delete forever
                  </button>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                Code stays valid until you Close or Delete.
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-600">
                <Users className="h-3.5 w-3.5" />
                Submissions ({subs.length})
              </div>
              {subs.length > 0 && (
                <ul className="mt-1 max-h-40 overflow-y-auto text-[11px] text-slate-600">
                  {Object.entries(t.submissions || {})
                    .map(([, s]) => s)
                    .sort((a, b) => b.score - a.score)
                    .map((s, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 py-1.5"
                      >
                        <span>
                          {s.name}{" "}
                          <strong>
                            {s.score}/{s.total}
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setMomentsFor({
                              name: s.name,
                              moments: s.moments || [],
                              videoKeys: s.videoKeys || [],
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100"
                        >
                          <Monitor className="h-3 w-3" /> See student screen (
                          {(s.moments || []).length} snaps ·{" "}
                          {(s.videoKeys || []).length} videos)
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {momentsFor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                See student screen · {momentsFor.name}
              </h3>
              <button
                type="button"
                onClick={() => setMomentsFor(null)}
                className="text-xs font-bold text-slate-500"
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              Photos + voice every 30s · screen video chunks · kept until you
              delete the test
            </p>

            {momentsFor.videoKeys.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-bold text-slate-800">
                  Screen recordings
                </div>
                {momentsFor.videoKeys.map((vk) => (
                  <video
                    key={vk}
                    controls
                    src={`/api/tests?video=${encodeURIComponent(vk)}`}
                    className="w-full rounded-lg bg-black"
                  />
                ))}
              </div>
            )}

            {momentsFor.moments.length === 0 &&
            momentsFor.videoKeys.length === 0 ? (
              <p className="mt-4 text-xs text-slate-400">
                No captures yet (student still starting or denied share).
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {momentsFor.moments
                  .filter(
                    (m) =>
                      m.imageDataUrl ||
                      m.audioDataUrl ||
                      m.imageKey ||
                      m.audioKey ||
                      (m.note && m.note !== "screen-video-chunk")
                  )
                  .map((m, i) => {
                    const imgSrc =
                      m.imageDataUrl ||
                      (m.imageKey
                        ? `/api/tests?media=${encodeURIComponent(m.imageKey)}`
                        : null);
                    const audioSrc =
                      m.audioDataUrl ||
                      (m.audioKey
                        ? `/api/tests?media=${encodeURIComponent(m.audioKey)}`
                        : null);
                    return (
                    <li
                      key={i}
                      className="rounded-xl border border-slate-100 p-2 text-xs"
                    >
                      <div className="text-[10px] text-slate-400">
                        {new Date(m.at).toLocaleString()}
                      </div>
                      {m.note && m.note !== "screen-video-chunk" && (
                        <div className="mt-1 text-amber-700">{m.note}</div>
                      )}
                      {imgSrc && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imgSrc}
                          alt="moment"
                          className="mt-2 max-h-48 w-full rounded-lg object-contain bg-slate-50"
                        />
                      )}
                      {audioSrc && (
                        <audio
                          controls
                          src={audioSrc}
                          className="mt-2 w-full"
                        />
                      )}
                    </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
