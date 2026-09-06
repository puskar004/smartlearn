"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import { CheckCircle2, Link2, Loader2, School } from "lucide-react";
import {
  apiJoinClassroom,
  apiLeaveClassroom,
  getJoinedClasses,
  getRole,
  removeJoinedClass,
  setJoinedClass,
  setJoinedClasses,
  type TeacherMaterial,
} from "@/lib/teacher-store";
import {
  accuracy,
  loadProgress,
  weaknessMap,
} from "@/lib/user-store";

type JoinedRoom = {
  code: string;
  name: string;
  teacherName?: string;
  materials?: TeacherMaterial[];
};

export default function JoinClassPage() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();
  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState<JoinedRoom[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!userId) return;
    try {
      const res = await fetch("/api/classroom?action=joined");
      const d = await res.json();
      const list = (d.classrooms || []) as JoinedRoom[];
      const codes = (d.codes || list.map((r) => r.code)) as string[];
      if (codes.length) setJoinedClasses(userId, codes);
      setRooms(
        list.length
          ? list
          : codes.map((c) => ({ code: c, name: c, materials: [] }))
      );
    } catch {
      const local = getJoinedClasses(userId);
      setRooms(local.map((c) => ({ code: c, name: c, materials: [] })));
    }
  };

  useEffect(() => {
    if (!userId) return;
    if (getRole(userId) === "teacher") return;
    void refresh();
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

  const join = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setMsg("Enter the full private code from your teacher (6 characters).");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const p = loadProgress(userId);
      const res = await apiJoinClassroom(trimmed, {
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
      setCode("");
      setMsg(`Joined ${res.classroom?.name || trimmed}`);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Join failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const leave = async (c: string) => {
    setLoading(true);
    try {
      await apiLeaveClassroom(c);
      removeJoinedClass(userId, c);
      setMsg(`Left ${c}`);
      await refresh();
    } catch {
      setMsg("Could not leave class. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const allMaterials = rooms.flatMap((r) =>
    (r.materials || []).map((m) => ({ ...m, className: r.name, classCode: r.code }))
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        <Link2 className="h-3.5 w-3.5" /> Join Teacher
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Connect with teachers
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Join <strong>multiple</strong> teacher codes. Materials and live alerts
        come from every joined class.
      </p>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700">
          <School className="mr-1 inline h-4 w-4 text-violet-600" />
          Add another teacher code
        </label>
        <input
          value={code}
          onChange={(e) =>
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") void join();
          }}
          placeholder="ABC123"
          maxLength={8}
          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.35em] text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
        />
        <button
          type="button"
          onClick={() => void join()}
          disabled={loading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-md shadow-violet-600/25 hover:bg-violet-500 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Join class
        </button>
        {msg && (
          <p className="mt-3 text-center text-xs font-medium text-emerald-700">
            {msg}
          </p>
        )}
      </div>

      {rooms.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-800">Your classes</h2>
          {rooms.map((r) => (
            <div
              key={r.code}
              className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-900">
                    <CheckCircle2 className="h-4 w-4" />
                    {r.name || r.code}
                  </div>
                  <div className="font-mono text-lg font-black tracking-widest text-emerald-800">
                    {r.code}
                  </div>
                  {r.teacherName && (
                    <div className="text-[11px] text-emerald-700">
                      {r.teacherName}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link
                    href="/live-class"
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white"
                  >
                    Live
                  </Link>
                  <button
                    type="button"
                    onClick={() => void leave(r.code)}
                    disabled={loading}
                    className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800 disabled:opacity-60"
                  >
                    Leave
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {allMaterials.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">
            Teacher materials
          </h2>
          <ul className="mt-3 space-y-2">
            {allMaterials.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-800">{m.title}</div>
                  <div className="text-[10px] text-slate-400">
                    {m.subject} · {m.type}
                    {"className" in m && m.className
                      ? ` · ${String(m.className)}`
                      : ""}
                  </div>
                </div>
                <a
                  href={m.url}
                  target={m.url.startsWith("data:") ? undefined : "_blank"}
                  rel="noreferrer"
                  download={
                    m.url.startsWith("data:")
                      ? `${m.title || "notes"}.pdf`
                      : undefined
                  }
                  className="shrink-0 font-bold text-indigo-600 hover:underline"
                >
                  {m.url.startsWith("data:") ? "Download" : "Open"}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="mt-8 list-decimal space-y-2 pl-5 text-xs text-slate-500">
        <li>Teacher shares a private code from Teacher Hub.</li>
        <li>You can join several teachers at once.</li>
        <li>Uploads and live sessions notify you with subject.</li>
      </ol>
    </div>
  );
}
