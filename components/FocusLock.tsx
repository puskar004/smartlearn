"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Shield } from "lucide-react";
import {
  buildParentTabSwitchMessage,
  openParentWhatsApp,
} from "@/lib/whatsapp";
import { getRole } from "@/lib/teacher-store";
import { ROLE_EVENT } from "@/lib/role-events";
import { pushNotification } from "@/lib/notifications";
import { displayName } from "@/lib/display-name";

const PARENT_KEY = "sl_parent_phone";
const FOCUS_KEY = "sl_focus_lock_enabled";
const SWITCH_COUNT_KEY = "sl_tab_switch_count_";
const COOLDOWN_MS = 3_000;

function parentKey(userId?: string | null) {
  return userId ? `${PARENT_KEY}_${userId}` : PARENT_KEY;
}

export function getParentPhone(userId?: string | null) {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem(parentKey(userId)) ||
    localStorage.getItem(PARENT_KEY) ||
    ""
  );
}

export function setParentPhone(phone: string, userId?: string | null) {
  localStorage.setItem(parentKey(userId), phone.replace(/\D/g, ""));
}

export function isFocusLockEnabled() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(FOCUS_KEY) !== "0";
}

export function setFocusLockEnabled(on: boolean) {
  localStorage.setItem(FOCUS_KEY, on ? "1" : "0");
}

export function getTabSwitchCount(userId: string) {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(SWITCH_COUNT_KEY + userId) || 0);
}

export function setPdfReading(on: boolean) {
  if (typeof document === "undefined") return;
  if (on) document.documentElement.dataset.pdfOpen = "1";
  else delete document.documentElement.dataset.pdfOpen;
}

function isPdfReading() {
  return (
    document.documentElement.dataset.pdfOpen === "1" ||
    document.documentElement.dataset.modalOpen === "1"
  );
}

export function setModalOpen(on: boolean) {
  if (typeof document === "undefined") return;
  if (on) document.documentElement.dataset.modalOpen = "1";
  else delete document.documentElement.dataset.modalOpen;
}

/** Student-only tab-switch guardian (never on teacher routes). */
export default function FocusLock() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const path = usePathname() || "";
  const [banner, setBanner] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [role, setRole] = useState<"student" | "teacher">("student");
  const lastAlert = useRef(0);
  const armed = useRef(false);

  const onTeacher = path.startsWith("/teacher");
  const onTest = path === "/test" || path.startsWith("/test/");

  useEffect(() => {
    const sync = () => {
      if (!userId) {
        setRole("student");
        return;
      }
      setRole(getRole(userId));
    };
    sync();
    window.addEventListener(ROLE_EVENT, sync);
    return () => window.removeEventListener(ROLE_EVENT, sync);
  }, [userId]);

  const alertParent = useCallback(() => {
    if (!isSignedIn || !userId) return;
    if (getRole(userId) !== "student") return;
    if (path.startsWith("/teacher")) return;
    // Tab-switch lock ONLY during live test
    if (!onTest) return;
    if (!isFocusLockEnabled()) return;
    if (isPdfReading()) return;
    if (document.querySelector("[data-pdf-reader='1']")) return;

    const now = Date.now();
    if (now - lastAlert.current < COOLDOWN_MS) return;
    lastAlert.current = now;

    const n = getTabSwitchCount(userId) + 1;
    localStorage.setItem(SWITCH_COUNT_KEY + userId, String(n));
    setCount(n);

    const name = displayName(user);
    const msg = buildParentTabSwitchMessage(name, n);
    const phone = getParentPhone(userId);
    const sent = phone ? openParentWhatsApp(phone, msg) : false;

    setBanner(
      sent
        ? `Test tab switch #${n}! Parent WhatsApp alert opened.`
        : `Test tab switch #${n}! Stay on the exam window.`
    );

    pushNotification(userId, {
      title: `Test tab switch #${n}`,
      body: sent ? `Parent alert sent.` : `Stay focused on the test.`,
      href: "/test",
    });

    try {
      void document.documentElement.requestFullscreen?.();
    } catch {
      // ignore
    }

    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      // Longer buzzer (~1.2s) so student notices
      o.frequency.value = 880;
      g.gain.value = 0.1;
      o.start();
      setTimeout(() => {
        o.frequency.value = 660;
      }, 400);
      setTimeout(() => {
        o.stop();
        void ctx.close();
      }, 1200);
    } catch {
      // ignore
    }

    window.setTimeout(() => setBanner(null), 8000);
  }, [isSignedIn, user, userId, path, onTest]);

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    if (role !== "student") return;
    if (onTeacher) return;
    if (!onTest) return;

    armed.current = false;
    const armTimer = window.setTimeout(() => {
      armed.current = true;
    }, 1500);

    const onVis = () => {
      if (!armed.current) return;
      if (isPdfReading()) return;
      if (document.visibilityState === "hidden") {
        alertParent();
      } else if (document.visibilityState === "visible") {
        try {
          if (
            document.documentElement.dataset.sessionLock &&
            !document.fullscreenElement
          ) {
            void document.documentElement.requestFullscreen?.();
          }
        } catch {
          // ignore
        }
      }
    };

    // pagehide / blur backup — some mobile browsers
    const onPageHide = () => {
      if (!armed.current) return;
      if (isPdfReading()) return;
      alertParent();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearTimeout(armTimer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [isSignedIn, userId, role, onTeacher, onTest, alertParent]);

  if (!isSignedIn || role !== "student" || onTeacher || !onTest || !banner)
    return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-amber-400/50 bg-slate-900 p-6 text-center shadow-2xl">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-300">
          <Shield className="h-3.5 w-3.5" /> Focus Guardian · Student only
        </div>
        <p className="mt-3 text-sm font-semibold text-white">{banner}</p>
        <p className="mt-2 text-xs text-slate-400">
          Tab switches this session: <strong className="text-amber-300">{count}</strong>
        </p>
        <button
          type="button"
          onClick={() => {
            setBanner(null);
            try {
              void document.documentElement.requestFullscreen?.();
            } catch {
              // ignore
            }
          }}
          className="mt-5 w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400"
        >
          Back to study (fullscreen)
        </button>
      </div>
    </div>
  );
}
