"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Shield } from "lucide-react";
import {
  buildParentTabSwitchMessage,
  openParentWhatsApp,
} from "@/lib/whatsapp";
import { getRole } from "@/lib/teacher-store";
import { ROLE_EVENT } from "@/lib/role-events";

const PARENT_KEY = "sl_parent_phone";
const FOCUS_KEY = "sl_focus_lock_enabled";
const COOLDOWN_MS = 20_000;

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

/** Suppress tab-switch alerts while in-app PDF reader is open */
export function setPdfReading(on: boolean) {
  if (typeof document === "undefined") return;
  if (on) document.documentElement.dataset.pdfOpen = "1";
  else delete document.documentElement.dataset.pdfOpen;
}

function isPdfReading() {
  return document.documentElement.dataset.pdfOpen === "1";
}

/**
 * Student-only: when the study tab is hidden (real tab switch/minimize),
 * show alert + optional parent WhatsApp.
 * Does NOT fire for in-app PDF modal.
 */
export default function FocusLock() {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const [banner, setBanner] = useState<string | null>(null);
  const [role, setRole] = useState<"student" | "teacher">("student");
  const lastAlert = useRef(0);
  const armed = useRef(false);

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
    if (!isFocusLockEnabled()) return;
    if (isPdfReading()) return;

    const now = Date.now();
    if (now - lastAlert.current < COOLDOWN_MS) return;
    lastAlert.current = now;

    const name =
      user?.fullName ||
      user?.primaryEmailAddress?.emailAddress ||
      "Student";
    const msg = buildParentTabSwitchMessage(name);
    const phone = getParentPhone(userId);

    setBanner(
      phone
        ? "Tab switch detected — WhatsApp alert opened for parent."
        : "Tab switch detected — set parent WhatsApp number in Profile to auto-alert."
    );

    if (phone) {
      openParentWhatsApp(phone, msg);
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
      o.frequency.value = 880;
      g.gain.value = 0.06;
      o.start();
      setTimeout(() => {
        o.stop();
        void ctx.close();
      }, 350);
    } catch {
      // ignore
    }

    window.setTimeout(() => setBanner(null), 7000);
  }, [isSignedIn, user, userId]);

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    if (role !== "student") return;

    armed.current = false;
    const armTimer = window.setTimeout(() => {
      armed.current = true;
    }, 2000);

    const onVis = () => {
      if (!armed.current) return;
      if (isPdfReading()) return;
      if (document.visibilityState === "hidden") {
        alertParent();
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(armTimer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isSignedIn, userId, role, alertParent]);

  if (!isSignedIn || role !== "student" || !banner) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[90] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-amber-500/40 bg-slate-950/95 px-4 py-3 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3 text-sm text-amber-100">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-300">
            <Shield className="h-3.5 w-3.5" /> Focus Guardian (Student)
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">{banner}</p>
        </div>
      </div>
    </div>
  );
}
