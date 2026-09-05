"use client";

import { Suspense, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { smartLearnAppearance } from "@/lib/clerk-appearance";
import {
  getPendingRole,
  setPendingRole,
  type AppRole,
} from "@/lib/pending-role";

function SignInInner() {
  const sp = useSearchParams();
  const roleParam = sp.get("role") as AppRole | null;

  useEffect(() => {
    if (roleParam === "student" || roleParam === "teacher") {
      setPendingRole(roleParam);
    }
  }, [roleParam]);

  const role = useMemo(() => {
    return roleParam === "teacher" || roleParam === "student"
      ? roleParam
      : getPendingRole() || "student";
  }, [roleParam]);

  const isTeacher = role === "teacher";

  return (
    <div
      className={`flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-12 ${
        isTeacher
          ? "bg-gradient-to-b from-indigo-50 to-sky-50"
          : "bg-gradient-to-b from-violet-50 to-indigo-50"
      }`}
    >
      <div className="mb-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/smartlearn-logo.svg"
          alt="SmartLearn"
          className="mx-auto h-14 w-14 rounded-2xl shadow-lg shadow-violet-500/25"
        />
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
          {isTeacher ? "Teacher sign-in" : "Student sign-in"}
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          {isTeacher
            ? "Welcome, Teacher. Enter your email — SmartLearn will send a secure OTP. After login you’ll get a fresh private class code for your students."
            : "Welcome, Student. Enter your email — SmartLearn will send a secure OTP so you can continue learning."}
        </p>
        <div
          className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${
            isTeacher
              ? "bg-indigo-100 text-indigo-800"
              : "bg-violet-100 text-violet-800"
          }`}
        >
          Signing in as {isTeacher ? "TEACHER" : "STUDENT"}
        </div>
      </div>

      <SignIn
        appearance={smartLearnAppearance}
        routing="path"
        path="/sign-in"
        signUpUrl={`/sign-up?role=${role}`}
        fallbackRedirectUrl={isTeacher ? "/teacher" : "/dashboard"}
        forceRedirectUrl={isTeacher ? "/teacher" : "/dashboard"}
      />

      <p className="mt-6 text-center text-xs text-slate-400">
        OTP email is from <strong>SmartLearn</strong>. Wrong role?{" "}
        <Link href="/login" className="font-semibold text-violet-600 underline">
          Choose again
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm">Loading…</div>}>
      <SignInInner />
    </Suspense>
  );
}
