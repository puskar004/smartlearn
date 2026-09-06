"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Loader2, MessageCircle } from "lucide-react";
import { apiGetRemarks } from "@/lib/teacher-store";
import type { TeacherRemark } from "@/lib/classroom-types";

export default function RemarksPage() {
  const { userId, isSignedIn } = useAuth();
  const [remarks, setRemarks] = useState<TeacherRemark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      try {
        const data = await apiGetRemarks();
        setRemarks((data.remarks || []) as TeacherRemark[]);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [userId]);

  if (!isSignedIn) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Sign in to see teacher remarks.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
        <MessageCircle className="h-3.5 w-3.5" /> Teacher remarks
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Feedback from teachers
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        When your teacher sends a remark from Teacher Hub, it appears here and
        as a notification.
      </p>

      {loading ? (
        <div className="mt-10 flex justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : remarks.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No remarks yet.
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {remarks.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <span className="font-bold text-indigo-800">{r.from}</span>
                <span>{new Date(r.at).toLocaleString()}</span>
              </div>
              {(r.className || r.classCode) && (
                <div className="mt-1 text-[11px] font-semibold text-slate-500">
                  {r.className || r.classCode}
                </div>
              )}
              <p className="mt-2 text-sm leading-relaxed text-slate-800">
                {r.text}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
