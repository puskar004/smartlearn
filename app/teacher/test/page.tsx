"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  ClipboardList,
  Copy,
  Loader2,
  Plus,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";

type Mcq = {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
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
    { name: string; score: number; total: number; at: number }
  >;
  endsAt: number;
};

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

  const load = useCallback(async () => {
    const res = await fetch("/api/tests?mine=1");
    const data = await res.json();
    if (data.tests) setTests(data.tests);
  }, []);

  useEffect(() => {
    if (userId) void load();
  }, [userId, load]);

  const convert = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tests/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Convert failed");
      setQuestions(data.questions || []);
      setMsg(
        `Converted ${data.questions?.length || 0} MCQs (${data.source || "ai"})`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title,
          durationMin,
          questions,
          rawText: questions.length ? undefined : rawText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setMsg(`Test live · code ${data.test.code}`);
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
        <ClipboardList className="h-3.5 w-3.5" /> Teacher · Live Tests
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Create class test
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Paste question paper text (copy from PDF) → convert to MCQ → share code
        with students. Students join at <strong>/test</strong>.
      </p>

      <form
        onSubmit={(e) => void create(e)}
        className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Duration (minutes)
            <input
              type="number"
              min={5}
              max={180}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value) || 30)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block text-xs font-semibold text-slate-600">
          Paste questions from PDF (or typed paper)
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={8}
            placeholder={`1. What is Ohm's law?\nA) V=IR\nB) V=I/R\nC) V=I+R\nD) V=R/I\nAnswer: A\n\n2. ...`}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || rawText.length < 20}
            onClick={() => void convert()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Convert PDF text → MCQ
          </button>
          <button
            type="submit"
            disabled={busy || (questions.length === 0 && rawText.length < 20)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Publish test + code
          </button>
        </div>

        {msg && (
          <p className="text-xs font-semibold text-emerald-700">{msg}</p>
        )}
        {error && (
          <p className="text-xs font-semibold text-rose-600">{error}</p>
        )}

        {questions.length > 0 && (
          <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3">
            <div className="text-xs font-bold text-violet-800">
              Preview · {questions.length} MCQs
            </div>
            <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-[11px] text-slate-700">
              {questions.slice(0, 8).map((q, i) => (
                <li key={i}>
                  <strong>
                    Q{i + 1}. {q.prompt.slice(0, 80)}
                  </strong>
                  <div className="text-slate-500">
                    {q.options.map((o, j) => (
                      <span key={j} className="mr-2">
                        {String.fromCharCode(65 + j)}) {o.slice(0, 30)}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>

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
                {t.active && (
                  <button
                    type="button"
                    onClick={() => void closeTest(t.code)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700"
                  >
                    <XCircle className="h-3 w-3" /> Close
                  </button>
                )}
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-600">
                <Users className="h-3.5 w-3.5" />
                Submissions ({subs.length})
              </div>
              {subs.length > 0 && (
                <ul className="mt-1 max-h-32 overflow-y-auto text-[11px] text-slate-600">
                  {subs
                    .sort((a, b) => b.score - a.score)
                    .map((s, i) => (
                      <li key={i} className="flex justify-between border-b border-slate-50 py-1">
                        <span>{s.name}</span>
                        <span className="font-bold">
                          {s.score}/{s.total}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
