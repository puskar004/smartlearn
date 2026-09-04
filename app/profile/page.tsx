"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { User } from "lucide-react";
import EyeFocusGuard from "@/components/EyeFocusGuard";
import {
  getParentPhone,
  setParentPhone,
  isFocusLockEnabled,
  setFocusLockEnabled,
} from "@/components/FocusLock";
import type { Grade } from "@/lib/curriculum";

const GRADE_KEY = "sl_grade";

export default function ProfilePage() {
  const { user, isSignedIn } = useUser();
  const [phone, setPhone] = useState("");
  const [grade, setGrade] = useState<Grade>("12");
  const [focusOn, setFocusOn] = useState(true);
  const [eyeGuard, setEyeGuard] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPhone(getParentPhone());
    setFocusOn(isFocusLockEnabled());
    const g = localStorage.getItem(GRADE_KEY) as Grade | null;
    if (g) setGrade(g);
  }, []);

  const save = () => {
    setParentPhone(phone);
    setFocusLockEnabled(focusOn);
    localStorage.setItem(GRADE_KEY, grade);
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
        Camera + microphone power the eye-focus alarm. Parent number powers
        WhatsApp tab-switch alerts.
      </p>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-sm text-slate-600">
          <div>
            <span className="font-semibold text-slate-900">Signed in: </span>
            {isSignedIn
              ? user?.primaryEmailAddress?.emailAddress || user?.fullName
              : "Not signed in — Sign In from the header"}
          </div>
          <div className="mt-1">
            <span className="font-semibold text-slate-900">Name: </span>
            {user?.fullName || "—"}
          </div>
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
          Enable camera + mic eye-focus alarm
        </label>

        <button
          type="button"
          onClick={save}
          className="mt-6 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white"
        >
          Save profile
        </button>
        {saved && (
          <span className="ml-3 text-xs font-semibold text-emerald-600">
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
