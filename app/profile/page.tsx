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
  type UserProgress,
} from "@/lib/user-store";
import { getJoinedClass, getRole, setRole } from "@/lib/teacher-store";
import { emitRoleChanged } from "@/lib/role-events";

export default function ProfilePage() {
  const { user, isSignedIn } = useUser();
  const { userId } = useAuth();
  const [phone, setPhone] = useState("");
  const [grade, setGrade] = useState<Grade>("12");
  const [focusOn, setFocusOn] = useState(true);
  const [eyeGuard, setEyeGuard] = useState(false);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [joined, setJoined] = useState<string | null>(null);
  const [classMsg] = useState<string | null>(null);
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
      p.gradeChosen = true;
      saveProgress(p);
      setProgress(p);
      try {
        window.dispatchEvent(new Event("sl-grade-changed"));
      } catch {
        // ignore
      }
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
          <div className="text-sm font-bold text-violet-900">Who are you?</div>
          <p className="mt-1 text-[11px] text-violet-700/80">
            Teacher mode shows only teacher tools (students, uploads, live).
            Student mode shows study tools only.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (!userId) return;
                setRole(userId, "student");
                setRoleUi("student");
                emitRoleChanged();
                window.location.href = "/dashboard";
              }}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
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
                emitRoleChanged();
                window.location.href = "/teacher";
              }}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                role === "teacher"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              I am a teacher
            </button>
          </div>
          {role === "student" && (
            <div className="mt-4 border-t border-violet-100 pt-3">
              <div className="text-xs font-bold text-violet-900">
                Teacher class code
              </div>
              {joined ? (
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  Linked: {joined}{" "}
                  <a href="/join-class" className="underline">
                    manage
                  </a>
                </p>
              ) : (
                <a
                  href="/join-class"
                  className="mt-2 inline-flex rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white"
                >
                  Enter teacher code →
                </a>
              )}
            </div>
          )}
          {role === "teacher" && (
            <a
              href="/teacher?tab=code"
              className="mt-3 inline-flex text-xs font-bold text-indigo-700 underline"
            >
              Open Teacher Hub / Class code →
            </a>
          )}
          {classMsg && (
            <p className="mt-2 text-xs text-slate-600">{classMsg}</p>
          )}
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={focusOn}
            onChange={(e) => setFocusOn(e.target.checked)}
          />
          Focus Lock during Live Test only (tab switch warning)
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
          {userId && (
            <button
              type="button"
              onClick={() => {
                if (
                  !confirm(
                    "Delete local SmartLearn data for this account on this device? You will stay signed in with Clerk — open Clerk account menu to fully delete the login."
                  )
                )
                  return;
                try {
                  hardResetUser(userId);
                  const keys: string[] = [];
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.includes(userId)) keys.push(k);
                  }
                  keys.forEach((k) => localStorage.removeItem(k));
                  setProgress(null);
                  alert(
                    "Local data cleared. Use the user menu (top) → Manage account → Delete account to remove your login permanently."
                  );
                  window.location.href = "/";
                } catch {
                  alert("Could not clear data.");
                }
              }}
              className="rounded-xl border border-rose-600 bg-rose-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              Delete account data
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
