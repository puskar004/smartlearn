"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { bindUser, getActiveUserId, setActiveUserId } from "@/lib/user-store";
import {
  clearPendingGrade,
  clearPendingRole,
  consumeTeacherFreshLogin,
  getPendingGrade,
  getPendingRole,
} from "@/lib/pending-role";
import { getRole, setRole } from "@/lib/teacher-store";
import { emitRoleChanged } from "@/lib/role-events";
import { loadProgress, saveProgress } from "@/lib/user-store";

export default function UserBootstrap() {
  const { userId, isSignedIn } = useAuth();
  const router = useRouter();
  const booted = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      setActiveUserId(null);
      booted.current = null;
      return;
    }
    if (booted.current === userId) return;
    booted.current = userId;

    bindUser(userId);

    const pending = getPendingRole();
    if (pending === "teacher" || pending === "student") {
      setRole(userId, pending);
      clearPendingRole();
    }
    // clear unused fresh-teacher flag without auto-creating a class
    consumeTeacherFreshLogin();

    const pendingGrade = getPendingGrade();
    if (pendingGrade) {
      const p = loadProgress(userId);
      saveProgress({
        ...p,
        grade: pendingGrade,
        gradeChosen: true,
      });
      clearPendingGrade();
      try {
        window.dispatchEvent(new Event("sl-grade-changed"));
      } catch {
        // ignore
      }
    }

    const role = getRole(userId);
    emitRoleChanged();

    // Do NOT auto-create classrooms — teacher creates manually
    const path = window.location.pathname;
    if (role === "teacher") {
      if (
        path === "/" ||
        path.startsWith("/login") ||
        path.startsWith("/sign-in") ||
        path.startsWith("/sign-up") ||
        path.startsWith("/dashboard")
      ) {
        router.replace("/teacher");
      }
    } else if (
      path === "/" ||
      path.startsWith("/login") ||
      path.startsWith("/sign-in") ||
      path.startsWith("/sign-up") ||
      path.startsWith("/teacher")
    ) {
      router.replace("/dashboard");
    }
  }, [isSignedIn, userId, router]);

  return null;
}
