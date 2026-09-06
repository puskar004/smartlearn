"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
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
    alert("No file link. Ask teacher to re-upload the PDF or paste a Drive link.");
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
  const [openMats, setOpenMats] = useState<Record<string, boolean>>({});

  const mergeRooms = useCallback(
    (apiList: JoinedRoom[], extraCodes: string[] = []) => {
      if (!userId) return;
      const local = getJoinedClasses(userId);
      const byCode = new Map<string, JoinedRoom>();

      for (const c of [...local, ...extraCodes]) {
        const code = c.toUpperCase();
        if (!code) continue;
        byCode.set(code, {
          code,
          name: `Class ${code}`,
          teacherName: "",
          materials: [],
        });
      }
      for (const r of apiList) {
        const code = (r.code || "").toUpperCase();
        if (!code) continue;
        const prev = byCode.get(code);
        byCode.set(code, {
          code,
          name: r.name || prev?.name || `Class ${code}`,
          teacherName: r.teacherName || prev?.teacherName || "",
          materials: r.materials?.length
            ? r.materials
            : prev?.materials || [],
        });
      }

      const next = Array.from(byCode.values());
      setRooms(next);
      if (next.length) {
        setJoinedClasses(
          userId,
          next.map((r) => r.code)
        );
        // default expand materials for each class
        setOpenMats((prev) => {
          const o = { ...prev };
          for (const r of next) {
            if (o[r.code] === undefined) o[r.code] = true;
          }
          return o;
        });
      }
    },
    [userId]
  );

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch("/api/classroom?action=joined", {
        cache: "no-store",
      });
      const d = await res.json();
      const list = (d.classrooms || []) as JoinedRoom[];
      const codes = (d.codes || []) as string[];

      // Extra fetch materials per code so notes always show
      const enriched: JoinedRoom[] = [];
      for (const r of list.length ? list : codes.map((c) => ({ code: c, name: c, materials: [] as TeacherMaterial[] }))) {
        try {
          const mr = await fetch(
            `/api/classroom?action=materials&code=${encodeURIComponent(r.code)}`,
            { cache: "no-store" }
          );
          const md = await mr.json();
          enriched.push({
            ...r,
            name: md.name || r.name,
            materials: (md.materials?.length ? md.materials : r.materials) || [],
          });
        } catch {
          enriched.push(r);
        }
      }
      mergeRooms(enriched, codes);
    } catch {
      mergeRooms([], getJoinedClasses(userId));
    } finally {
      setFetching(false);
    }
  }, [userId, mergeRooms]);

  useEffect(() => {
    if (!userId) return;
    if (getRole(userId) === "teacher") {
      setFetching(false);
      return;
    }
    // show local joins instantly
    mergeRooms([], getJoinedClasses(userId));
    setFetching(false);
    void refresh();
  }, [userId, refresh, mergeRooms]);

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

      const room = res.classroom;
      const roomCode = (room?.code || trimmed).toUpperCase();
      setJoinedClass(userId, roomCode);
      setCode("");
      setMsg(`You have joined ${room?.name || roomCode}`);

      // Show immediately under the form (don't wait for slow API)
      setRooms((prev) => {
        const others = prev.filter((r) => r.code !== roomCode);
        return [
          {
            code: roomCode,
            name: room?.name || `Class ${roomCode}`,
            teacherName: room?.teacherName || "",
            materials: (room?.materials || []) as TeacherMaterial[],
          },
          ...others,
        ];
      });
      setOpenMats((p) => ({ ...p, [roomCode]: true }));

      // Then refresh from server for full materials
      window.setTimeout(() => void refresh(), 800);
      window.setTimeout(() => void refresh(), 2500);
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
      setRooms((prev) => prev.filter((r) => r.code !== c.toUpperCase()));
      setMsg(`Left ${c}`);
      await refresh();
    } catch {
      setMsg("Could not leave class. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        <Link2 className="h-3.5 w-3.5" /> Join Teacher
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Join class &amp; see notes
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Enter the code. Your joined class appears below with teacher PDFs.
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
          <p className="mt-3 text-center text-sm font-semibold text-emerald-700">
            {msg}
          </p>
        )}
      </div>

      {fetching && rooms.length === 0 ? (
        <div className="mt-10 flex justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No class joined yet. Enter the code your teacher shared.
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-extrabold text-slate-900">
            You have joined {rooms.length} class
            {rooms.length > 1 ? "es" : ""}
          </h2>

          {rooms.map((r) => {
            const mats = r.materials || [];
            const open = openMats[r.code] !== false;
            return (
              <div
                key={r.code}
                className="overflow-hidden rounded-3xl border-2 border-emerald-200 bg-white shadow-md"
              >
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-4 text-white sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-100">
                        You have joined this class
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xl font-black">
                        <CheckCircle2 className="h-6 w-6" />
                        {r.name || r.code}
                      </div>
                      <div className="mt-1 font-mono text-sm font-bold tracking-[0.2em] text-emerald-50">
                        {r.code}
                      </div>
                      {r.teacherName && (
                        <div className="mt-1 text-xs text-emerald-50">
                          Teacher: {r.teacherName}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/live-class"
                        className="rounded-lg bg-white/20 px-3 py-1.5 text-[11px] font-bold text-white ring-1 ring-white/40 hover:bg-white/30"
                      >
                        Live class
                      </Link>
                      <button
                        type="button"
                        onClick={() => void leave(r.code)}
                        disabled={loading}
                        className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800 disabled:opacity-60"
                      >
                        Leave
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setOpenMats((p) => ({ ...p, [r.code]: !open }))
                  }
                  className="flex w-full items-center justify-between gap-2 border-b border-slate-100 bg-indigo-50/80 px-4 py-3 text-left sm:px-5"
                >
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-indigo-900">
                    <FileText className="h-4 w-4" />
                    See materials
                    <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      {mats.length}
                    </span>
                  </span>
                  {open ? (
                    <ChevronUp className="h-4 w-4 text-indigo-700" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-indigo-700" />
                  )}
                </button>

                {open && (
                  <div className="px-4 py-4 sm:px-5">
                    <p className="mb-3 text-xs text-slate-500">
                      PDFs, notes and links uploaded by your teacher for this
                      class.
                    </p>
                    {mats.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
                        No materials yet. When teacher uploads a PDF, it will
                        appear here. Pull to refresh or reopen this page.
                        <button
                          type="button"
                          onClick={() => void refresh()}
                          className="mt-3 block w-full text-xs font-bold text-indigo-600"
                        >
                          Refresh materials
                        </button>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {mats.map((m) => (
                          <li
                            key={m.id}
                            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3 hover:border-indigo-200 hover:bg-indigo-50/50"
                          >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
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
                              <div className="text-[11px] text-slate-500">
                                <span className="font-semibold text-indigo-700">
                                  {m.subject || "General"}
                                </span>
                                {" · "}
                                {m.type === "video"
                                  ? "Video"
                                  : m.type === "link"
                                    ? "Link"
                                    : "PDF / Notes"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openMaterial(m)}
                              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-indigo-500"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
