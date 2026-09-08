"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import FocusLock from "@/components/FocusLock";
import UserBootstrap from "@/components/UserBootstrap";
import AppSidebar from "@/components/AppSidebar";
import AppTopBar from "@/components/AppTopBar";
import SiteHeader from "@/components/SiteHeader";
import TaskChecklist from "@/components/TaskChecklist";
import StudentSync from "@/components/StudentSync";
import RoleGate from "@/components/RoleGate";
import ExtremeLock from "@/components/ExtremeLock";
import FullscreenGate from "@/components/FullscreenGate";
import SessionLockChrome, { isSessionLocked } from "@/components/SessionLock";
import GradeGate from "@/components/GradeGate";
import EyeFocusGuard from "@/components/EyeFocusGuard";
import { getRole } from "@/lib/teacher-store";
import { ROLE_EVENT } from "@/lib/role-events";
import { isEyeFocusEnabled } from "@/lib/eye-focus-store";
import { cn } from "@/lib/utils";

const MARKETING = new Set(["/", "/login", "/sign-in", "/sign-up"]);

function isMarketing(path: string) {
  if (MARKETING.has(path)) return true;
  if (path.startsWith("/sign-in") || path.startsWith("/sign-up")) return true;
  if (path.startsWith("/login")) return true;
  return false;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  const marketing = isMarketing(path);
  const { userId } = useAuth();
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [locked, setLocked] = useState(false);
  const [eyeOn, setEyeOn] = useState(false);

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

  useEffect(() => {
    const syncEye = () => setEyeOn(isEyeFocusEnabled(userId));
    syncEye();
    window.addEventListener("sl-eye-focus", syncEye);
    window.addEventListener("storage", syncEye);
    return () => {
      window.removeEventListener("sl-eye-focus", syncEye);
      window.removeEventListener("storage", syncEye);
    };
  }, [userId]);

  useEffect(() => {
    const sync = () => setLocked(isSessionLocked());
    sync();
    window.addEventListener("sl-session-lock", sync);
    return () => window.removeEventListener("sl-session-lock", sync);
  }, []);

  const isTeacher = role === "teacher";
  // Fullscreen + tab-switch only during live test (not whole site)
  const onTest = path === "/test" || path.startsWith("/test/");
  // Exam shell has its own NTA chrome; hide app sidebar only mid-test
  // Pre-test join screen keeps app nav so layout is not blank
  const hideChrome =
    (!isTeacher && onTest && locked) || (locked && !isTeacher && onTest);

  return (
    <div
      className={cn(
        "min-h-screen bg-[#f4f6ff] text-slate-900",
        "sl-responsive-shell",
        hideChrome && "sl-exam-mode"
      )}
    >
      <UserBootstrap />
      {!isTeacher && <GradeGate />}
      {/* Fullscreen only after proctor ready — camera prompt must not kill FS */}
      {!isTeacher && onTest && locked && (
        <FullscreenGate deferUntil="[data-proctor-ready='1']" />
      )}
      {!isTeacher && onTest && <FocusLock />}
      {!isTeacher && <ExtremeLock />}
      {/* Persist eye-focus camera across Settings → other pages */}
      {!isTeacher && eyeOn && !onTest && (
        <div className="fixed bottom-4 left-4 z-[80] max-w-[min(100vw-2rem,360px)]">
          <EyeFocusGuard enabled />
        </div>
      )}
      <SessionLockChrome />

      {marketing ? (
        <>
          <SiteHeader />
          <main>{children}</main>
        </>
      ) : (
        <RoleGate>
          <div className="min-h-screen">
            {!isTeacher && !onTest && <StudentSync />}
            {!hideChrome && <AppSidebar />}
            <div className={cn(hideChrome ? "pl-0" : "pl-[72px] lg:pl-[260px]")}>
              {!hideChrome && <AppTopBar />}
              <main
                className={cn(
                  hideChrome ? "min-h-screen" : "min-h-[calc(100vh-4rem)]"
                )}
              >
                {children}
              </main>
              {!isTeacher && path === "/dashboard" && !hideChrome && (
                <TaskChecklist floating />
              )}
            </div>
          </div>
        </RoleGate>
      )}
    </div>
  );
}
