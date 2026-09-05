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

export default function ProfilePage() {
  const { user, isSignedIn } = useUser();
  const { userId } = useAuth();
  const [phone, setPhone] = useState("");
  const [grade, setGrade] = useState<Grade>("12");
  const [focusOn, setFocusOn] = useState(true);
  const [eyeGuard, setEyeGuard] = useState(false);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState<UserProgress | null>(null);

  useEffect(() => {
    setPhone(getParentPhone(userId));
    setFocusOn(isFocusLockEnabled());
    if (userId) {
      const p = loadProgress(userId);
      setProgress(p);
      setGrade(p.grade);
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
