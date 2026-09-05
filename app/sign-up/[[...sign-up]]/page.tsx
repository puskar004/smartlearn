"use client";

import { Suspense, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { smartLearnAppearance } from "@/lib/clerk-appearance";
import {
  getPendingRole,
  setPendingRole,
  type AppRole,
} from "@/lib/pending-role";

function SignUpInner() {
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
          : "bg-gradient-to-b from-violet-50 to-fuchsia-50"
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
          {isTeacher ? "Create teacher account" : "Create student account"}
        </h1>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          {isTeacher
            ? "You’re registering as a SmartLearn Teacher. We’ll email an OTP from SmartLearn to verify you. A new private class code is created every time you sign in."
            : "You’re registering as a SmartLearn Student. We’ll email an OTP from SmartLearn to verify your email."}
        </p>
        <div
          className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${
            isTeacher
              ? "bg-indigo-100 text-indigo-800"
              : "bg-violet-100 text-violet-800"
          }`}
        >
          Signing up as {isTeacher ? "TEACHER" : "STUDENT"}
        </div>
      </div>

      <SignUp
        appearance={smartLearnAppearance}
        routing="path"
        path="/sign-up"
        signInUrl={`/sign-in?role=${role}`}
        fallbackRedirectUrl={isTeacher ? "/teacher" : "/dashboard"}
        forceRedirectUrl={isTeacher ? "/teacher" : "/dashboard"}
      />

      <p className="mt-6 text-center text-xs text-slate-400">
        OTP arrives from <strong>SmartLearn</strong>.{" "}
        <Link href="/login" className="font-semibold text-violet-600 underline">
          Change role
        </Link>
      </p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm">Loading…</div>}>
      <SignUpInner />
    </Suspense>
  );
}
