"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  bindUser,
  getActiveUserId,
  setActiveUserId,
} from "@/lib/user-store";
import {
  clearPendingRole,
  consumeTeacherFreshLogin,
  getPendingRole,
} from "@/lib/pending-role";
import {
  createClassroom,
  getRole,
  listTeacherClasses,
  setRole,
} from "@/lib/teacher-store";
import { emitRoleChanged } from "@/lib/role-events";

/**
 * On sign-in:
 * - apply pending student/teacher role from login chooser
 * - teacher gets a NEW private class code every fresh login
 * - student progress namespace is isolated per Clerk user
 */
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
    } else if (!getRole(userId)) {
      setRole(userId, "student");
    }

    const role = getRole(userId);
    emitRoleChanged();

    // Teacher: every fresh login session → brand-new class code
    const freshTeacher =
      role === "teacher" &&
      (consumeTeacherFreshLogin() ||
        pending === "teacher" ||
        (prev !== userId && role === "teacher"));

    if (role === "teacher") {
      // Always ensure at least one class; create NEW code when flagged fresh login
      const existing = listTeacherClasses(userId);
      if (freshTeacher || existing.length === 0) {
        const name =
          user?.fullName || user?.firstName
            ? `${user?.firstName || "Teacher"}'s Class`
            : "My Class";
        createClassroom(userId, user?.fullName || "Teacher", name);
      }
      // Land on teacher hub if still on generic routes
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
  }, [isSignedIn, userId, user, router]);

  return null;
}
