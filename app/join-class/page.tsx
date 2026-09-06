"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  School,
  Video,
} from "lucide-react";
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
import { accuracy, loadProgress, weaknessMap } from "@/lib/user-store";

type JoinedRoom = {
  code: string;
  name: string;
  teacherName?: string;
  materials?: TeacherMaterial[];
};

function openMaterial(m: TeacherMaterial) {
  const u = (m.url || "").trim();
  if (!u) {
    alert("No file link. Ask teacher to re-upload.");
    return;
  }
  if (u.startsWith("data:")) {
    try {
      const a = document.createElement("a");
      a.href = u;
      a.download = `${m.title || "notes"}.pdf`;
      a.click();
      const w = window.open();
      if (w) {
        w.document.write(
          `<!doctype html><title>${m.title || "PDF"}</title><iframe src="${u}" style="position:fixed;inset:0;border:0;width:100%;height:100%"></iframe>`
        );
      }
    } catch {
      window.open(u, "_blank");
    }
    return;
  }
  window.open(u, "_blank", "noopener,noreferrer");
}

export default function JoinClassPage() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();
  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState<JoinedRoom[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch("/api/classroom?action=joined", {
        cache: "no-store",
      });
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
    } finally {
      setFetching(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (getRole(userId) === "teacher") return;
    void refresh();
  }, [userId, refresh]);

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

  const totalNotes = rooms.reduce(
    (n, r) => n + (r.materials?.length || 0),
    0
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        <Link2 className="h-3.5 w-3.5" /> Join Teacher
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Your classes &amp; notes
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Join with a class code. Teacher PDFs and notes appear under each class
        below.
      </p>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700">
          <School className="mr-1 inline h-4 w-4 text-violet-600" />
          Teacher class code
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

      {fetching ? (
        <div className="mt-10 flex justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No class joined yet. Enter the code your teacher shared.
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              Joined classes
            </h2>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
              {totalNotes} note{totalNotes === 1 ? "" : "s"}
            </span>
          </div>

          {rooms.map((r) => {
            const mats = r.materials || [];
            return (
              <div
                key={r.code}
                className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm"
              >
                <div className="border-b border-emerald-50 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-base font-extrabold text-emerald-950">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        {r.name || r.code}
                      </div>
                      <div className="mt-1 font-mono text-sm font-bold tracking-widest text-emerald-800">
                        {r.code}
                      </div>
                      {r.teacherName && (
                        <div className="mt-0.5 text-xs text-emerald-700">
                          Teacher: {r.teacherName}
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

                {/* Teacher notes / PDFs under each class */}
                <div className="px-4 py-4 sm:px-5">
                  <div className="mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Teacher notes &amp; PDFs
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      {mats.length}
                    </span>
                  </div>

                  {mats.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-xs text-slate-500">
                      No notes yet. When your teacher uploads a PDF or link,
                      it will show here.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {mats.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 px-3 py-3 transition hover:border-indigo-200 hover:bg-indigo-50/40"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
                            {m.type === "video" ? (
                              <Video className="h-5 w-5 text-rose-500" />
                            ) : (
                              <BookOpen className="h-5 w-5 text-indigo-600" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-slate-900">
                              {m.title}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              <span className="font-semibold text-indigo-700">
                                {m.subject || "General"}
                              </span>
                              {" · "}
                              {m.type === "video"
                                ? "Video"
                                : m.type === "link"
                                  ? "Link"
                                  : "PDF / Notes"}
                              {m.teacherName ? ` · ${m.teacherName}` : ""}
                              {m.createdAt
                                ? ` · ${new Date(m.createdAt).toLocaleDateString()}`
                                : ""}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => openMaterial(m)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm hover:bg-indigo-500"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
