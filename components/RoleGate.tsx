"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { getRole } from "@/lib/teacher-store";
import { ROLE_EVENT } from "@/lib/role-events";

const PUBLIC = ["/", "/login", "/sign-in", "/sign-up"];

const STUDENT_ONLY = [
  "/dashboard",
  "/ncert",
  "/pyq",
  "/quiz",
  "/ai-tutor",
  "/blueprint",
  "/mistakes",
  "/feynman",
  "/remarks",
  "/safe-search",
  "/common-room",
  "/extreme",
  "/join-class",
  "/support",
  "/test",
  "/live-class",
  "/news",
  "/profile",
];

export default function RoleGate({ children }: { children: React.ReactNode }) {
  const { userId, isSignedIn, isLoaded } = useAuth();
  const path = usePathname() || "/";
  const router = useRouter();
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      if (!userId) {
        setRole("student");
        setReady(true);
        return;
      }
      setRole(getRole(userId));
      setReady(true);
    };
    sync();
    window.addEventListener(ROLE_EVENT, sync);
    return () => window.removeEventListener(ROLE_EVENT, sync);
  }, [userId]);

  useEffect(() => {
    if (!isLoaded || !ready) return;

    const isPublic =
      PUBLIC.some((p) => path === p || path.startsWith(p + "/")) ||
      path.startsWith("/sign-in") ||
      path.startsWith("/sign-up");

    if (!isSignedIn && !isPublic) {
      router.replace("/login");
      return;
    }

    if (!isSignedIn || !userId) return;

    const isTeacher = role === "teacher";
    const onTeacherRoute = path.startsWith("/teacher");
    const onStudentRoute = STUDENT_ONLY.some(
      (p) => path === p || path.startsWith(p + "/")
    );

    // Teachers stay in teacher hub
    if (isTeacher && (onStudentRoute || path === "/")) {
      router.replace("/teacher");
      return;
    }

    // Students hard-blocked from any teacher exploration
    if (!isTeacher && onTeacherRoute) {
      router.replace("/dashboard");
      return;
    }
  }, [ready, role, path, isSignedIn, isLoaded, userId, router]);

  // Soft wall UI if student somehow lands on teacher
  if (
    ready &&
    isSignedIn &&
    userId &&
    role !== "teacher" &&
    path.startsWith("/teacher")
  ) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-600">
        <p className="font-bold text-slate-900">Teacher section is locked</p>
        <p>Students cannot explore teacher tools.</p>
      </div>
    );
  }

  return <>{children}</>;
}
