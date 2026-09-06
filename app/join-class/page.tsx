"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import { CheckCircle2, Link2, Loader2, School } from "lucide-react";
import {
  apiJoinClassroom,
  apiLeaveClassroom,
  getJoinedClass,
  getRole,
  setJoinedClass,
  type TeacherMaterial,
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
  const [materials, setMaterials] = useState<TeacherMaterial[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (getRole(userId) === "teacher") return;
    const j = getJoinedClass(userId);
    setJoined(j);
    void fetch(`/api/classroom?action=joined`)
      .then((r) => r.json())
      .then((d) => {
        if (d.classroom?.name) setClassName(d.classroom.name);
        if (d.joined) {
          setJoined(d.joined);
          setJoinedClass(userId, d.joined);
        }
        setMaterials((d.classroom?.materials || []) as TeacherMaterial[]);
      })
      .catch(() => null);
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
      setJoined(trimmed);
      setClassName(res.classroom?.name || "Class");
      setMaterials((res.classroom?.materials || []) as TeacherMaterial[]);
      setMsg(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Join failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const leave = async () => {
    setLoading(true);
    try {
      await apiLeaveClassroom();
      setJoinedClass(userId, null);
      setJoined(null);
      setClassName(null);
      setMaterials([]);
      setMsg("Left classroom.");
    } catch {
      setMsg("Could not leave class. Try again.");
    } finally {
      setLoading(false);
    }
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
        Enter the <strong>private code</strong> your teacher shared. Works from
        any phone/laptop — not only the same device.
      </p>

      {joined ? (
        <div className="mt-8 space-y-4">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="mt-3 text-lg font-bold text-emerald-900">
              Connected to {className || "class"}
            </p>
            <p className="mt-1 font-mono text-2xl font-black tracking-widest text-emerald-800">
              {joined}
            </p>
            <p className="mt-2 text-xs text-emerald-700">
              Your progress syncs to your teacher automatically.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link
                href="/live-class"
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white"
              >
                Live class
              </Link>
              <button
                type="button"
                onClick={() => void leave()}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-800 disabled:opacity-60"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Leave class
              </button>
            </div>
            {msg && (
              <p className="mt-2 text-xs font-medium text-emerald-800">{msg}</p>
            )}
          </div>
          {materials.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">
                Teacher materials
              </h2>
              <ul className="mt-3 space-y-2">
                {materials.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">
                        {m.title}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {m.subject} · {m.type}
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
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-semibold text-slate-700">
            <School className="mr-1 inline h-4 w-4 text-violet-600" />
            Teacher&apos;s private code
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
        <li>Teacher logs in as Teacher → gets a private code.</li>
        <li>Teacher shares that code with the class.</li>
        <li>You enter it here (any device).</li>
        <li>Teacher sees your XP, accuracy, weak subjects, mistakes.</li>
      </ol>
    </div>
  );
}
