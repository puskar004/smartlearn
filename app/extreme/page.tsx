"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Timer, Zap } from "lucide-react";

const PAID_KEY = "sl_extreme_paid";
const SESSION_KEY = "sl_extreme_session";

export default function ExtremePage() {
  const router = useRouter();
  const [paid, setPaid] = useState(false);
  const [minutes, setMinutes] = useState(25);
  const [active, setActive] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setPaid(localStorage.getItem(PAID_KEY) === "1");
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const end = Number(raw);
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      if (left > 0) {
        setActive(true);
        setRemaining(left);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (!active || remaining <= 0) {
      if (active && remaining <= 0) {
        setActive(false);
        sessionStorage.removeItem(SESSION_KEY);
        setBlocked(false);
      }
      return;
    }
    const t = setInterval(() => {
      setRemaining((r) => {
        const next = r - 1;
        if (next <= 0) sessionStorage.removeItem(SESSION_KEY);
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [active, remaining]);

  // Block back / unload while active
  useEffect(() => {
    if (!active) return;

    const onPop = () => {
      setBlocked(true);
      history.pushState(null, "", location.href);
    };
    history.pushState(null, "", location.href);
    window.addEventListener("popstate", onPop);

    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);

    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("beforeunload", onBefore);
    };
  }, [active]);

  const unlockPaid = () => {
    // Demo payment gate — replace with Razorpay/Stripe later
    const ok = window.confirm(
      "Extreme Mode is a paid focus lock (demo ₹49). Simulate successful payment?"
    );
    if (ok) {
      localStorage.setItem(PAID_KEY, "1");
      setPaid(true);
    }
  };

  const start = useCallback(() => {
    if (!paid) {
      unlockPaid();
      return;
    }
    const secs = minutes * 60;
    const end = Date.now() + secs * 1000;
    sessionStorage.setItem(SESSION_KEY, String(end));
    setRemaining(secs);
    setActive(true);
    setBlocked(false);
    try {
      document.documentElement.requestFullscreen?.();
    } catch {
      // ignore
    }
  }, [paid, minutes]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
        <Zap className="h-3.5 w-3.5" /> Extreme Mode · Paid
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        No escape until the timer ends
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Once started, back navigation is blocked and leaving the page warns you.
        Built for deep NCERT sprints. Unlock with a one-time demo payment.
      </p>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {!active ? (
          <>
            <label className="block text-sm font-semibold text-slate-700">
              Session length (minutes)
              <input
                type="number"
                min={10}
                max={120}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value) || 25)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                  paid
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                <Lock className="h-3 w-3" />
                {paid ? "Unlocked" : "Locked · payment required"}
              </span>
              {!paid && (
                <button
                  type="button"
                  onClick={unlockPaid}
                  className="text-xs font-bold text-rose-600 hover:underline"
                >
                  Pay to unlock (demo)
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={start}
              className="mt-6 w-full rounded-xl bg-rose-600 py-3 text-sm font-bold text-white hover:bg-rose-500"
            >
              Start Extreme Session
            </button>
          </>
        ) : (
          <div className="text-center">
            <Timer className="mx-auto h-8 w-8 text-rose-500" />
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-rose-600">
              Extreme lock active
            </p>
            <p className="mt-2 font-mono text-5xl font-black text-slate-900">
              {mm}:{ss}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Back button disabled · stay with your NCERT chapter.
            </p>
            <button
              type="button"
              onClick={() => router.push("/ncert")}
              className="mt-6 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
            >
              Study NCERT in this tab
            </button>
            {blocked && (
              <p className="mt-4 text-xs font-semibold text-rose-600">
                Back is locked until timer hits zero.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
