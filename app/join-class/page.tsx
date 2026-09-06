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
  getJoinedClass,
  getJoinedClasses,
  getRole,
  removeJoinedClass,
  setJoinedClass,
  setJoinedClasses,
  type TeacherMaterial,
} from "@/lib/teacher-store";
import { accuracy, loadProgress, weaknessMap } from "@/lib/user-store";
import { ROLE_EVENT } from "@/lib/role-events";

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
  const [openMats, setOpenMats] = useState<Record<string, boolean>>({});

  const loadMaterialsForCode = async (
    classCode: string,
    fallback?: JoinedRoom
  ): Promise<JoinedRoom> => {
    const c = classCode.toUpperCase();
    try {
      const mr = await fetch(
        `/api/classroom?action=materials&code=${encodeURIComponent(c)}`,
        { cache: "no-store" }
      );
      const md = await mr.json();
      return {
        code: c,
        name: md.name || fallback?.name || `Class ${c}`,
        teacherName: fallback?.teacherName || "",
        materials: (md.materials || []) as TeacherMaterial[],
      };
    } catch {
      return (
        fallback || {
          code: c,
          name: `Class ${c}`,
          materials: [],
        }
      );
    }
  };

  const syncFromLocalAndServer = useCallback(async () => {
    if (!userId) return;

    // 1) Always start from localStorage (sidebar source of truth)
    const localCodes = getJoinedClasses(userId);
    const seed: JoinedRoom[] = localCodes.map((c) => ({
      code: c,
      name: `Class ${c}`,
      materials: [],
    }));
    if (seed.length) {
      setRooms(seed);
      setOpenMats((p) => {
        const o = { ...p };
        for (const r of seed) o[r.code] = o[r.code] ?? true;
        return o;
      });
    }

    // 2) Server joined list
    let serverList: JoinedRoom[] = [];
    let serverCodes: string[] = [];
    try {
      const res = await fetch("/api/classroom?action=joined", {
        cache: "no-store",
      });
      const d = await res.json();
      serverList = (d.classrooms || []) as JoinedRoom[];
      serverCodes = (d.codes || serverList.map((r) => r.code) || []) as string[];
    } catch {
      // ignore
    }

    // 3) Union of all codes
    const allCodes = [
      ...new Set(
        [
          ...localCodes,
          ...serverCodes,
          ...serverList.map((r) => r.code),
        ]
          .map((c) => String(c || "").toUpperCase())
          .filter(Boolean)
      ),
    ];

    if (!allCodes.length) {
      setRooms([]);
      return;
    }

    // Keep localStorage in sync
    setJoinedClasses(userId, allCodes);

    // 4) Load materials for every code
    const full = await Promise.all(
      allCodes.map(async (c) => {
        const fromServer = serverList.find(
          (r) => (r.code || "").toUpperCase() === c
        );
        return loadMaterialsForCode(c, fromServer);
      })
    );

    setRooms(full);
    setOpenMats((p) => {
      const o = { ...p };
      for (const r of full) o[r.code] = o[r.code] ?? true;
      return o;
    });
  }, [userId]);

  useEffect(() => {
    if (!userId || getRole(userId) === "teacher") return;
    void syncFromLocalAndServer();
    const onRole = () => void syncFromLocalAndServer();
    window.addEventListener(ROLE_EVENT, onRole);
    // refresh when tab focused
    const onVis = () => {
      if (document.visibilityState === "visible") void syncFromLocalAndServer();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener(ROLE_EVENT, onRole);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [userId, syncFromLocalAndServer]);

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
        You are in <strong>Teacher mode</strong>. Switch to student in Profile.
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
      setMsg("Enter the full private code (6 characters).");
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

      // Instant UI
      const instant: JoinedRoom = {
        code: roomCode,
        name: room?.name || `Class ${roomCode}`,
        teacherName: room?.teacherName || "",
        materials: (room?.materials || []) as TeacherMaterial[],
      };
      setRooms((prev) => [
        instant,
        ...prev.filter((r) => r.code !== roomCode),
      ]);
      setOpenMats((p) => ({ ...p, [roomCode]: true }));

      // Load materials + confirm
      const withMats = await loadMaterialsForCode(roomCode, instant);
      setRooms((prev) => [
        withMats,
        ...prev.filter((r) => r.code !== roomCode),
      ]);
      void syncFromLocalAndServer();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Join failed");
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
    } catch {
      setMsg("Could not leave class.");
    } finally {
      setLoading(false);
    }
  };

  // Fallback: if state empty but localStorage has code, show it
  const displayRooms =
    rooms.length > 0
      ? rooms
      : getJoinedClasses(userId).map((c) => ({
          code: c,
          name: `Class ${c}`,
          materials: [] as TeacherMaterial[],
        }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        <Link2 className="h-3.5 w-3.5" /> Class &amp; Notes
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Join class &amp; see notes
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Joined classes and teacher PDFs show below.
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
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white disabled:opacity-60"
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

      {displayRooms.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No class joined yet.
          {getJoinedClass(userId) && (
            <button
              type="button"
              className="mt-3 block w-full font-bold text-indigo-600"
              onClick={() => void syncFromLocalAndServer()}
            >
              Reload joined class {getJoinedClass(userId)}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold text-slate-900">
              You have joined {displayRooms.length} class
              {displayRooms.length > 1 ? "es" : ""}
            </h2>
            <button
              type="button"
              onClick={() => void syncFromLocalAndServer()}
              className="text-xs font-bold text-indigo-600"
            >
              Refresh
            </button>
          </div>

          {displayRooms.map((r) => {
            const mats = r.materials || [];
            const open = openMats[r.code] !== false;
            return (
              <div
                key={r.code}
                className="overflow-hidden rounded-3xl border-2 border-emerald-300 bg-white shadow-md"
              >
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-4 text-white sm:px-5">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-100">
                    You have joined this class
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xl font-black">
                        <CheckCircle2 className="h-6 w-6" />
                        {r.name || r.code}
                      </div>
                      <div className="mt-1 font-mono text-sm font-bold tracking-[0.25em]">
                        {r.code}
                      </div>
                      {r.teacherName ? (
                        <div className="mt-1 text-xs text-emerald-50">
                          Teacher: {r.teacherName}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href="/live-class"
                        className="rounded-lg bg-white/20 px-3 py-1.5 text-[11px] font-bold ring-1 ring-white/40"
                      >
                        Live
                      </Link>
                      <button
                        type="button"
                        onClick={() => void leave(r.code)}
                        disabled={loading}
                        className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800"
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
                  className="flex w-full items-center justify-between bg-indigo-50 px-4 py-3 text-left sm:px-5"
                >
                  <span className="inline-flex items-center gap-2 text-sm font-bold text-indigo-900">
                    <FileText className="h-4 w-4" />
                    See materials
                    <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] text-white">
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
                    {mats.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                        No PDFs yet for this class.
                        <button
                          type="button"
                          onClick={async () => {
                            const updated = await loadMaterialsForCode(r.code, r);
                            setRooms((prev) =>
                              prev.map((x) =>
                                x.code === r.code ? updated : x
                              )
                            );
                          }}
                          className="mt-2 block w-full font-bold text-indigo-600"
                        >
                          Refresh materials
                        </button>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {mats.map((m) => (
                          <li
                            key={m.id || m.url}
                            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                          >
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm">
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
                                {m.type === "notes" ? "PDF" : m.type}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openMaterial(m)}
                              className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-bold text-white"
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
