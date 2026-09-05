"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { getRole } from "@/lib/teacher-store";
import { ROLE_EVENT } from "@/lib/role-events";

const STUDENT_ONLY = [
  "/dashboard",
  "/ncert",
  "/pyq",
  "/quiz",
  "/ai-tutor",
  "/blueprint",
  "/mistakes",
  "/feynman",
  "/study-music",
  "/parent",
  "/safe-search",
  "/common-room",
  "/extreme",
  "/join-class",
];

const TEACHER_ONLY = ["/teacher"];

export default function RoleGate({ children }: { children: React.ReactNode }) {
  const { userId, isSignedIn } = useAuth();
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
    if (!ready || !isSignedIn || !userId) return;

    const isTeacher = role === "teacher";
    const onTeacherRoute = path.startsWith("/teacher");
    const onStudentRoute = STUDENT_ONLY.some(
      (p) => path === p || path.startsWith(p + "/")
    );

    if (isTeacher && onStudentRoute) {
      router.replace("/teacher");
      return;
    }
    if (!isTeacher && onTeacherRoute) {
      router.replace("/dashboard");
    }
  }, [ready, role, path, isSignedIn, userId, router]);

  return <>{children}</>;
}
