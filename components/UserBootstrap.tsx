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
import { apiCreateClassroom, getRole, setRole } from "@/lib/teacher-store";
import { emitRoleChanged } from "@/lib/role-events";
import { loadProgress, saveProgress } from "@/lib/user-store";

export default function UserBootstrap() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();
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

    const prev = getActiveUserId();
    bindUser(userId);

    const pending = getPendingRole();
    if (pending === "teacher" || pending === "student") {
      setRole(userId, pending);
      clearPendingRole();
    }

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

    const freshTeacher =
      role === "teacher" &&
      (consumeTeacherFreshLogin() || pending === "teacher" || prev !== userId);

    void (async () => {
      if (role === "teacher") {
        if (freshTeacher || pending === "teacher") {
          try {
            const name = user?.firstName
              ? `${user.firstName}'s Class`
              : "My Class";
            await apiCreateClassroom(name);
          } catch (e) {
            console.error("create class on login", e);
          }
        }
        const path = window.location.pathname;
        if (
          path === "/" ||
          path.startsWith("/login") ||
          path.startsWith("/sign-in") ||
          path.startsWith("/sign-up") ||
          path.startsWith("/dashboard")
        ) {
          router.replace("/teacher?tab=code");
        }
      } else {
        const path = window.location.pathname;
        if (
          path === "/" ||
          path.startsWith("/login") ||
          path.startsWith("/sign-in") ||
          path.startsWith("/sign-up") ||
          path.startsWith("/teacher")
        ) {
          router.replace("/dashboard");
        }
      }
    })();
  }, [isSignedIn, userId, user, router]);

  return null;
}
