"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Timer, Zap } from "lucide-react";
import { clearExtreme, EXTREME_KEY } from "@/components/ExtremeLock";

const PAID_KEY = "sl_extreme_paid";

export default function ExtremePage() {
  const [paid, setPaid] = useState(false);
  const [minutes, setMinutes] = useState(25);
  const [active, setActive] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setPaid(localStorage.getItem(PAID_KEY) === "1");
    const end = Number(sessionStorage.getItem(EXTREME_KEY) || 0);
    if (end > Date.now()) {
      setActive(true);
      setRemaining(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      const end = Number(sessionStorage.getItem(EXTREME_KEY) || 0);
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearExtreme();
        setActive(false);
        setBlocked(false);
        try {
          if (document.fullscreenElement) void document.exitFullscreen();
        } catch {
          // ignore
        }
      }
    }, 250);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onPop = () => {
      setBlocked(true);
      history.pushState(null, "", "/extreme");
    };
    history.pushState(null, "", "/extreme");
    window.addEventListener("popstate", onPop);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setBlocked(true);
      }
    };
    window.addEventListener("keydown", onKey, true);

    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);

    try {
      void document.documentElement.requestFullscreen?.();
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("beforeunload", onBefore);
    };
  }, [active]);

  const unlockPaid = () => {
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
    const secs = Math.max(5, minutes) * 60;
    const end = Date.now() + secs * 1000;
    sessionStorage.setItem(EXTREME_KEY, String(end));
    window.dispatchEvent(new Event("sl-extreme"));
    setRemaining(secs);
    setActive(true);
    setBlocked(false);
    try {
      void document.documentElement.requestFullscreen?.();
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
      <h1 className="mt-3 text-3xl font-bold text-slate-900">
        No escape until the timer ends
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        While active: sidebar links blocked, back/Esc blocked, leaving the page
        warns you. Global Extreme Lock keeps you on this session.
      </p>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {!active ? (
          <>
            <label className="block text-sm font-semibold text-slate-700">
              Session length (minutes)
              <input
                type="number"
                min={5}
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
              Stay on NCERT / quiz in this locked session. Navigation is blocked
              app-wide.
            </p>
            {blocked && (
              <p className="mt-4 text-xs font-semibold text-rose-600">
                Escape / back is locked until timer hits zero.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
