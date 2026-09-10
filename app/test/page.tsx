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
  const [camReady, setCamReady] = useState(false);
  const [proctorReady, setProctorReady] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isFs, setIsFs] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
  } | null>(null);
  const [tabWarn, setTabWarn] = useState<string | null>(null);
  const [tabWarnCount, setTabWarnCount] = useState(0);
  const tabLeaveCount = useRef(0);
  const tabGraceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabCountdown = useRef<ReturnType<typeof setInterval> | null>(null);

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
      tabLeaveCount.current = 0;
      setTabWarnCount(0);
      return () => setSessionLock(false);
    }
    setSessionLock(false);
    setProctorReady(false);
    setSetupError(null);
    setTabWarn(null);
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

  // Clock starts only after proctor + fullscreen (FS only via button click)
  const timerStarted = useRef(false);
  useEffect(() => {
    if (!inTest) timerStarted.current = false;
  }, [inTest]);
  useEffect(() => {
    if (!proctorReady || !isFs || !test || result) return;
    if (timerStarted.current) return;
    timerStarted.current = true;
    const secs = Math.max(60, (test.durationMin || 30) * 60);
    const endsAt = Date.now() + secs * 1000;
    setTest((t) => (t ? { ...t, endsAt } : t));
    setLeft(secs);
  }, [proctorReady, isFs, test, result]);

  /** Must be called directly from a click — no await before this */
  const requestFsNow = () => {
    try {
      const el = document.documentElement;
      const req =
        el.requestFullscreen?.bind(el) ||
        (
          el as HTMLElement & {
            webkitRequestFullscreen?: () => Promise<void> | void;
          }
        ).webkitRequestFullscreen?.bind(el);
      if (!req) return Promise.reject(new Error("no fs"));
      return Promise.resolve(req());
    } catch (e) {
      return Promise.reject(e);
    }
  };

  const enterFullscreen = async () => {
    try {
      await requestFsNow();
      setIsFs(Boolean(document.fullscreenElement));
      setError(null);
    } catch {
      setIsFs(Boolean(document.fullscreenElement));
      setError(
        "Allow fullscreen when the browser asks. Test can only run in fullscreen."
      );
    }
  };

  /** Pre-warm camera on consent check (user gesture) so Start can FS first */
  const onConsentChange = async (on: boolean) => {
    setConsent(on);
    if (!on) {
      setCamReady(false);
      return;
    }
    try {
      const pre = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      pre.getTracks().forEach((t) => t.stop());
      setCamReady(true);
      setError(null);
    } catch {
      setCamReady(false);
      setConsent(false);
      setError("Allow camera + microphone first, then tick the box again.");
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

  // Tab-switch: 5s grace · 2 warnings · 3rd leave = instant submit
  useEffect(() => {
    if (!inTest || !proctorReady || result) return;

    const clearGrace = () => {
      if (tabGraceTimer.current) clearTimeout(tabGraceTimer.current);
      if (tabCountdown.current) clearInterval(tabCountdown.current);
      tabGraceTimer.current = null;
      tabCountdown.current = null;
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        tabLeaveCount.current += 1;
        const n = tabLeaveCount.current;
        setTabWarnCount(n);

        if (n >= 3) {
          clearGrace();
          setTabWarn("3rd tab switch — submitting test now.");
          void submit(true, "Left the test window 3 times — auto-submitted.");
          return;
        }

        let sec = 5;
        setTabWarn(`Warning ${n}/2 · Return in ${sec}s or test auto-submits!`);
        clearGrace();
        tabCountdown.current = setInterval(() => {
          sec -= 1;
          if (sec <= 0) return;
          setTabWarn(`Warning ${n}/2 · Return in ${sec}s or test auto-submits!`);
        }, 1000);
        tabGraceTimer.current = setTimeout(() => {
          clearGrace();
          if (document.visibilityState === "hidden") {
            setTabWarn("Time up — submitting…");
            void submit(
              true,
              `Tab switch warning ${n}: did not return in 5s — auto-submitted.`
            );
          }
        }, 5000);
      } else if (tabGraceTimer.current) {
        clearGrace();
        const n = tabLeaveCount.current;
        setTabWarn(
          n >= 2
            ? "Last warning used. One more leave = instant submit."
            : `Back in test. Warnings used: ${n}/2.`
        );
        window.setTimeout(() => setTabWarn(null), 2500);
        try {
          void document.documentElement.requestFullscreen?.();
        } catch {
          // ignore
        }
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearGrace();
    };
  }, [inTest, proctorReady, result, submit]);

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
    if (!consent || !camReady) {
      setError(
        "Tick the box and allow camera + mic first, then click Start again."
      );
      return;
    }

    // 1) FULLSCREEN FIRST — still inside the click gesture (no await before this)
    const fsPromise = requestFsNow().then(
      () => true,
      () => false
    );

    setError(null);
    setResult(null);
    setLoading(true);
    try {
      // 2) Load test (cam already granted on consent)
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
      const mins = Math.max(5, Number(t.durationMin) || 30);
      const endsAt = Date.now() + mins * 60_000;
      setTest({ ...t, endsAt, durationMin: mins });
      setAnswers(Array(len).fill(-1));
      setVisited(Array(len).fill(false).map((_, i) => i === 0));
      setMarked(Array(len).fill(false));
      setQi(0);
      setLeft(mins * 60);
      setProctorReady(false);

      const fsOk = await fsPromise;
      const nowFs = Boolean(document.fullscreenElement) || fsOk;
      setIsFs(nowFs);
      if (!nowFs) {
        setError(
          "Click “Enter fullscreen & start answering” when it appears (browser needs a direct click)."
        );
      }
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
              // Fullscreen MUST be a direct click — never from async onReady
              setProctorReady(true);
              setSetupError(null);
              setError(null);
            }}
          />
        )}

        {/* NEET / NTA teal header */}
        <header className="shrink-0 border-b border-teal-700 bg-gradient-to-r from-teal-600 to-cyan-600 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white sm:text-base">
                {test.title || "Live Test"}
              </div>
              <div className="text-[10px] text-teal-50">
                Code {test.code} · {test.teacherName}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="text-right text-[11px] leading-tight text-white">
                <div className="opacity-90">{candidate}</div>
              </div>
              <div className="rounded border border-white/30 bg-white/15 px-3 py-1 text-center">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-teal-50">
                  Time Left
                </div>
                <div className="font-mono text-base font-black tabular-nums text-white">
                  {canAttempt ? `${mm}:${ss}` : "--:--"}
                </div>
              </div>
            </div>
          </div>
          {tabWarn && (
            <div className="bg-rose-600 px-3 py-2 text-center text-xs font-bold text-white animate-pulse">
              {tabWarn}
              {tabWarnCount > 0 && (
                <span className="ml-2 opacity-90">({tabWarnCount}/2 used)</span>
              )}
            </div>
          )}
          <div className="flex items-stretch border-t border-teal-800/40 bg-white">
            <div className="bg-rose-600 px-4 py-1.5 text-[12px] font-bold text-white">
              SECTION A
            </div>
            <div className="flex flex-1 items-center gap-3 px-3 py-1 text-[11px] text-slate-700">
              <span>
                Ques. No {qi + 1} · MCQ Single · Marks : 4
              </span>
              <span className="ml-auto inline-flex items-center gap-1 font-semibold text-teal-800">
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
                    Allow <strong>camera + mic</strong> first, then share{" "}
                    <strong>This tab / Chrome Tab</strong>. Fullscreen locks only
                    after permissions are granted.
                  </>
                )}
              </p>
            )}
            {proctorReady && !isFs && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4">
                <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border-2 border-rose-500 bg-white px-6 py-8 text-center shadow-2xl">
                <Shield className="h-10 w-10 text-rose-600" />
                <div>
                  <p className="text-lg font-bold text-rose-900">
                    Fullscreen required
                  </p>
                  <p className="mt-2 text-sm text-rose-800/80">
                    Browser only allows fullscreen from this button click. Tap
                    below to start answering.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void enterFullscreen()}
                  className="w-full rounded-xl border border-rose-700 bg-rose-600 px-5 py-4 text-sm font-black uppercase text-white shadow-lg hover:bg-rose-500"
                >
                  Enter fullscreen &amp; start answering
                </button>
                </div>
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

            {/* NEET-style bottom actions */}
            <div className="shrink-0 border-t border-[#bdbdbd] bg-[#f5f5f5] px-2 py-2.5 sm:px-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!canAttempt}
                  onClick={markAndNext}
                  className="rounded bg-amber-300 px-3 py-2.5 text-[11px] font-bold text-slate-900 shadow-sm hover:bg-amber-250 disabled:opacity-50"
                >
                  Mark for Review &amp; Next
                </button>
                <button
                  type="button"
                  disabled={!canAttempt}
                  onClick={clearResponse}
                  className="rounded bg-amber-200 px-3 py-2.5 text-[11px] font-bold text-slate-800 shadow-sm hover:bg-amber-100 disabled:opacity-50"
                >
                  Clear Response
                </button>
                <div className="ml-auto flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canAttempt}
                    onClick={saveAndNext}
                    className="rounded bg-emerald-500 px-4 py-2.5 text-[11px] font-black uppercase tracking-wide text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50"
                  >
                    Save &amp; Next
                  </button>
                  <button
                    type="button"
                    disabled={!canAttempt || submitting}
                    onClick={() => requestSubmit()}
                    className="rounded bg-emerald-700 px-4 py-2.5 text-[11px] font-black uppercase tracking-wide text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {submitting ? "Submitting…" : "Submit Test"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: palette — sticky full height on desktop */}
          <aside className="flex w-full shrink-0 flex-col border-t border-[#bdbdbd] bg-[#f0f4f8] lg:sticky lg:top-0 lg:h-full lg:max-h-full lg:w-[280px] lg:border-l lg:border-t-0">
            <div className="shrink-0 border-b border-orange-300 bg-orange-400 px-3 py-2 text-center text-[12px] font-bold uppercase tracking-wide text-white">
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
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-3 py-6 sm:px-6">
      {!test && (
        <>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
            <ClipboardList className="h-3.5 w-3.5" /> Live Test · NEET / JEE style
          </div>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Join teacher test
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Hi {candidate}. After start: Mark for Review, Clear, Save &amp; Next,
            Submit. Palette: green answered · grey not visited · purple review.
          </p>

          <form
            onSubmit={(e) => void join(e)}
            className="mt-8 w-full max-w-xl space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
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
                onChange={(e) => void onConsentChange(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Camera ON + mic + <strong>this tab</strong> share required.
                Stopping share exits the test.
                {camReady && (
                  <strong className="mt-1 block text-emerald-700">
                    Camera ready ✓ — click Start for fullscreen exam
                  </strong>
                )}
              </span>
            </label>
            <button
              type="submit"
              disabled={loading || !consent || !camReady}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {camReady ? "Start locked test (fullscreen)" : "Enable camera first"}
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
