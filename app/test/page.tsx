"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
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
  const [proctorReady, setProctorReady] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
  } | null>(null);

  const inTest = Boolean(test && !result);

  useEffect(() => {
    if (inTest) {
      setSessionLock(true, "test");
      try {
        void document.documentElement.requestFullscreen?.();
      } catch {
        // ignore
      }
      return () => setSessionLock(false);
    }
    setSessionLock(false);
    setProctorReady(false);
  }, [inTest]);

  const submit = useCallback(
    async (auto = false, reason?: string) => {
      if (!test || submitting || result) return;
      setSubmitting(true);
      setError(reason || null);
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
        if (auto && !reason) setError("Time over — answers auto-submitted.");
        if (reason) setError(reason);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
        // still exit UI on proctor fail
        if (reason) {
          setResult({ score: 0, total: test.questions.length });
        }
      } finally {
        setSubmitting(false);
        setSessionLock(false);
      }
    },
    [test, submitting, result, answers]
  );

  const onProctorFail = useCallback(
    (reason: string) => {
      void submit(true, reason);
    },
    [submit]
  );

  const join = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!consent) {
      setError(
        "Allow camera (ON) + mic + THIS TAB screen share to start the test."
      );
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
  }, [test, result, submit]);

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
      {inTest && (
        <TestProctor
          active={inTest}
          testCode={test!.code}
          onProctorFail={onProctorFail}
          onReady={() => setProctorReady(true)}
        />
      )}

      <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
        <ClipboardList className="h-3.5 w-3.5" /> Live Class Test · proctored
      </div>
      <h1 className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl">
        Join teacher test
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Hi {displayName(user)}. Required: <strong>camera ON</strong>, mic, and
        share <strong>this SmartLearn tab</strong> (not another window). If you
        stop sharing → test exits.
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
              I will keep <strong>camera shutter ON</strong>, allow mic, and
              share <strong>only this test tab</strong>. Stopping share or turning
              camera off ends my test automatically.
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
        <p className="mt-3 whitespace-pre-wrap text-xs font-semibold text-rose-600">
          {error}
        </p>
      )}

      {test && !result && (
        <div className="mt-6">
          {!proctorReady && (
            <p className="mb-3 rounded-xl bg-slate-900 px-3 py-2 text-xs text-amber-200">
              Waiting for camera + mic + <strong>This tab</strong> share… In the
              browser picker choose <em>Chrome Tab / This tab</em> → this
              SmartLearn page (not another app window).
            </p>
          )}
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

          <ol
            className={`mt-6 space-y-5 ${!proctorReady ? "pointer-events-none opacity-40" : ""}`}
          >
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
                        disabled={!proctorReady}
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
            disabled={submitting || !proctorReady}
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
            Test ended
          </p>
          <p className="mt-2 text-4xl font-black text-slate-900">
            {result.score}/{result.total}
          </p>
          {error && (
            <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>
          )}
          <button
            type="button"
            onClick={() => {
              setTest(null);
              setResult(null);
              setCode("");
              setConsent(false);
              setError(null);
            }}
            className="mt-4 text-xs font-bold text-indigo-700 underline"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
