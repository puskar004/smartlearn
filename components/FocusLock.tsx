"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Shield } from "lucide-react";
import {
  buildParentTabSwitchMessage,
  openParentWhatsApp,
} from "@/lib/whatsapp";

const PARENT_KEY = "sl_parent_phone";
const FOCUS_KEY = "sl_focus_lock_enabled";
const COOLDOWN_MS = 45_000;

export function getParentPhone() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(PARENT_KEY) || "";
}

export function setParentPhone(phone: string) {
  localStorage.setItem(PARENT_KEY, phone.replace(/\D/g, ""));
}

export function isFocusLockEnabled() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(FOCUS_KEY) !== "0";
}

export function setFocusLockEnabled(on: boolean) {
  localStorage.setItem(FOCUS_KEY, on ? "1" : "0");
}

/** When signed-in student leaves tab/window, notify parent via WhatsApp. */
export default function FocusLock() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [banner, setBanner] = useState<string | null>(null);
  const lastAlert = useRef(0);
  const armed = useRef(false);

  const alertParent = useCallback(() => {
    if (!isSignedIn || !isFocusLockEnabled()) return;
    const now = Date.now();
    if (now - lastAlert.current < COOLDOWN_MS) return;
    lastAlert.current = now;

    const name =
      user?.fullName ||
      user?.primaryEmailAddress?.emailAddress ||
      "Student";
    const msg = buildParentTabSwitchMessage(name);
    const phone = getParentPhone();

    setBanner(
      phone
        ? "Tab switch detected — WhatsApp alert opened for parent."
        : "Tab switch detected — set parent WhatsApp number in Profile to auto-alert."
    );

    if (phone) {
      openParentWhatsApp(phone, msg);
    }

    // Soft beep
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
      g.gain.value = 0.05;
      o.start();
      setTimeout(() => {
        o.stop();
        ctx.close();
      }, 400);
    } catch {
      // ignore
    }

    setTimeout(() => setBanner(null), 6000);
  }, [isSignedIn, user]);

  useEffect(() => {
    if (!isSignedIn) return;

    // Arm after short delay so initial load doesn't false-trigger
    const armTimer = setTimeout(() => {
      armed.current = true;
    }, 2500);

    const onVis = () => {
      if (!armed.current) return;
      if (document.visibilityState === "hidden") alertParent();
    };
    const onBlur = () => {
      if (!armed.current) return;
      // blur can fire often; only when document hidden-ish
      if (document.visibilityState === "hidden") alertParent();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);

    return () => {
      clearTimeout(armTimer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
  }, [isSignedIn, alertParent]);

  if (!isSignedIn || !banner) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[90] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-amber-500/40 bg-slate-950/95 px-4 py-3 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3 text-sm text-amber-100">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-300">
            <Shield className="h-3.5 w-3.5" /> Focus Guardian
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">{banner}</p>
        </div>
      </div>
    </div>
  );
}
