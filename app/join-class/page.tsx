"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import { CheckCircle2, Link2, School } from "lucide-react";
import {
  getClassroom,
  getJoinedClass,
  getRole,
  joinClassroom,
  setJoinedClass,
} from "@/lib/teacher-store";
import {
  accuracy,
  loadProgress,
  weaknessMap,
} from "@/lib/user-store";

export default function JoinClassPage() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();
  const [code, setCode] = useState("");
  const [joined, setJoined] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [className, setClassName] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (getRole(userId) === "teacher") return;
    const j = getJoinedClass(userId);
    setJoined(j);
    if (j) {
      const c = getClassroom(j);
      setClassName(c?.name || null);
    }
  }, [userId]);

  if (!isSignedIn || !userId) {
    return (
      <div className="px-6 py-16 text-center text-sm text-slate-500">
        Sign in first, then enter your teacher&apos;s private class code.
      </div>
    );
  }

  if (getRole(userId) === "teacher") {
    return (
      <div className="px-6 py-16 text-center text-sm text-slate-500">
        You are in <strong>Teacher mode</strong>. Switch to student in Profile if
        you need to join a class.
        <div className="mt-3">
          <Link href="/teacher" className="font-bold text-indigo-600 underline">
            Open Teacher Hub
          </Link>
        </div>
      </div>
    );
  }

  const join = () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setMsg("Enter the full private code from your teacher.");
      return;
    }
    const p = loadProgress(userId);
    const res = joinClassroom(trimmed, {
      studentId: userId,
      name: user?.fullName || user?.firstName || "Student",
      email: user?.primaryEmailAddress?.emailAddress,
      grade: p.grade,
      xp: p.xp,
      streak: p.streak,
      accuracy: accuracy(p),
      mistakes: p.mistakes.length,
      weakSubjects: weaknessMap(p).map(([n]) => n),
      chaptersOpened: p.chaptersOpened.length,
      lastActive: Date.now(),
      recentMistakes: p.mistakes.slice(0, 8).map((m) => ({
        subjectName: m.subjectName,
        chapterTitle: m.chapterTitle,
        prompt: m.prompt,
        at: m.at,
      })),
    });
    if (!res.ok) {
      setMsg(res.error || "Invalid code");
      return;
    }
    setJoinedClass(userId, trimmed);
    setJoined(trimmed);
    setClassName(res.classroom?.name || "Class");
    setMsg(null);
  };

  const leave = () => {
    setJoinedClass(userId, null);
    setJoined(null);
    setClassName(null);
    setMsg("Left classroom. Teacher no longer receives your live updates.");
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        <Link2 className="h-3.5 w-3.5" /> Join Teacher
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Connect with your teacher
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Your teacher gives you a <strong>private 6-letter code</strong>. After
        you join, they can see your study activity, weak subjects, and mistakes —
        only that teacher, only that code.
      </p>

      {joined ? (
        <div className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <p className="mt-3 text-lg font-bold text-emerald-900">
            Connected to {className || "class"}
          </p>
          <p className="mt-1 font-mono text-2xl font-black tracking-widest text-emerald-800">
            {joined}
          </p>
          <p className="mt-2 text-xs text-emerald-700">
            Your progress syncs automatically while you study on this device.
          </p>
          <button
            type="button"
            onClick={leave}
            className="mt-4 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-800"
          >
            Leave class
          </button>
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-semibold text-slate-700">
            <School className="mr-1 inline h-4 w-4 text-violet-600" />
            Teacher&apos;s private code
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={8}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.35em] text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
          />
          <button
            type="button"
            onClick={join}
            className="mt-4 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-md shadow-violet-600/25 hover:bg-violet-500"
          >
            Join &amp; share my progress
          </button>
          {msg && (
            <p className="mt-3 text-center text-xs font-medium text-rose-600">
              {msg}
            </p>
          )}
        </div>
      )}

      <ol className="mt-8 list-decimal space-y-2 pl-5 text-xs text-slate-500">
        <li>Teacher opens Teacher Hub and creates a class → gets a code.</li>
        <li>Teacher shares only that code with their students.</li>
        <li>You enter the code here once.</li>
        <li>Teacher sees your XP, accuracy, weak subjects, and mistake history.</li>
      </ol>
    </div>
  );
}
