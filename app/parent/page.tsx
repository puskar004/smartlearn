"use client";

import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { MessageCircle, Shield } from "lucide-react";
import {
  getParentPhone,
  setParentPhone,
  isFocusLockEnabled,
  setFocusLockEnabled,
} from "@/components/FocusLock";
import {
  accuracy,
  loadProgress,
  type UserProgress,
} from "@/lib/user-store";

export default function ParentPortalPage() {
  const { user } = useUser();
  const { userId, isSignedIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [focusOn, setFocusOn] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [p, setP] = useState<UserProgress | null>(null);

  useEffect(() => {
    setPhone(getParentPhone(userId));
    setFocusOn(isFocusLockEnabled());
    if (userId) setP(loadProgress(userId));
  }, [userId]);

  const save = () => {
    setParentPhone(phone, userId);
    setFocusLockEnabled(focusOn);
    setStatus("Parent settings saved for this student account.");
  };

  const acc = p ? accuracy(p) : null;
  const hours = p ? (p.focusMinutes / 60).toFixed(1) : "0.0";
  const hasContact = Boolean(phone && phone.replace(/\D/g, "").length >= 10);

  const sendSummary = async () => {
    const res = await fetch("/api/parent-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        studentName: user?.fullName || "Student",
        reason: "weekly_summary",
        stats: {
          hours,
          accuracy: acc,
          xp: p?.xp ?? 0,
          streak: p?.streak ?? 0,
          mistakes: p?.mistakes.length ?? 0,
        },
      }),
    });
    const data = await res.json();
    if (data.waLink) window.open(data.waLink, "_blank", "noopener,noreferrer");
    setStatus("WhatsApp summary link opened with real stats.");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        <Shield className="h-3.5 w-3.5" /> Parent Portal
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Accountability that reaches WhatsApp
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Numbers below are from <strong>this student account only</strong>. New
        login starts at zero — no sample data.
      </p>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700">
          Parent WhatsApp mobile number
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit Indian mobile"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </label>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={focusOn}
            onChange={(e) => setFocusOn(e.target.checked)}
          />
          Enable Focus Lock tab-switch alerts
        </label>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={save}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
          >
            Save settings
          </button>
          <button
            type="button"
            onClick={sendSummary}
            disabled={!isSignedIn}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <MessageCircle className="h-4 w-4" />
            Send WhatsApp Summary Now
          </button>
        </div>
        {status && (
          <p className="mt-3 text-xs font-medium text-emerald-700">{status}</p>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card
          title="Focus Study Time"
          value={`${hours} h`}
          sub="This account (tracked minutes)"
        />
        <Card
          title="Quiz accuracy"
          value={acc != null ? `${acc}%` : "0%"}
          sub={
            p?.quizResults.length
              ? `${p.quizResults.length} quizzes logged`
              : "No quizzes yet"
          }
        />
        <Card
          title="Parent WhatsApp"
          value={hasContact ? "Active" : "Not set"}
          sub={hasContact ? "Number saved in Profile" : "Add number above"}
        />
      </div>
    </div>
  );
}

function Card({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-extrabold text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-400">{sub}</div>
    </div>
  );
}
