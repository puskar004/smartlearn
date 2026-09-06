"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  ClipboardList,
  Loader2,
  LogIn,
  Shield,
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
type QStatus =
  | "not_visited"
  | "not_answered"
  | "answered"
  | "marked"
  | "answered_marked";

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
  const [isFs, setIsFs] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
  } | null>(null);

  const inTest = Boolean(test && !result);
  const n = test?.questions.length || 0;
  /** Can answer only when proctor ready AND fullscreen */
  const canAttempt = proctorReady && isFs;

  const markedList = useMemo(() => {
    const list: number[] = [];
    for (let i = 0; i < n; i++) {
      if (marked[i]) list.push(i);
    }
    return list;
  }, [n, marked]);

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

  // Track fullscreen — required to attempt
  useEffect(() => {
    const syncFs = () => {
      setIsFs(Boolean(document.fullscreenElement));
    };
    syncFs();
    document.addEventListener("fullscreenchange", syncFs);
    document.addEventListener("webkitfullscreenchange", syncFs as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", syncFs);
      document.removeEventListener(
        "webkitfullscreenchange",
        syncFs as EventListener
      );
    };
  }, []);

  // Start exam clock only after proctor ready + fullscreen (once)
  const timerStarted = useRef(false);
  useEffect(() => {
    if (!inTest) timerStarted.current = false;
  }, [inTest]);
  useEffect(() => {
    if (!proctorReady || !isFs || !test || result) return;
    if (timerStarted.current) return;
    timerStarted.current = true;
    setLeft(Math.max(60, test.durationMin * 60));
  }, [proctorReady, isFs, test, result]);

  const enterFullscreen = async () => {
    try {
      const el = document.documentElement;
      const req =
        el.requestFullscreen?.bind(el) ||
        (
          el as HTMLElement & {
            webkitRequestFullscreen?: () => Promise<void> | void;
          }
        ).webkitRequestFullscreen?.bind(el);
      if (!req) {
        setError("Fullscreen not supported. Use Chrome/Edge on desktop.");
        return;
      }
      await Promise.resolve(req());
      setIsFs(true);
      setError(null);
    } catch {
      setError(
        "Allow fullscreen when the browser asks. Test can only run in fullscreen."
      );
    }
  };

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
    if (!test || !canAttempt || submitting) return;
    const incomplete =
      counts.not_answered + counts.not_visited + counts.marked;
    if (incomplete > 0) {
      const ok = window.confirm(
        `${incomplete} question(s) still incomplete. Submit anyway?`
      );
      if (!ok) return;
    }
    void submit(false);
  }, [test, canAttempt, submitting, counts, submit]);

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
      if (data.alreadyAttempted) {
        const pr = data.priorResult as
          | { score: number; total: number }
          | undefined;
        throw new Error(
          pr
            ? `You have already attempted this test. Score: ${pr.score}/${pr.total}.`
            : "You have already attempted this test. You cannot join again."
        );
      }
      const t = data.test as TestMeta;
      if (!t.active) throw new Error("This test is closed by teacher");
      const len = t.questions.length;
      // Teacher-set duration — timer starts when YOU start (not when test was created)
      const mins = Math.max(5, Number(t.durationMin) || 30);
      const endsAt = Date.now() + mins * 60_000;
      setTest({ ...t, endsAt, durationMin: mins });
      setAnswers(Array(len).fill(-1));
      setVisited(Array(len).fill(false).map((_, i) => i === 0));
      setMarked(Array(len).fill(false));
      setQi(0);
      setLeft(mins * 60);
      window.setTimeout(() => void enterFullscreen(), 200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setTest(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!test || result) return;
    const end = test.endsAt;
    const id = setInterval(() => {
      const s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) void submit(true);
    }, 1000);
    return () => clearInterval(id);
  }, [test, result, submit]);

  const markVisited = () => {
    setVisited((v) => {
      const n2 = [...v];
      n2[qi] = true;
      return n2;
    });
  };

  const selectOption = (oi: number) => {
    setAnswers((a) => {
      const n2 = [...a];
      n2[qi] = oi;
      return n2;
    });
    markVisited();
  };

  const clearResponse = () => {
    setAnswers((a) => {
      const n2 = [...a];
      n2[qi] = -1;
      return n2;
    });
  };

  const saveAndNext = () => {
    markVisited();
    if (qi < n - 1) goTo(qi + 1);
  };

  const saveAndMark = () => {
    setMarked((m) => {
      const n2 = [...m];
      n2[qi] = true;
      return n2;
    });
    markVisited();
    if (qi < n - 1) goTo(qi + 1);
  };

  const markAndNext = () => {
    setMarked((m) => {
      const n2 = [...m];
      n2[qi] = true;
      return n2;
    });
    markVisited();
    if (qi < n - 1) goTo(qi + 1);
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
  const q = test?.questions[qi];
  const candidate = displayName(user);

  // —— NTA full-viewport exam shell ——
  if (test && !result && q) {
    return (
      <div className="fixed inset-0 z-50 flex min-h-screen flex-col bg-[#e8e8e8] text-[13px] text-[#222]">
        {inTest && (
          <TestProctor
            active={inTest}
            testCode={test.code}
            onProctorFail={onProctorFail}
            onSetupError={(msg) => {
              setProctorReady(false);
              setSetupError(msg);
            }}
            onReady={() => {
              setProctorReady(true);
              void enterFullscreen();
              setSetupError(null);
              setError(null);
            }}
          />
        )}

        {/* NTA-style orange/yellow header */}
        <header className="shrink-0 border-b border-[#c45a00] bg-gradient-to-b from-[#ff9f1a] via-[#f77f00] to-[#e85d04] shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 sm:px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/80 bg-[#1a237e] text-[10px] font-black leading-tight text-white shadow">
                SL
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-white drop-shadow-sm">
                  SmartLearn Exam
                </div>
                <div className="text-[10px] font-semibold text-amber-50/95">
                  National Testing Agency style · Computer Based Test
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="text-right text-[11px] leading-tight text-white">
                <div className="opacity-90">Candidate Name</div>
                <div className="font-bold uppercase tracking-wide">
                  {candidate}
                </div>
              </div>
              <div className="rounded border border-[#1565c0] bg-[#1565c0] px-3 py-1 text-center shadow-inner">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-sky-100">
                  Time Left
                </div>
                <div className="font-mono text-base font-black tabular-nums text-white">
                  {canAttempt ? `${mm}:${ss}` : "--:--"}
                </div>
              </div>
            </div>
          </div>
          {/* Subject / paper strip */}
          <div className="flex items-stretch border-t border-[#c45a00]/80 bg-[#fff8e7]">
            <div className="border-r border-amber-300 bg-[#1a237e] px-4 py-1.5 text-[12px] font-bold text-white">
              {test.title || "Paper"}
            </div>
            <div className="flex flex-1 items-center gap-3 px-3 py-1 text-[11px] text-slate-700">
              <span>
                Code: <strong className="font-mono">{test.code}</strong>
              </span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">
                Invigilator: {test.teacherName}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 font-semibold text-[#1a237e]">
                <Shield className="h-3 w-3" />
                {isFs ? "FULLSCREEN" : "FS OFF"} ·{" "}
                {proctorReady ? "PROCTORED" : "SETUP"}
              </span>
            </div>
          </div>
        </header>

        {/* Gates */}
        {(!proctorReady || !isFs || error) && (
          <div className="shrink-0 space-y-2 border-b border-amber-200 bg-[#fffde7] px-3 py-2">
            {!proctorReady && (
              <p className="text-[12px] font-medium text-amber-950">
                {setupError || (
                  <>
                    Allow <strong>camera + mic</strong>, then share{" "}
                    <strong>This tab / Chrome Tab</strong> → this SmartLearn
                    page. Then enter <strong>fullscreen</strong> to attempt.
                  </>
                )}
              </p>
            )}
            {proctorReady && !isFs && (
              <div className="flex flex-col items-center gap-2 rounded border-2 border-rose-500 bg-rose-50 px-4 py-4 text-center sm:flex-row sm:justify-center">
                <Shield className="h-6 w-6 text-rose-600" />
                <div className="text-left">
                  <p className="text-sm font-bold text-rose-900">
                    Fullscreen required to attempt the test
                  </p>
                  <p className="text-[11px] text-rose-800/80">
                    Questions stay locked until you enter fullscreen. Exiting FS
                    mid-test pauses answering.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void enterFullscreen()}
                  className="rounded border border-rose-700 bg-rose-600 px-5 py-2 text-xs font-black uppercase text-white shadow hover:bg-rose-500"
                >
                  Enter fullscreen &amp; start answering
                </button>
              </div>
            )}
            {error && (
              <p className="whitespace-pre-wrap text-[12px] font-semibold text-rose-700">
                {error}
              </p>
            )}
          </div>
        )}

        {/* Main exam body */}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col lg:flex-row",
            !canAttempt && "pointer-events-none opacity-45"
          )}
        >
          {/* LEFT: question */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-[#bdbdbd] bg-white">
            <div className="flex items-center justify-between border-b border-[#cfd8dc] bg-[#eceff1] px-3 py-1.5">
              <span className="text-[13px] font-bold text-[#1a237e]">
                Question {qi + 1}:
              </span>
              <span className="text-[11px] text-slate-600">
                Q {qi + 1} of {n}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#212121]">
                {q.prompt}
              </p>

              <div className="mt-5 space-y-2.5">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  return (
                    <label
                      key={oi}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded border px-3 py-2.5 transition",
                        selected
                          ? "border-[#1565c0] bg-[#e3f2fd]"
                          : "border-transparent hover:bg-[#f5f5f5]"
                      )}
                    >
                      <input
                        type="radio"
                        name={`q-${qi}`}
                        checked={selected}
                        disabled={!canAttempt}
                        onChange={() => selectOption(oi)}
                        className="mt-1 h-4 w-4 accent-[#1565c0]"
                      />
                      <span className="min-w-[1.5rem] font-bold text-[#424242]">
                        ({oi + 1})
                      </span>
                      <span className="flex-1 text-[13px] leading-snug text-[#212121]">
                        {opt}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* NTA action buttons */}
            <div className="shrink-0 border-t border-[#bdbdbd] bg-[#fafafa] px-2 py-2 sm:px-3">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  disabled={!canAttempt}
                  onClick={saveAndNext}
                  className="rounded border border-[#2e7d32] bg-[#43a047] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm hover:bg-[#388e3c] disabled:opacity-50"
                >
                  Save &amp; Next
                </button>
                <button
                  type="button"
                  disabled={!canAttempt}
                  onClick={saveAndMark}
                  className="rounded border border-[#e65100] bg-[#fb8c00] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm hover:bg-[#f57c00] disabled:opacity-50"
                >
                  Save &amp; Mark for Review
                </button>
                <button
                  type="button"
                  disabled={!canAttempt}
                  onClick={clearResponse}
                  className="rounded border border-[#9e9e9e] bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#424242] shadow-sm hover:bg-[#f5f5f5] disabled:opacity-50"
                >
                  Clear Response
                </button>
                <button
                  type="button"
                  disabled={!canAttempt}
                  onClick={markAndNext}
                  className="rounded border border-[#0d47a1] bg-[#1976d2] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm hover:bg-[#1565c0] disabled:opacity-50"
                >
                  Mark for Review &amp; Next
                </button>
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={!canAttempt || qi <= 0}
                    onClick={() => goTo(qi - 1)}
                    className="rounded border border-[#546e7a] bg-[#607d8b] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm hover:bg-[#546e7a] disabled:opacity-40"
                  >
                    « Back
                  </button>
                  <button
                    type="button"
                    disabled={!canAttempt || qi >= n - 1}
                    onClick={() => {
                      markVisited();
                      goTo(qi + 1);
                    }}
                    className="rounded border border-[#546e7a] bg-[#607d8b] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm hover:bg-[#546e7a] disabled:opacity-40"
                  >
                    Next »
                  </button>
                  <button
                    type="button"
                    disabled={!canAttempt || submitting}
                    onClick={() => requestSubmit()}
                    className="rounded border border-[#1b5e20] bg-[#2e7d32] px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white shadow-sm hover:bg-[#1b5e20] disabled:opacity-50"
                  >
                    {submitting ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: palette */}
          <aside className="flex w-full shrink-0 flex-col border-t border-[#bdbdbd] bg-[#eceff1] lg:w-[300px] lg:border-t-0">
            <div className="border-b border-[#cfd8dc] bg-[#1a237e] px-3 py-2 text-center text-[12px] font-bold uppercase tracking-wide text-white">
              Question Palette
            </div>

            {/* Legend — NTA shapes */}
            <div className="space-y-1.5 border-b border-[#cfd8dc] bg-white px-3 py-2.5 text-[10px] text-slate-700">
              <LegendRow
                shape="not_visited"
                label={`Not Visited (${counts.not_visited})`}
              />
              <LegendRow
                shape="not_answered"
                label={`Not Answered (${counts.not_answered})`}
              />
              <LegendRow
                shape="answered"
                label={`Answered (${counts.answered})`}
              />
              <LegendRow
                shape="marked"
                label={`Marked for Review (${counts.marked})`}
              />
              <LegendRow
                shape="answered_marked"
                label={`Answered & Marked for Review (${counts.answered_marked})`}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="mb-2 text-[11px] font-bold uppercase text-[#1a237e]">
                Choose a Question
              </div>
              <div className="grid grid-cols-5 gap-2">
                {test.questions.map((_, i) => {
                  const st = statusOf(i);
                  const current = i === qi;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!canAttempt}
                      onClick={() => goTo(i)}
                      className={cn(
                        "relative flex h-9 w-full items-center justify-center text-[12px] font-bold text-white shadow-sm transition",
                        paletteShape(st),
                        current && "ring-2 ring-[#ff6f00] ring-offset-1"
                      )}
                      title={`Q${i + 1} · ${st.replace(/_/g, " ")}`}
                    >
                      {i + 1}
                      {st === "answered_marked" && (
                        <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-sm bg-[#43a047]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Marked for review — separate section */}
              <div className="mt-4 rounded border border-[#7b1fa2] bg-[#f3e5f5] p-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#6a1b9a]">
                  Marked for Review ({markedList.length})
                </div>
                {markedList.length === 0 ? (
                  <p className="mt-1.5 text-[10px] text-[#8e24aa]/80">
                    No questions marked. Use “Mark for Review” to save for later.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {markedList.map((i) => (
                      <button
                        key={i}
                        type="button"
                        disabled={!canAttempt}
                        onClick={() => goTo(i)}
                        className={cn(
                          "flex h-8 min-w-8 items-center justify-center px-2 text-[11px] font-bold text-white shadow",
                          answers[i] >= 0
                            ? "rounded-sm bg-[#7b1fa2] ring-2 ring-[#43a047]"
                            : "rounded-sm bg-[#9c27b0]",
                          qi === i && "ring-2 ring-offset-1 ring-[#ff6f00]"
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 rounded border border-[#cfd8dc] bg-white p-2.5 text-[11px] text-slate-600">
                <div className="flex justify-between">
                  <span>Total Questions</span>
                  <strong>{n}</strong>
                </div>
                <div className="mt-1 flex justify-between text-[#2e7d32]">
                  <span>Answered</span>
                  <strong>
                    {counts.answered + counts.answered_marked}
                  </strong>
                </div>
                <div className="mt-1 flex justify-between text-[#6a1b9a]">
                  <span>For Review</span>
                  <strong>{markedList.length}</strong>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-[#bdbdbd] bg-white p-3">
              <button
                type="button"
                disabled={submitting || !canAttempt}
                onClick={() => requestSubmit()}
                className="w-full rounded border border-[#1b5e20] bg-[#2e7d32] py-3 text-sm font-black uppercase tracking-wide text-white shadow hover:bg-[#1b5e20] disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </aside>
        </div>

        {/* Mobile sticky submit / FS */}
        <div className="shrink-0 border-t border-[#bdbdbd] bg-white p-2 lg:hidden">
          {!isFs ? (
            <button
              type="button"
              onClick={() => void enterFullscreen()}
              className="w-full rounded border border-rose-700 bg-rose-600 py-3 text-sm font-black uppercase text-white"
            >
              Enter fullscreen to continue
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || !canAttempt}
              onClick={() => requestSubmit()}
              className="w-full rounded border border-[#1b5e20] bg-[#2e7d32] py-3 text-sm font-black uppercase text-white disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      {!test && (
        <>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
            <ClipboardList className="h-3.5 w-3.5" /> Live Test · JEE-style
          </div>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Join teacher test
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Hi {candidate}. Palette:{" "}
            <span className="font-semibold text-emerald-600">
              Green = answered
            </span>
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

function paletteShape(st: QStatus) {
  switch (st) {
    case "answered":
      /* green rounded square */
      return "rounded-md bg-[#43a047] hover:bg-[#388e3c]";
    case "not_answered":
      /* red flag-ish: rounded top */
      return "rounded-t-md rounded-b-sm bg-[#e53935] hover:bg-[#c62828]";
    case "marked":
      /* purple circle-ish */
      return "rounded-full bg-[#9c27b0] hover:bg-[#7b1fa2]";
    case "answered_marked":
      return "rounded-full bg-[#9c27b0] hover:bg-[#7b1fa2]";
    default:
      /* grey square not visited */
      return "rounded-sm bg-[#9e9e9e] hover:bg-[#757575]";
  }
}

function LegendRow({
  shape,
  label,
}: {
  shape: QStatus;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "relative flex h-5 w-5 shrink-0 items-center justify-center text-[9px] font-bold text-white",
          paletteShape(shape)
        )}
      >
        {shape === "answered_marked" && (
          <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-sm bg-[#43a047]" />
        )}
      </span>
      <span>{label}</span>
    </div>
  );
}
