"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import FocusLock from "@/components/FocusLock";
import UserBootstrap from "@/components/UserBootstrap";
import FullscreenGate from "@/components/FullscreenGate";
import AppSidebar from "@/components/AppSidebar";
import AppTopBar from "@/components/AppTopBar";
import SiteHeader from "@/components/SiteHeader";
import TaskChecklist from "@/components/TaskChecklist";
import StudentSync from "@/components/StudentSync";
import RoleGate from "@/components/RoleGate";
import { getRole } from "@/lib/teacher-store";
import { ROLE_EVENT } from "@/lib/role-events";

const MARKETING = new Set(["/", "/sign-in", "/sign-up"]);

function isMarketing(path: string) {
  if (MARKETING.has(path)) return true;
  if (path.startsWith("/sign-in") || path.startsWith("/sign-up")) return true;
  return false;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  const marketing = isMarketing(path);
  const { userId } = useAuth();
  const [role, setRole] = useState<"student" | "teacher">("student");

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

  const isTeacher = role === "teacher";

  return (
    <div className="min-h-screen bg-[#f4f6ff] text-slate-900">
      <UserBootstrap />
      <FullscreenGate />
      {!isTeacher && <FocusLock />}

      {marketing ? (
        <>
          <SiteHeader />
          <main>{children}</main>
        </>
      ) : (
        <RoleGate>
          <div className="min-h-screen">
            {!isTeacher && <StudentSync />}
            <AppSidebar />
            <div className="pl-[72px] lg:pl-[260px]">
              <AppTopBar />
              <main className="min-h-[calc(100vh-4rem)]">{children}</main>
              {!isTeacher && <TaskChecklist floating />}
            </div>
          </div>
        </RoleGate>
      )}
    </div>
  );
}
