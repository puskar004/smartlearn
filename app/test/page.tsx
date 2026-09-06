"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  ClipboardList,
  Loader2,
  LogIn,
  Shield,
  Timer,
  Trophy,
} from "lucide-react";
import { displayName } from "@/lib/display-name";
import { setSessionLock } from "@/components/SessionLock";
import TestProctor from "@/components/TestProctor";
import { getRole } from "@/lib/teacher-store";

type Q = {
  id: string;
  prompt: string;
  options: string[];
};

type TestMeta = {
  code: string;
  title: string;
  durationMin: number;
  endsAt: number;
  active: boolean;
  questions: Q[];
  teacherName: string;
};

export default function StudentTestPage() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const [code, setCode] = useState("");
  const [test, setTest] = useState<TestMeta | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [left, setLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
  } | null>(null);

  const inTest = Boolean(test && !result);

  useEffect(() => {
    if (inTest) {
      setSessionLock(true, "test");
      return () => setSessionLock(false);
    }
    setSessionLock(false);
  }, [inTest]);

  const join = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!consent) {
      setError("Allow proctoring (screen + mic every 1 min) to start the test.");
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tests?code=${encodeURIComponent(code.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not found");
      const t = data.test as TestMeta;
      if (!t.active) throw new Error("This test is closed");
      setTest(t);
      setAnswers(t.questions.map(() => -1));
      setLeft(Math.max(0, Math.floor((t.endsAt - Date.now()) / 1000)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setTest(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!test || result) return;
    const id = setInterval(() => {
      const s = Math.max(0, Math.floor((test.endsAt - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) void submit(true);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test, result]);

  const submit = async (auto = false) => {
    if (!test || submitting || result) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          code: test.code,
          answers: answers.map((a) => (a < 0 ? -1 : a)),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
      setResult({ score: data.result.score, total: data.result.total });
      if (auto) setError("Time over — answers auto-submitted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-slate-500">
        <Link href="/login" className="font-bold text-indigo-600 underline">
          Sign in
        </Link>{" "}
        as student to join a live test.
      </div>
    );
  }

  if (userId && getRole(userId) === "teacher") {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Teachers manage tests at{" "}
        <Link href="/teacher/test" className="font-bold text-indigo-600">
          Live Tests
        </Link>
      </div>
    );
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="mx-auto max-w-2xl px-3 py-6 sm:px-6 sm:py-10">
      <TestProctor active={inTest} testCode={test?.code || ""} />

      <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
        <ClipboardList className="h-3.5 w-3.5" /> Live Class Test · proctored
      </div>
      <h1 className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl">
        Join teacher test
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Hi {displayName(user)}. During the test: screen lock + every 1 min
        screenshot &amp; short voice clip go to your teacher.
      </p>

      {!test && (
        <form
          onSubmit={(e) => void join(e)}
          className="mt-8 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="TEST CODE e.g. T7K2P9"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm font-bold tracking-widest text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400"
            required
          />
          <label className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I allow SmartLearn to capture <strong>screen snapshots</strong> and{" "}
              <strong>short microphone clips</strong> every 1 minute for my
              teacher during this test only.
            </span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            Start locked test
          </button>
        </form>
      )}

      {error && (
        <p className="mt-3 text-xs font-semibold text-rose-600">{error}</p>
      )}

      {test && !result && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-indigo-900">
                {test.title}
              </div>
              <div className="text-[11px] text-indigo-700">
                by {test.teacherName} · code {test.code}
              </div>
              <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700">
                <Shield className="h-3 w-3" /> Proctoring every 1 min
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-mono text-sm font-black text-rose-600 shadow-sm">
              <Timer className="h-4 w-4" />
              {mm}:{ss}
            </div>
          </div>

          <ol className="mt-6 space-y-5">
            {test.questions.map((q, qi) => (
              <li
                key={q.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="text-sm font-bold text-slate-900">
                  Q{qi + 1}. {q.prompt}
                </div>
                <div className="mt-3 space-y-2">
                  {q.options.map((opt, oi) => (
                    <label
                      key={oi}
                      className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                        answers[qi] === oi
                          ? "border-indigo-400 bg-indigo-50 text-indigo-900"
                          : "border-slate-100 hover:border-slate-200"
                      }`}
                    >
                      <input
                        type="radio"
                        className="mt-1"
                        name={`q-${qi}`}
                        checked={answers[qi] === oi}
                        onChange={() =>
                          setAnswers((a) => {
                            const n = [...a];
                            n[qi] = oi;
                            return n;
                          })
                        }
                      />
                      <span>
                        <strong className="mr-1">
                          {String.fromCharCode(65 + oi)}.
                        </strong>
                        {opt}
                      </span>
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit(false)}
            className="mt-6 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit test"}
          </button>
        </div>
      )}

      {result && (
        <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <Trophy className="mx-auto h-10 w-10 text-amber-500" />
          <p className="mt-3 text-sm font-semibold text-emerald-800">
            Submitted
          </p>
          <p className="mt-2 text-4xl font-black text-slate-900">
            {result.score}/{result.total}
          </p>
          <button
            type="button"
            onClick={() => {
              setTest(null);
              setResult(null);
              setCode("");
              setConsent(false);
            }}
            className="mt-4 text-xs font-bold text-indigo-700 underline"
          >
            Join another test
          </button>
        </div>
      )}
    </div>
  );
}
