"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize2, Shield } from "lucide-react";
import {
  isDocumentFullscreen,
  onFullscreenChange,
  requestDocumentFullscreen,
} from "@/lib/fullscreen";

/**
 * Blocks until real browser fullscreen. Must be entered via this button click.
 */
export default function FullscreenGate({
  deferUntil,
}: {
  deferUntil?: string;
} = {}) {
  const [fs, setFs] = useState(false);
  const [ready, setReady] = useState(false);
  const [deferredOk, setDeferredOk] = useState(!deferUntil);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(() => {
    setFs(isDocumentFullscreen());
    setReady(true);
  }, []);

  useEffect(() => {
    check();
    return onFullscreenChange(check);
  }, [check]);

  useEffect(() => {
    if (!deferUntil) {
      setDeferredOk(true);
      return;
    }
    const tick = () => {
      setDeferredOk(Boolean(document.querySelector(deferUntil)));
    };
    tick();
    const id = window.setInterval(tick, 300);
    return () => clearInterval(id);
  }, [deferUntil]);

  const enter = async () => {
    setError(null);
    setBusy(true);
    try {
      const ok = await requestDocumentFullscreen(document.documentElement);
      check();
      if (!ok && !isDocumentFullscreen()) {
        const ok2 = await requestDocumentFullscreen(document.body);
        check();
        if (!ok2 && !isDocumentFullscreen()) {
          setError(
            "Fullscreen blocked. Click again, or press F11, then click once more."
          );
        }
      }
    } catch {
      setError("Allow fullscreen when the browser asks, then try again.");
      check();
    } finally {
      setBusy(false);
    }
  };

  if (!ready || !deferredOk || fs) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 p-6 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-indigo-500/30 bg-slate-900 p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/40">
          <Maximize2 className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold text-white">
          Enter exam fullscreen
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Browser tabs and the address bar must hide. Click below — this only
          works from a direct click.
        </p>
        <ul className="mt-4 space-y-2 text-left text-xs text-slate-500">
          <li className="flex gap-2">
            <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            Hides browser chrome for the live test
          </li>
          <li className="flex gap-2">
            <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            If you exit fullscreen, this lock returns
          </li>
        </ul>
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void enter();
          }}
          className="mt-6 w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-60"
        >
          {busy ? "Entering…" : "Enter Fullscreen — continue"}
        </button>
        {error && (
          <p className="mt-3 text-xs font-medium text-rose-400">{error}</p>
        )}
        <p className="mt-4 text-[11px] text-slate-600">
          Tip: Chrome/Edge desktop works best. Press F11 if the button is blocked.
        </p>
      </div>
    </div>
  );
}
