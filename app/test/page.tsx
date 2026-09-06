"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eraser,
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
import { cn } from "@/lib/utils";

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

/** JEE-style status per question */
type QStatus = "not_visited" | "not_answered" | "answered" | "marked" | "answered_marked";

export default function StudentTestPage() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const [code, setCode] = useState("");
  const [test, setTest] = useState<TestMeta | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [visited, setVisited] = useState<boolean[]>([]);
  const [marked, setMarked] = useState<boolean[]>([]);
  const [qi, setQi] = useState(0);
  const [left, setLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [proctorReady, setProctorReady] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    score: number;
    total: number;
  } | null>(null);

  const inTest = Boolean(test && !result);
  const n = test?.questions.length || 0;

  const statusOf = useCallback(
    (i: number): QStatus => {
      const ans = answers[i] >= 0;
      const vis = visited[i];
      const mk = marked[i];
      if (ans && mk) return "answered_marked";
      if (ans) return "answered";
      if (mk) return "marked";
      if (vis) return "not_answered";
      return "not_visited";
    },
    [answers, visited, marked]
  );

  const counts = useMemo(() => {
    const c = {
      answered: 0,
      not_answered: 0,
      not_visited: 0,
      marked: 0,
      answered_marked: 0,
    };
    for (let i = 0; i < n; i++) c[statusOf(i)]++;
    return c;
  }, [n, statusOf]);

  useEffect(() => {
    if (inTest) {
      setSessionLock(true, "test");
      return () => setSessionLock(false);
    }
    setSessionLock(false);
    setProctorReady(false);
    setSetupError(null);
  }, [inTest]);

  // Start exam clock only after proctor is ready (permissions don't burn timer)
  useEffect(() => {
    if (!proctorReady || !test || result) return;
    const secs = Math.max(60, test.durationMin * 60);
    setLeft(secs);
    // try fullscreen after permissions so dialogs aren't blocked
    const t = window.setTimeout(() => {
      try {
        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen?.();
        }
      } catch {
        // ignore — some browsers block FS with screen share
      }
    }, 500);
    return () => window.clearTimeout(t);
  }, [proctorReady, test, result]);

  const goTo = (i: number) => {
    if (!test) return;
    setVisited((v) => {
      const n2 = [...v];
      n2[qi] = true;
      n2[i] = true;
      return n2;
    });
    setQi(i);
  };

  const submit = useCallback(
    async (auto = false, reason?: string) => {
      if (!test || result) return;
      if (submitting) return;
      setSubmitting(true);
      setError(reason || null);
      try {
        const payload = {
          action: "submit" as const,
          code: test.code,
          answers: answers.map((a) => (a < 0 ? -1 : a)),
        };
        const res = await fetch("/api/tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            (data && data.error) || `Submit failed (${res.status})`
          );
        }
        setResult({
          score: Number(data.result?.score ?? 0),
          total: Number(data.result?.total ?? test.questions.length),
        });
        if (auto && !reason) setError("Time over — answers auto-submitted.");
        if (reason) setError(reason);
        try {
          if (document.fullscreenElement) void document.exitFullscreen();
        } catch {
          // ignore
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Submit failed";
        setError(msg);
        // Proctor fail still ends UI
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

  const requestSubmit = useCallback(() => {
    if (!test || !proctorReady || submitting) return;
    const incomplete =
      counts.not_answered + counts.not_visited + counts.marked;
    if (incomplete > 0) {
      const ok = window.confirm(
        `${incomplete} question(s) still incomplete. Submit anyway?`
      );
      if (!ok) return;
    }
    void submit(false);
  }, [test, proctorReady, submitting, counts, submit]);

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
      const len = t.questions.length;
      setTest(t);
      setAnswers(Array(len).fill(-1));
      setVisited(Array(len).fill(false).map((_, i) => i === 0));
      setMarked(Array(len).fill(false));
      setQi(0);
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
  const q = test?.questions[qi];

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      {inTest && (
        <TestProctor
          active={inTest}
          testCode={test!.code}
          onProctorFail={onProctorFail}
          onSetupError={(msg) => {
            setProctorReady(false);
            setSetupError(msg);
          }}
          onReady={() => {
            setProctorReady(true);
            setSetupError(null);
            setError(null);
          }}
        />
      )}

      {!test && (
        <>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
            <ClipboardList className="h-3.5 w-3.5" /> Live Test · JEE-style
          </div>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Join teacher test
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Hi {displayName(user)}. Palette:{" "}
            <span className="font-semibold text-emerald-600">Green = answered</span>
            , grey = not visited, red = not answered, purple = marked for review.
          </p>

          <form
            onSubmit={(e) => void join(e)}
            className="mt-8 max-w-xl space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
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
                Camera ON + mic + <strong>this tab</strong> share required.
                Stopping share exits the test.
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
        </>
      )}

      {error && !result && (
        <p className="mt-3 whitespace-pre-wrap text-xs font-semibold text-rose-600">
          {error}
        </p>
      )}

      {/* ===== JEE-style exam UI ===== */}
      {test && !result && q && (
        <div className="mt-2">
          {!proctorReady && (
            <p className="mb-3 rounded-xl bg-slate-900 px-3 py-2 text-xs text-amber-200">
              {setupError || (
                <>
                  Allow <strong>camera + mic</strong>, then share{" "}
                  <strong>This tab / Chrome Tab</strong> → this SmartLearn page.
                  Setup mistakes will <em>not</em> auto-submit — use Retry.
                </>
              )}
            </p>
          )}

          {/* Top bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border border-slate-200 bg-[#1e3a5f] px-4 py-3 text-white">
            <div>
              <div className="text-sm font-bold">{test.title}</div>
              <div className="text-[11px] text-sky-200">
                {test.teacherName} · {test.code} · Q {qi + 1}/{n}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 font-mono text-sm font-black shadow">
                <Timer className="h-4 w-4" />
                {mm}:{ss}
              </div>
              <span className="hidden items-center gap-1 text-[10px] font-bold uppercase text-amber-200 sm:inline-flex">
                <Shield className="h-3 w-3" /> Proctored
              </span>
            </div>
          </div>

          <div
            className={cn(
              "grid gap-0 border border-t-0 border-slate-200 bg-slate-50 lg:grid-cols-[1fr_280px]",
              !proctorReady && "pointer-events-none opacity-50"
            )}
          >
            {/* Question panel */}
            <div className="border-b border-slate-200 bg-white p-4 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded bg-[#1e3a5f] px-2.5 py-1 text-xs font-bold text-white">
                  Q. {qi + 1}
                </span>
                <StatusBadge status={statusOf(qi)} />
              </div>
              <p className="text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
                {q.prompt}
              </p>

              <div className="mt-5 space-y-2.5">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={!proctorReady}
                      onClick={() => {
                        setAnswers((a) => {
                          const n2 = [...a];
                          n2[qi] = oi;
                          return n2;
                        });
                        setVisited((v) => {
                          const n2 = [...v];
                          n2[qi] = true;
                          return n2;
                        });
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border-2 px-3 py-3 text-left text-sm transition",
                        selected
                          ? "border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm"
                          : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black",
                          selected
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span className="pt-0.5 font-medium">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Action bar — JEE style */}
              <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={!proctorReady}
                  onClick={() => {
                    setAnswers((a) => {
                      const n2 = [...a];
                      n2[qi] = -1;
                      return n2;
                    });
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  <Eraser className="h-3.5 w-3.5" /> Clear
                </button>
                <button
                  type="button"
                  disabled={!proctorReady}
                  onClick={() => {
                    setMarked((m) => {
                      const n2 = [...m];
                      n2[qi] = !n2[qi];
                      return n2;
                    });
                    setVisited((v) => {
                      const n2 = [...v];
                      n2[qi] = true;
                      return n2;
                    });
                    if (qi < n - 1) goTo(qi + 1);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500"
                >
                  <Bookmark className="h-3.5 w-3.5" /> Mark for review &amp; next
                </button>
                <button
                  type="button"
                  disabled={!proctorReady || qi <= 0}
                  onClick={() => goTo(qi - 1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Back
                </button>
                {qi < n - 1 ? (
                  <button
                    type="button"
                    disabled={!proctorReady}
                    onClick={() => {
                      setVisited((v) => {
                        const n2 = [...v];
                        n2[qi] = true;
                        return n2;
                      });
                      goTo(qi + 1);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500"
                  >
                    Save &amp; Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!proctorReady || submitting}
                    onClick={() => requestSubmit()}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {submitting ? "Submitting…" : "Save & Submit test"}
                  </button>
                )}
              </div>

              {/* Always-visible submit on last Q + sticky bar */}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={!proctorReady || submitting}
                  onClick={() => requestSubmit()}
                  className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 disabled:opacity-50"
                >
                  {submitting
                    ? "Submitting…"
                    : qi >= n - 1
                      ? "Submit test (last question)"
                      : `Submit test (${counts.answered + counts.answered_marked}/${n} answered)`}
                </button>
              </div>
            </div>

            {/* Palette — JEE right panel */}
            <aside className="bg-[#f0f4f8] p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-600">
                Question palette
              </div>

              <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-5">
                {test.questions.map((_, i) => {
                  const st = statusOf(i);
                  const current = i === qi;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!proctorReady}
                      onClick={() => goTo(i)}
                      className={cn(
                        "flex h-9 w-full items-center justify-center rounded-lg text-xs font-black shadow-sm transition",
                        paletteClass(st),
                        current && "ring-2 ring-offset-1 ring-[#1e3a5f]"
                      )}
                      title={`Q${i + 1} · ${st.replace(/_/g, " ")}`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 space-y-1.5 rounded-xl border border-slate-200 bg-white p-3 text-[10px] font-semibold text-slate-600">
                <Legend swatch="bg-emerald-500" label={`Answered (${counts.answered})`} />
                <Legend
                  swatch="bg-rose-500"
                  label={`Not answered (${counts.not_answered})`}
                />
                <Legend
                  swatch="bg-slate-300"
                  label={`Not visited (${counts.not_visited})`}
                />
                <Legend
                  swatch="bg-violet-500"
                  label={`Marked for review (${counts.marked})`}
                />
                <Legend
                  swatch="bg-violet-500 ring-2 ring-emerald-400"
                  label={`Answered & marked (${counts.answered_marked})`}
                />
              </div>

              <div className="mt-3 rounded-xl bg-white p-3 text-[11px] text-slate-600">
                <div className="flex justify-between">
                  <span>Total</span>
                  <strong>{n}</strong>
                </div>
                <div className="mt-1 flex justify-between text-emerald-700">
                  <span>Answered</span>
                  <strong>
                    {counts.answered + counts.answered_marked}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                disabled={submitting || !proctorReady}
                onClick={() => requestSubmit()}
                className="mt-4 w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-black text-white shadow hover:bg-emerald-500 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit test"}
              </button>
            </aside>
          </div>

          {/* Mobile sticky submit */}
          <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:hidden">
            <button
              type="button"
              disabled={submitting || !proctorReady}
              onClick={() => requestSubmit()}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit test"}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="mx-auto mt-8 max-w-md rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
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

function paletteClass(st: QStatus) {
  switch (st) {
    case "answered":
      return "bg-emerald-500 text-white hover:bg-emerald-600";
    case "not_answered":
      return "bg-rose-500 text-white hover:bg-rose-600";
    case "marked":
      return "bg-violet-500 text-white hover:bg-violet-600";
    case "answered_marked":
      return "bg-violet-500 text-white ring-2 ring-inset ring-emerald-300 hover:bg-violet-600";
    default:
      return "bg-slate-200 text-slate-700 hover:bg-slate-300";
  }
}

function StatusBadge({ status }: { status: QStatus }) {
  const map: Record<QStatus, string> = {
    answered: "bg-emerald-100 text-emerald-800",
    not_answered: "bg-rose-100 text-rose-800",
    not_visited: "bg-slate-100 text-slate-600",
    marked: "bg-violet-100 text-violet-800",
    answered_marked: "bg-violet-100 text-violet-900",
  };
  const label: Record<QStatus, string> = {
    answered: "Answered",
    not_answered: "Not answered",
    not_visited: "Not visited",
    marked: "Marked",
    answered_marked: "Answered + marked",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
        map[status]
      )}
    >
      {label[status]}
    </span>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-4 w-4 shrink-0 rounded", swatch)} />
      <span>{label}</span>
    </div>
  );
}
