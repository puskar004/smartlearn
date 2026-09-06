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
import SessionLockChrome, { isSessionLocked } from "@/components/SessionLock";
import { getRole } from "@/lib/teacher-store";
import { ROLE_EVENT } from "@/lib/role-events";
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
    const sync = () => setLocked(isSessionLocked());
    sync();
    window.addEventListener("sl-session-lock", sync);
    return () => window.removeEventListener("sl-session-lock", sync);
  }, []);

  const isTeacher = role === "teacher";
  // Students: focus lock only outside teacher routes; teachers never locked
  const studentFocus = !isTeacher && !locked;

  return (
    <div
      className={cn(
        "min-h-screen bg-[#f4f6ff] text-slate-900",
        "sl-responsive-shell"
      )}
    >
      <UserBootstrap />
      {studentFocus && <FocusLock />}
      {!isTeacher && <ExtremeLock />}
      <SessionLockChrome />

      {marketing ? (
        <>
          <SiteHeader />
          <main>{children}</main>
        </>
      ) : (
        <RoleGate>
          <div className="min-h-screen">
            {!isTeacher && <StudentSync />}
            {/* Hide chrome while student in locked live/test */}
            {!(locked && !isTeacher) && <AppSidebar />}
            <div
              className={cn(
                locked && !isTeacher
                  ? "pl-0"
                  : "pl-[72px] lg:pl-[260px]"
              )}
            >
              {!(locked && !isTeacher) && <AppTopBar />}
              <main className="min-h-[calc(100vh-4rem)]">{children}</main>
              {!isTeacher && path === "/dashboard" && !locked && (
                <TaskChecklist floating />
              )}
            </div>
          </div>
        </RoleGate>
      )}
    </div>
  );
}
