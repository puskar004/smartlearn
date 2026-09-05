"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize2, Shield } from "lucide-react";

/**
 * Blocks the app until the user enters (and stays in) fullscreen.
 * Browser requires a user gesture for requestFullscreen.
 */
export default function FullscreenGate() {
  const [fs, setFs] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(() => {
    const el =
      document.fullscreenElement ||
      (document as Document & { webkitFullscreenElement?: Element })
        .webkitFullscreenElement;
    setFs(Boolean(el));
    setReady(true);
  }, []);

  useEffect(() => {
    check();
    const onChange = () => check();
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange as EventListener);
    // Also block if window is not roughly maximized (tab leave handled elsewhere)
    const onResize = () => {
      // soft hint only
    };
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        onChange as EventListener
      );
      window.removeEventListener("resize", onResize);
    };
  }, [check]);

  const enter = async () => {
    setError(null);
    try {
      const root = document.documentElement;
      const req =
        root.requestFullscreen?.bind(root) ||
        (
          root as HTMLElement & {
            webkitRequestFullscreen?: () => Promise<void> | void;
          }
        ).webkitRequestFullscreen?.bind(root);
      if (!req) {
        setError("Fullscreen not supported on this browser. Use Chrome/Edge.");
        return;
      }
      await Promise.resolve(req());
      check();
    } catch {
      setError("Allow fullscreen when the browser asks, then try again.");
    }
  };

  if (!ready || fs) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 p-6 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-indigo-500/30 bg-slate-900 p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/40">
          <Maximize2 className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold text-white">
          SmartLearn Focus Mode
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          For distraction-free study, SmartLearn only works in{" "}
          <strong className="text-indigo-300">fullscreen</strong>. Exit
          fullscreen and this lock returns instantly.
        </p>
        <ul className="mt-4 space-y-2 text-left text-xs text-slate-500">
          <li className="flex gap-2">
            <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            Tab switch still alerts parents when signed in
          </li>
          <li className="flex gap-2">
            <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            Press Esc to leave fullscreen (site locks again)
          </li>
        </ul>
        <button
          type="button"
          onClick={() => void enter()}
          className="mt-6 w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500"
        >
          Enter Fullscreen &amp; Start Studying
        </button>
        {error && (
          <p className="mt-3 text-xs font-medium text-rose-400">{error}</p>
        )}
        <p className="mt-4 text-[11px] text-slate-600">
          Tip: On phones, rotate to landscape and use “Add to Home Screen” for a
          near-fullscreen experience.
        </p>
      </div>
    </div>
  );
}
