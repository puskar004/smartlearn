"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

/** Fullscreen + navigation lock while student is in live class or proctored test. */
export function setSessionLock(on: boolean, reason = "session") {
  if (typeof document === "undefined") return;
  if (on) {
    document.documentElement.dataset.sessionLock = reason;
    document.documentElement.classList.add("sl-session-lock");
  } else {
    delete document.documentElement.dataset.sessionLock;
    document.documentElement.classList.remove("sl-session-lock");
  }
  window.dispatchEvent(new Event("sl-session-lock"));
}

export function isSessionLocked() {
  return typeof document !== "undefined" && Boolean(document.documentElement.dataset.sessionLock);
}

export default function SessionLockChrome() {
  const [locked, setLocked] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const sync = () => {
      const r = document.documentElement.dataset.sessionLock || "";
      setLocked(Boolean(r));
      setReason(r);
    };
    sync();
    window.addEventListener("sl-session-lock", sync);
    return () => window.removeEventListener("sl-session-lock", sync);
  }, []);

  useEffect(() => {
    if (!locked) return;

    const enterFs = () => {
      try {
        void document.documentElement.requestFullscreen?.();
      } catch {
        // ignore
      }
    };
    enterFs();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onPop = () => {
      history.pushState(null, "", location.href);
    };
    history.pushState(null, "", location.href);
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey, true);

    const onFs = () => {
      if (!document.fullscreenElement) {
        // soft re-request
        setTimeout(enterFs, 400);
      }
    };
    document.addEventListener("fullscreenchange", onFs);

    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [locked]);

  if (!locked) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-2 z-[95] -translate-x-1/2 rounded-full border border-amber-400/40 bg-slate-950/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-200 shadow-lg">
      <Lock className="mr-1 inline h-3 w-3" />
      {reason === "test" ? "Test lock · proctoring on" : "Live class lock"}
    </div>
  );
}
