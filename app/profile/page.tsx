"use client";

import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { User } from "lucide-react";
import EyeFocusGuard from "@/components/EyeFocusGuard";
import {
  getParentPhone,
  setParentPhone,
  isFocusLockEnabled,
  setFocusLockEnabled,
} from "@/components/FocusLock";
import type { Grade } from "@/lib/curriculum";
import {
  hardResetUser,
  loadProgress,
  saveProgress,
  accuracy,
  weaknessMap,
  type UserProgress,
} from "@/lib/user-store";
import {
  getJoinedClass,
  getRole,
  joinClassroom,
  setJoinedClass,
  setRole,
} from "@/lib/teacher-store";

export default function ProfilePage() {
  const { user, isSignedIn } = useUser();
  const { userId } = useAuth();
  const [phone, setPhone] = useState("");
  const [grade, setGrade] = useState<Grade>("12");
  const [focusOn, setFocusOn] = useState(true);
  const [eyeGuard, setEyeGuard] = useState(false);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [classCode, setClassCode] = useState("");
  const [joined, setJoined] = useState<string | null>(null);
  const [classMsg, setClassMsg] = useState<string | null>(null);
  const [role, setRoleUi] = useState<"student" | "teacher">("student");

  useEffect(() => {
    setPhone(getParentPhone(userId));
    setFocusOn(isFocusLockEnabled());
    if (userId) {
      const p = loadProgress(userId);
      setProgress(p);
      setGrade(p.grade);
      setJoined(getJoinedClass(userId));
      setRoleUi(getRole(userId));
    }
  }, [userId]);

  const save = () => {
    setParentPhone(phone, userId);
    setFocusLockEnabled(focusOn);
    if (userId) {
      const p = loadProgress(userId);
      p.grade = grade;
      saveProgress(p);
      setProgress(p);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
        <User className="h-3.5 w-3.5" /> Student Profile
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Focus identity &amp; device permissions
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Each login has its own XP, mistakes, and plan. Camera powers the 30s
        eye-focus alarm.
      </p>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-slate-600">
          <div>
            <span className="font-semibold text-slate-900">Signed in: </span>
            {isSignedIn
              ? user?.primaryEmailAddress?.emailAddress || user?.fullName
              : "Not signed in"}
          </div>
          <div className="mt-1">
            <span className="font-semibold text-slate-900">Name: </span>
            {user?.fullName || "—"}
          </div>
          {progress && (
            <div className="mt-1 text-xs text-slate-500">
              XP {progress.xp} · Streak {progress.streak}d · Mistakes{" "}
              {progress.mistakes.length} · Account data since{" "}
              {new Date(progress.createdAt).toLocaleDateString()}
            </div>
          )}
        </div>

        <label className="mt-5 block text-sm font-semibold text-slate-700">
          Class
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value as Grade)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="10">Class 10</option>
            <option value="11">Class 11</option>
            <option value="12">Class 12</option>
          </select>
        </label>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Parent WhatsApp number
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="9876543210"
          />
        </label>

        <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
          <div className="text-sm font-bold text-violet-900">
            Classroom / Teacher link
          </div>
          <p className="mt-1 text-[11px] text-violet-700/80">
            Enter the 6-letter code from your teacher so they can see your
            progress, mistakes, and weak subjects.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={classCode}
              onChange={(e) => setClassCode(e.target.value.toUpperCase())}
              placeholder="CLASS CODE"
              className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-mono tracking-widest"
              maxLength={8}
            />
            <button
              type="button"
              onClick={() => {
                if (!userId) return;
                const p = loadProgress(userId);
                const res = joinClassroom(classCode.trim(), {
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
                  recentMistakes: p.mistakes.slice(0, 5).map((m) => ({
                    subjectName: m.subjectName,
                    chapterTitle: m.chapterTitle,
                    prompt: m.prompt,
                    at: m.at,
                  })),
                });
                if (!res.ok) {
                  setClassMsg(res.error || "Failed");
                  return;
                }
                setJoinedClass(userId, classCode.trim());
                setJoined(classCode.trim().toUpperCase());
                setClassMsg(`Joined ${res.classroom?.name || "class"}`);
              }}
              className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white"
            >
              Join class
            </button>
          </div>
          {joined && (
            <p className="mt-2 text-xs font-semibold text-emerald-700">
              Joined: {joined}
            </p>
          )}
          {classMsg && (
            <p className="mt-1 text-xs text-slate-600">{classMsg}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (!userId) return;
                setRole(userId, "student");
                setRoleUi("student");
              }}
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                role === "student"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              I am a student
            </button>
            <button
              type="button"
              onClick={() => {
                if (!userId) return;
                setRole(userId, "teacher");
                setRoleUi("teacher");
              }}
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                role === "teacher"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              I am a teacher
            </button>
            {role === "teacher" && (
              <a
                href="/teacher"
                className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-700 ring-1 ring-indigo-100"
              >
                Open Teacher Hub →
              </a>
            )}
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={focusOn}
            onChange={(e) => setFocusOn(e.target.checked)}
          />
          Focus Lock (tab switch → parent WhatsApp)
        </label>

        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={eyeGuard}
            onChange={(e) => setEyeGuard(e.target.checked)}
          />
          Enable camera + mic eye-focus alarm (allow permission when asked)
        </label>
        <p className="mt-1 text-[11px] text-slate-400">
          Works best in Chrome. Keep face lit and centered. Closed eyes / looking
          away ~30s triggers alarm.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={save}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white"
          >
            Save profile
          </button>
          {userId && (
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "Reset ALL progress for this account on this device? (XP, mistakes, quizzes)"
                  )
                ) {
                  setProgress(hardResetUser(userId));
                }
              }}
              className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700"
            >
              Fresh start
            </button>
          )}
        </div>
        {saved && (
          <span className="ml-1 mt-2 inline-block text-xs font-semibold text-emerald-600">
            Saved
          </span>
        )}
      </div>

      <div className="mt-6">
        <EyeFocusGuard enabled={eyeGuard} />
      </div>
    </div>
  );
}
