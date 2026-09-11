"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  BookOpen,
  CheckCircle2,
  FileText,
  Link2,
  Loader2,
  LogOut,
  School,
  Trash2,
  User,
  Video,
} from "lucide-react";
import PdfReaderModal from "@/components/PdfReaderModal";
import {
  apiJoinClassroom,
  apiLeaveClassroom,
  cacheClassMaterials,
  getJoinedClasses,
  getRole,
  readCachedClassMaterials,
  readJoinedRoomMeta,
  removeJoinedClass,
  removeJoinedRoomMeta,
  saveJoinedRoomMeta,
  setJoinedClass,
  type TeacherMaterial,
} from "@/lib/teacher-store";
import {
  dismissMaterial,
  filterStudentMaterials,
  hoursLeft,
} from "@/lib/student-materials";
import { accuracy, loadProgress, weaknessMap } from "@/lib/user-store";

type JoinedRoom = {
  code: string;
  name: string;
  teacherName?: string;
  materials?: TeacherMaterial[];
  showMats?: boolean;
};

export default function JoinClassPage() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();
  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState<JoinedRoom[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [viewer, setViewer] = useState<{
    title: string;
    url: string;
    code?: string;
    id?: string;
  } | null>(null);

  const mergeMaterials = (c: string, server: TeacherMaterial[]) => {
    const cached = readCachedClassMaterials(c);
    const byUrl = new Map<string, TeacherMaterial>();
    // Newest wins — server + cache both kept so new teacher PDFs appear
    for (const m of [...cached, ...server]) {
      if (!m?.url) continue;
      const prev = byUrl.get(m.url);
      if (!prev || (m.createdAt || 0) >= (prev.createdAt || 0)) {
        byUrl.set(m.url, m);
      }
    }
    const all = Array.from(byUrl.values()).sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
    if (all.length) cacheClassMaterials(c, all);
    // Student panel: hide dismissed + auto-expire after 24h
    return filterStudentMaterials(userId, c, all);
  };

  const removeStudentPdf = (classCode: string, m: TeacherMaterial) => {
    if (!userId) return;
    const up = classCode.toUpperCase();
    dismissMaterial(userId, up, m);
    setRooms((prev) =>
      prev.map((x) =>
        x.code === up
          ? {
              ...x,
              materials: filterStudentMaterials(userId, up, x.materials || []),
            }
          : x
      )
    );
    setMsg(`Removed “${m.title || "PDF"}” from your list.`);
  };

  const fetchMaterials = async (classCode: string) => {
    const c = classCode.toUpperCase();
    try {
      const bust = Date.now();
      // Always hit both endpoints and UNION — never stop at first old list
      const [mr, mr2] = await Promise.all([
        fetch(
          `/api/classroom?action=notes&code=${encodeURIComponent(c)}&_=${bust}`,
          { cache: "no-store", credentials: "same-origin" }
        ),
        fetch(
          `/api/classroom?action=materials&code=${encodeURIComponent(c)}&_=${bust + 1}`,
          { cache: "no-store", credentials: "same-origin" }
        ),
      ]);
      const md = await mr.json().catch(() => ({}));
      const md2 = await mr2.json().catch(() => ({}));
      const list = [
        ...((md.materials || []) as TeacherMaterial[]),
        ...((md2.materials || []) as TeacherMaterial[]),
      ];

      const materials = mergeMaterials(c, list);
      if (materials.length) cacheClassMaterials(c, materials);
      return {
        materials,
        name: (md.name as string) || (md2.name as string) || undefined,
        teacherName:
          (md.teacherName as string) ||
          (md2.teacherName as string) ||
          undefined,
        count: materials.length,
      };
    } catch {
      const materials = readCachedClassMaterials(c);
      return {
        materials,
        name: undefined,
        teacherName: undefined,
        count: materials.length,
      };
    }
  };

  const refreshMaterials = async (classCode: string) => {
    const up = classCode.toUpperCase();
    setRefreshing(up);
    setErr(null);
    try {
      const got = await fetchMaterials(up);
      setRooms((prev) =>
        prev.map((x) =>
          x.code === up
            ? {
                ...x,
                showMats: true,
                materials: got.materials,
                name: got.name || x.name,
                teacherName: got.teacherName || x.teacherName,
              }
            : x
        )
      );
      if (got.count === 0) {
        setMsg(
          `No PDFs on ${up} yet. Ask teacher to Publish again on this code.`
        );
      } else {
        setMsg(`Loaded ${got.count} PDF(s) for ${up}.`);
      }
    } catch {
      setErr("Could not refresh materials. Try again.");
    } finally {
      setRefreshing(null);
    }
  };

  /** Load joined classes once — no loops, no role-event thrash */
  const bootRooms = useCallback(async () => {
    if (!userId) return;
    const codes = getJoinedClasses(userId);
    if (!codes.length) {
      setRooms([]);
      setBooting(false);
      return;
    }

    // Instant paint from local meta (no shake)
    const instant: JoinedRoom[] = codes.map((c) => {
      const meta = readJoinedRoomMeta(userId, c);
      return {
        code: c,
        name: meta?.name || `Class ${c}`,
        teacherName: meta?.teacherName || "",
        materials: readCachedClassMaterials(c),
        showMats: false,
      };
    });
    setRooms(instant);
    setBooting(false);

    // Soft enrich materials once (no repeated setState storms)
    const enriched = await Promise.all(
      codes.map(async (c) => {
        const meta = readJoinedRoomMeta(userId, c);
        const got = await fetchMaterials(c);
        const name = got.name || meta?.name || `Class ${c}`;
        const teacherName = got.teacherName || meta?.teacherName || "";
        saveJoinedRoomMeta(userId, { code: c, name, teacherName });
        return {
          code: c,
          name,
          teacherName,
          materials: got.materials,
          showMats: false,
        } as JoinedRoom;
      })
    );
    setRooms(enriched);
  }, [userId]);

  useEffect(() => {
    if (!userId || getRole(userId) === "teacher") {
      setBooting(false);
      return;
    }
    void bootRooms();
  }, [userId, bootRooms]);

  if (!isSignedIn || !userId) {
    return (
      <div className="px-6 py-16 text-center text-sm text-slate-500">
        Sign in first, then enter your teacher&apos;s class code.
      </div>
    );
  }

  if (getRole(userId) === "teacher") {
    return (
      <div className="px-6 py-16 text-center text-sm text-slate-500">
        You are in Teacher mode. Switch to Student panel to join a class.
        <div className="mt-3">
          <Link href="/teacher" className="font-bold text-indigo-600 underline">
            Teacher Hub
          </Link>
        </div>
      </div>
    );
  }

  const join = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setErr("Enter the full class code from your teacher.");
      return;
    }
    setLoading(true);
    setErr(null);
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
        recentMistakes: p.mistakes.slice(0, 5).map((m) => ({
          subjectName: m.subjectName,
          chapterTitle: m.chapterTitle,
          prompt: m.prompt,
          at: m.at,
        })),
      });

      if (!res.ok) {
        setErr(res.error || "Invalid class code. Ask your teacher.");
        return;
      }

      const room = res.classroom;
      const roomCode = (room?.code || trimmed).toUpperCase();
      const name = room?.name || `Class ${roomCode}`;
      const teacherName = room?.teacherName || "Teacher";

      setJoinedClass(userId, roomCode);
      saveJoinedRoomMeta(userId, { code: roomCode, name, teacherName });

      const matsFromJoin = (room?.materials || []) as TeacherMaterial[];
      if (matsFromJoin.length) cacheClassMaterials(roomCode, matsFromJoin);
      const got = await fetchMaterials(roomCode);

      const card: JoinedRoom = {
        code: roomCode,
        name: got.name || name,
        teacherName: got.teacherName || teacherName,
        materials: got.materials.length ? got.materials : matsFromJoin,
        showMats: true, // open Access materials right away
      };

      setRooms((prev) => [card, ...prev.filter((r) => r.code !== roomCode)]);
      setCode("");
      setMsg(`You have joined “${card.name}” with ${card.teacherName}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Join failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const leave = async (c: string) => {
    const up = c.toUpperCase();
    if (
      !window.confirm(
        `Leave class ${up}? You can join again anytime with the code.`
      )
    ) {
      return;
    }
    setLeaving(up);
    setErr(null);
    try {
      await apiLeaveClassroom(up).catch(() => null);
      removeJoinedClass(userId, up);
      removeJoinedRoomMeta(userId, up);
      setRooms((prev) => prev.filter((r) => r.code !== up));
      setMsg(`You left class ${up}.`);
    } catch {
      // still remove locally so UI is correct
      removeJoinedClass(userId, up);
      removeJoinedRoomMeta(userId, up);
      setRooms((prev) => prev.filter((r) => r.code !== up));
      setMsg(`You left class ${up}.`);
    } finally {
      setLeaving(null);
    }
  };

  const toggleMats = async (c: string) => {
    const up = c.toUpperCase();
    const room = rooms.find((r) => r.code === up);
    const opening = !room?.showMats;
    setRooms((prev) =>
      prev.map((r) =>
        r.code === up ? { ...r, showMats: !r.showMats } : r
      )
    );
    if (opening) {
      await refreshMaterials(up);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        <Link2 className="h-3.5 w-3.5" /> Class &amp; Notes
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Join your teacher&apos;s class
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Enter the class code → see your class card → Access materials → open
        PDFs here (not in a new tab).
      </p>

      {/* Join box */}
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
          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.35em] outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
        />
        <button
          type="button"
          onClick={() => void join()}
          disabled={loading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {loading ? "Joining…" : "Join class"}
        </button>
        {msg && (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-800">
            {msg}
          </p>
        )}
        {err && (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-center text-sm font-semibold text-rose-700">
            {err}
          </p>
        )}
      </div>

      {/* Joined classes */}
      <div className="mt-10">
        <h2 className="text-lg font-extrabold text-slate-900">
          {rooms.length
            ? `You are joined with teacher (${rooms.length})`
            : "Your classes"}
        </h2>

        {booting ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your classes…
          </div>
        ) : rooms.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No class joined yet. Enter a code above.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {rooms.map((r) => {
              const mats = r.materials || [];
              return (
                <div
                  key={r.code}
                  className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm"
                >
                  {/* Header */}
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-5 text-white">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
                      You have joined this class
                    </div>
                    <div className="mt-1 text-2xl font-black leading-tight">
                      {r.name}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                      <span className="rounded-lg bg-white/20 px-2.5 py-1 font-mono font-bold tracking-widest">
                        {r.code}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-50">
                        <User className="h-4 w-4" />
                        Joined with teacher
                        {r.teacherName ? `: ${r.teacherName}` : ""}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 p-4">
                    <button
                      type="button"
                      onClick={() => void toggleMats(r.code)}
                      className="flex w-full items-center justify-between rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-4 py-3.5 text-left transition hover:border-indigo-400 hover:bg-indigo-100"
                    >
                      <span className="inline-flex items-center gap-2 text-sm font-extrabold text-indigo-900">
                        <FileText className="h-5 w-5 text-indigo-600" />
                        Access materials
                        <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          {mats.length} PDF
                          {mats.length === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="text-xs font-bold text-indigo-600">
                        {r.showMats ? "Hide" : "Open"}
                      </span>
                    </button>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/live-class"
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-800 hover:bg-rose-100"
                      >
                        Open live class
                      </Link>
                      <button
                        type="button"
                        onClick={() => void leave(r.code)}
                        disabled={leaving === r.code}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        {leaving === r.code ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <LogOut className="h-3.5 w-3.5" />
                        )}
                        Leave class
                      </button>
                    </div>

                    {/* Materials panel */}
                    {r.showMats && (
                      <div className="mt-2 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <p className="mb-2 text-[11px] font-semibold text-slate-500">
                          Notes auto-remove after <strong>24 hours</strong>. You
                          can also delete any PDF from your list anytime.
                        </p>
                        <div className="mb-2 flex justify-end">
                          <button
                            type="button"
                            disabled={refreshing === r.code}
                            onClick={() => void refreshMaterials(r.code)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                          >
                            {refreshing === r.code ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Refresh materials
                          </button>
                        </div>
                        {refreshing === r.code ? (
                          <div className="rounded-xl bg-white px-3 py-6 text-center text-xs text-slate-500">
                            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-indigo-600" />
                            Loading PDFs…
                          </div>
                        ) : mats.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs text-slate-500">
                            No notes yet. Ask teacher to click{" "}
                            <span className="font-bold">Publish to class</span>{" "}
                            on code{" "}
                            <span className="font-mono font-bold">{r.code}</span>
                            , then tap Refresh materials.
                          </div>
                        ) : (
                          <ul className="space-y-2">
                            {mats.map((m) => (
                              <li
                                key={m.id || m.url}
                                className="flex items-stretch gap-2"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    const u = m.url || "";
                                    if (
                                      m.type === "video" ||
                                      m.type === "link" ||
                                      /^https?:\/\/(www\.)?(youtube|youtu\.be|meet\.google)/i.test(
                                        u
                                      )
                                    ) {
                                      window.open(
                                        u,
                                        "_blank",
                                        "noopener,noreferrer"
                                      );
                                      return;
                                    }
                                    setViewer({
                                      title: m.title || "Class notes",
                                      url: u,
                                      code: r.code,
                                      id: m.id,
                                    });
                                  }}
                                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white bg-white px-3 py-3 text-left shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                                >
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
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
                                      {m.subject || "General"} ·{" "}
                                      {hoursLeft(m)}h left
                                    </div>
                                  </div>
                                  <span className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1 text-[10px] font-bold text-white">
                                    Open
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  title="Remove from my list"
                                  onClick={() => removeStudentPdf(r.code, m)}
                                  className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-rose-100 bg-white px-3 text-rose-600 shadow-sm hover:bg-rose-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PdfReaderModal
        open={Boolean(viewer)}
        title={viewer?.title || "PDF"}
        ncertLink={viewer?.url}
        classCode={viewer?.code}
        materialId={viewer?.id}
        onClose={() => setViewer(null)}
      />
    </div>
  );
}
