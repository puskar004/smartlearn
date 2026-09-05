"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Lock, Timer } from "lucide-react";

export const EXTREME_KEY = "sl_extreme_session";

export function getExtremeEnd(): number {
  if (typeof window === "undefined") return 0;
  return Number(sessionStorage.getItem(EXTREME_KEY) || 0);
}

export function clearExtreme() {
  sessionStorage.removeItem(EXTREME_KEY);
  try {
    window.dispatchEvent(new Event("sl-extreme"));
  } catch {
    // ignore
  }
}

/** Global lock overlay while extreme session timer runs — blocks navigation/escape. */
export default function ExtremeLock() {
  const path = usePathname() || "";
  const router = useRouter();
  const [end, setEnd] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const sync = () => setEnd(getExtremeEnd());
    sync();
    window.addEventListener("sl-extreme", sync);
    const t = setInterval(() => {
      setNow(Date.now());
      const e = getExtremeEnd();
      if (e && Date.now() >= e) {
        clearExtreme();
        setEnd(0);
      } else {
        setEnd(e);
      }
    }, 500);
    return () => {
      window.removeEventListener("sl-extreme", sync);
      clearInterval(t);
    };
  }, []);

  const active = end > now;
  const remaining = Math.max(0, Math.floor((end - now) / 1000));

  useEffect(() => {
    if (!active) return;

    // Force stay on /extreme
    if (!path.startsWith("/extreme")) {
      router.replace("/extreme");
    }

    const blockNav = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const a = t.closest("a");
      if (a) {
        e.preventDefault();
        e.stopPropagation();
        router.replace("/extreme");
      }
    };

    const onKey = (e: KeyboardEvent) => {
      // block Esc leaving fullscreen / shortcuts
      if (e.key === "Escape" || e.key === "F11") {
        e.preventDefault();
        e.stopPropagation();
      }
      if ((e.altKey || e.metaKey || e.ctrlKey) && ["w", "W", "q", "Q", "r", "R"].includes(e.key)) {
        e.preventDefault();
      }
    };

    const onPop = () => {
      history.pushState(null, "", "/extreme");
      router.replace("/extreme");
    };

    history.pushState(null, "", "/extreme");
    window.addEventListener("popstate", onPop);
    document.addEventListener("click", blockNav, true);
    window.addEventListener("keydown", onKey, true);

    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Extreme session is active.";
    };
    window.addEventListener("beforeunload", onBefore);

    try {
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen?.();
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", blockNav, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("beforeunload", onBefore);
    };
  }, [active, path, router]);

  if (!active) return null;

  // When already on extreme page, page UI handles timer — only show thin badge
  if (path.startsWith("/extreme")) {
    return (
      <div className="pointer-events-none fixed left-1/2 top-3 z-[150] -translate-x-1/2 rounded-full bg-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg">
        <Lock className="mr-1 inline h-3.5 w-3.5" />
        EXTREME LOCK {String(Math.floor(remaining / 60)).padStart(2, "0")}:
        {String(remaining % 60).padStart(2, "0")}
      </div>
    );
  }

  // Hard wall if somehow off-page
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/95 p-6">
      <div className="max-w-sm rounded-3xl border border-rose-500/40 bg-slate-900 p-8 text-center text-white">
        <Timer className="mx-auto h-10 w-10 text-rose-400" />
        <h2 className="mt-4 text-xl font-black">Extreme session locked</h2>
        <p className="mt-2 text-sm text-slate-400">
          Navigation is blocked until the timer ends.
        </p>
        <p className="mt-4 font-mono text-3xl font-black text-rose-300">
          {String(Math.floor(remaining / 60)).padStart(2, "0")}:
          {String(remaining % 60).padStart(2, "0")}
        </p>
        <button
          type="button"
          className="mt-6 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold"
          onClick={() => router.replace("/extreme")}
        >
          Return to session
        </button>
      </div>
    </div>
  );
}
