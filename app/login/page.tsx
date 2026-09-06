"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  GraduationCap,
  BookOpen,
  ArrowRight,
  Shield,
  ChevronLeft,
} from "lucide-react";
import {
  setPendingGrade,
  setPendingRole,
  type AppRole,
  type PendingGrade,
} from "@/lib/pending-role";
import { getRole } from "@/lib/teacher-store";

type Step = "role" | "grade";

export default function LoginChooserPage() {
  const { isSignedIn, userId, isLoaded } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("role");
  const [picked, setPicked] = useState<AppRole | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && userId) {
      const role = getRole(userId);
      router.replace(role === "teacher" ? "/teacher" : "/dashboard");
    }
  }, [isLoaded, isSignedIn, userId, router]);

  const goTeacher = () => {
    setPendingRole("teacher");
    setPicked("teacher");
    router.push("/sign-in?role=teacher");
  };

  const goStudent = () => {
    setPendingRole("student");
    setStep("grade");
  };

  const goGrade = (g: PendingGrade) => {
    setPendingRole("student");
    setPendingGrade(g);
    setPicked("student");
    router.push(`/sign-in?role=student&grade=${g}`);
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_20%_0%,rgba(99,102,241,0.2),transparent_55%),radial-gradient(700px_400px_at_90%_20%,rgba(236,72,153,0.15),transparent_50%)]" />

      <div className="relative w-full max-w-3xl">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/smartlearn-logo.svg"
            alt="SmartLearn"
            className="mx-auto h-14 w-14 rounded-2xl shadow-lg shadow-violet-500/30"
          />
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Welcome to SmartLearn
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {step === "role"
              ? "Choose how you want to continue. Sign in with email OTP."
              : "Select your class — NCERT, quizzes & plan will match it."}
          </p>
        </div>

        {step === "role" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={goStudent}
              disabled={Boolean(picked)}
              className="group rounded-3xl border border-violet-100 bg-white/90 p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-500/15 disabled:opacity-60"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30 transition group-hover:scale-105">
                <BookOpen className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-xl font-extrabold text-slate-900">
                Login as Student
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Next: pick Class 10 / 11 / 12, then OTP login.
              </p>
              <div className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-violet-700">
                Continue{" "}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </button>

            <button
              type="button"
              onClick={goTeacher}
              disabled={Boolean(picked)}
              className="group rounded-3xl border border-indigo-100 bg-white/90 p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/15 disabled:opacity-60"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-600 text-white shadow-lg shadow-indigo-500/30 transition group-hover:scale-105">
                <GraduationCap className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-xl font-extrabold text-slate-900">
                Login as Teacher
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Class code, live tests, Meet sessions — students never see this.
              </p>
              <div className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-indigo-700">
                Continue{" "}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </div>
            </button>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setStep("role")}
              className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-violet-700"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  { g: "10" as const, blurb: "Board basics" },
                  { g: "11" as const, blurb: "Foundation year" },
                  { g: "12" as const, blurb: "Board year" },
                ] as const
              ).map((item) => (
                <button
                  key={item.g}
                  type="button"
                  onClick={() => goGrade(item.g)}
                  disabled={Boolean(picked)}
                  className="rounded-3xl border border-violet-100 bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:border-violet-400 hover:shadow-xl disabled:opacity-60"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 text-2xl font-black text-white shadow-lg">
                    {item.g}
                  </div>
                  <div className="mt-4 text-lg font-extrabold text-slate-900">
                    Class {item.g}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{item.blurb}</div>
                  <div className="mt-4 text-sm font-bold text-violet-700">
                    Continue →
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
          <Shield className="h-3.5 w-3.5" />
          Email OTP from SmartLearn. Class filters your NCERT & quizzes.
        </p>

        <p className="mt-4 text-center text-xs text-slate-400">
          <Link href="/" className="font-semibold text-violet-600 hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
