"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  BookOpen,
  Copy,
  GraduationCap,
  Loader2,
  Radio,
  Upload,
  Users,
  Video,
} from "lucide-react";
import {
  apiAddMaterial,
  apiCreateClassroom,
  apiEndLive,
  apiGetRoom,
  apiListMyClasses,
  apiPostMessage,
  apiStartLive,
  getRole,
  setRole,
  type Classroom,
  type StudentSnapshot,
} from "@/lib/teacher-store";
import { cn } from "@/lib/utils";

function TeacherInner() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const sp = useSearchParams();
  const tab =
    (sp.get("tab") as "students" | "materials" | "live" | "code") || "students";

  const [classes, setClasses] = useState<Classroom[]>([]);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [room, setRoom] = useState<Classroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [className, setClassName] = useState("Class 12 Science A");
  const [selected, setSelected] = useState<StudentSnapshot | null>(null);
  const [matTitle, setMatTitle] = useState("");
  const [matUrl, setMatUrl] = useState("");
  const [matType, setMatType] = useState<"notes" | "video" | "link">("notes");
  const [matSubject, setMatSubject] = useState("Physics");
  const [liveTitle, setLiveTitle] = useState("Doubt clearing hour");
  const [liveSubject, setLiveSubject] = useState("Physics");
  const [liveMins, setLiveMins] = useState(40);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const list = await apiListMyClasses();
      setClasses(list);
      const code = activeCode || list[0]?.code || null;
      if (!activeCode && list[0]) setActiveCode(list[0].code);
      if (code) {
        const r = await apiGetRoom(code);
        setRoom(r);
      } else {
        setRoom(null);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [userId, activeCode]);

  useEffect(() => {
    if (!userId) return;
    if (getRole(userId) !== "teacher") {
      setRole(userId, "teacher");
    }
    void refresh();
    const id = setInterval(() => void refresh(), 8000);
    return () => clearInterval(id);
  }, [userId, refresh]);

  if (!isSignedIn || !userId) {
    return (
      <div className="px-6 py-16 text-center text-sm text-slate-500">
        Sign in as Teacher to open this hub.
      </div>
    );
  }

  const create = async () => {
    setBusy(true);
    try {
      const c = await apiCreateClassroom(className);
      setActiveCode(c.code);
      setClasses((prev) => [c, ...prev.filter((x) => x.code !== c.code)]);
      setRoom(c);
      router.replace("/teacher?tab=code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeCode || !matTitle.trim() || !matUrl.trim()) return;
    setBusy(true);
    try {
      const data = await apiAddMaterial(activeCode, {
        title: matTitle.trim(),
        url: matUrl.trim(),
        type: matType,
        subject: matSubject,
        teacherName: user?.fullName || "Teacher",
      });
      if (data.classroom) setRoom(data.classroom);
      setMatTitle("");
      setMatUrl("");
    } finally {
      setBusy(false);
    }
  };

  const startLive = async () => {
    if (!activeCode) return;
    setBusy(true);
    try {
      const data = await apiStartLive(
        activeCode,
        liveTitle,
        liveSubject,
        liveMins
      );
      if (data.classroom) setRoom(data.classroom);
      router.replace("/teacher?tab=live");
    } finally {
      setBusy(false);
    }
  };

  const setTab = (t: string) => router.replace(`/teacher?tab=${t}`);

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      <div className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-lg sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-100">
          Teacher console
        </p>
        <h1 className="mt-1 text-3xl font-black">
          Hello{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-indigo-100">
          Create a private code → share with students → see their live progress
          from any device. Students never see upload tools.
        </p>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="New class name"
        />
        <button
          type="button"
          onClick={() => void create()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GraduationCap className="h-4 w-4" />
          )}
          Create class + code
        </button>
        {classes.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => {
              setActiveCode(c.code);
              void apiGetRoom(c.code).then((r) => setRoom(r));
            }}
            className={cn(
              "rounded-xl border px-3 py-2 text-xs font-bold transition",
              activeCode === c.code
                ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200"
            )}
          >
            {c.name} · {c.code}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !room ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white/70 p-10 text-center text-sm text-slate-500">
          Create your first class to get a <strong>private code</strong> students
          can join from any phone.
        </div>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_300px]">
          <div>
            <div className="mb-4 flex flex-wrap gap-2 rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-slate-200">
              {(
                [
                  ["students", "Students"],
                  ["materials", "Upload"],
                  ["live", "Live"],
                  ["code", "Class code"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex-1 rounded-full px-3 py-2 text-xs font-bold transition",
                    tab === id
                      ? "bg-indigo-600 text-white"
                      : "text-slate-500 hover:bg-indigo-50"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "code" && (
              <div className="rounded-3xl border border-indigo-100 bg-white p-8 text-center shadow-sm">
                <p className="text-sm font-semibold text-slate-500">
                  Private class code for{" "}
                  <strong className="text-slate-900">{room.name}</strong>
                </p>
                <p className="mt-4 font-mono text-5xl font-black tracking-[0.35em] text-indigo-700">
                  {room.code}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Students open <strong>Join Teacher</strong> and type this code
                  (any device). Then they appear under Students.
                </p>
                <button
                  type="button"
                  onClick={() => void copyCode()}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white"
                >
                  <Copy className="h-4 w-4" />
                  {copied ? "Copied!" : "Copy code"}
                </button>
              </div>
            )}

            {tab === "students" && (
              <div className="space-y-3">
                {room.students.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-8 text-center text-sm text-slate-500">
                    No students yet. Share{" "}
                    <strong className="font-mono text-indigo-700">
                      {room.code}
                    </strong>
                    . Empty until someone joins — no sample data.
                  </div>
                )}
                {room.students.map((s) => (
                  <button
                    key={s.studentId}
                    type="button"
                    onClick={() => setSelected(s)}
                    className={cn(
                      "sl-card w-full rounded-2xl border border-white/80 bg-white/80 p-4 text-left shadow-sm",
                      selected?.studentId === s.studentId &&
                        "border-indigo-300 ring-2 ring-indigo-100"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="text-[11px] text-slate-400">
                          Class {s.grade} · {s.email || "no email"} ·{" "}
                          {new Date(s.lastActive).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2 text-[11px] font-bold">
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                          {s.xp} XP
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                          {s.accuracy ?? 0}%
                        </span>
                        <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-700">
                          {s.mistakes} mistakes
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Weak:{" "}
                      <strong className="text-rose-700">
                        {s.weakSubjects.join(", ") || "—"}
                      </strong>
                      {" · "}Chapters opened: {s.chaptersOpened}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {tab === "materials" && (
              <div className="space-y-4">
                <form
                  onSubmit={(e) => void upload(e)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Upload className="h-4 w-4 text-indigo-600" /> Upload notes /
                    lecture
                  </h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      value={matTitle}
                      onChange={(e) => setMatTitle(e.target.value)}
                      placeholder="Title"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      required
                    />
                    <input
                      value={matSubject}
                      onChange={(e) => setMatSubject(e.target.value)}
                      placeholder="Subject"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <select
                      value={matType}
                      onChange={(e) =>
                        setMatType(e.target.value as "notes" | "video" | "link")
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="notes">Notes / PDF link</option>
                      <option value="video">Video lecture link</option>
                      <option value="link">Other link</option>
                    </select>
                    <input
                      value={matUrl}
                      onChange={(e) => setMatUrl(e.target.value)}
                      placeholder="https://…"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    Publish to class
                  </button>
                </form>
                <ul className="space-y-2">
                  {(room.materials || []).map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-sm"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">
                          {m.type === "video" ? (
                            <Video className="mr-1 inline h-3.5 w-3.5 text-rose-500" />
                          ) : (
                            <BookOpen className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
                          )}
                          {m.title}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {m.subject}
                        </div>
                      </div>
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        Open
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tab === "live" && (
              <div className="space-y-4">
                {!room.liveSession?.active ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold">
                      <Radio className="h-4 w-4 text-rose-500" /> Start live
                      interaction
                    </h3>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <input
                        value={liveTitle}
                        onChange={(e) => setLiveTitle(e.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
                      />
                      <input
                        type="number"
                        min={10}
                        value={liveMins}
                        onChange={(e) =>
                          setLiveMins(Number(e.target.value) || 40)
                        }
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <input
                        value={liveSubject}
                        onChange={(e) => setLiveSubject(e.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
                      />
                      <button
                        type="button"
                        onClick={() => void startLive()}
                        className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Go live
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-rose-800">
                          LIVE · {room.liveSession.title}
                        </div>
                        <div className="text-xs text-rose-600">
                          Room {room.liveSession.joinCode}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void apiEndLive(room.code).then((d) => {
                            if (d.classroom) setRoom(d.classroom);
                          })
                        }
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        End session
                      </button>
                    </div>
                    <div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-xl bg-white p-3">
                      {(room.liveSession.messages || []).map((m) => (
                        <div key={m.id} className="text-xs">
                          <strong>{m.author}:</strong> {m.text}
                        </div>
                      ))}
                    </div>
                    <form
                      className="mt-2 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!msg.trim()) return;
                        void apiPostMessage(
                          room.code,
                          user?.fullName || "Teacher",
                          msg.trim()
                        ).then((d) => {
                          if (d.classroom) setRoom(d.classroom);
                          setMsg("");
                        });
                      }}
                    >
                      <input
                        value={msg}
                        onChange={(e) => setMsg(e.target.value)}
                        placeholder="Message the room…"
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Send
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/80 bg-white/80 p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-extrabold">
                <Users className="h-4 w-4 text-indigo-600" /> Student detail
              </h3>
              {!selected ? (
                <p className="mt-3 text-xs text-slate-400">
                  Select a joined student.
                </p>
              ) : (
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  <div className="text-base font-bold text-slate-900">
                    {selected.name}
                  </div>
                  <div>{selected.email || "—"}</div>
                  <div>
                    Streak {selected.streak}d · XP {selected.xp} · Accuracy{" "}
                    {selected.accuracy ?? 0}%
                  </div>
                  <div>
                    Weak:{" "}
                    <strong className="text-rose-700">
                      {selected.weakSubjects.join(", ") || "—"}
                    </strong>
                  </div>
                  <div className="pt-2 font-bold text-slate-800">
                    Recent mistakes
                  </div>
                  <ul className="space-y-2">
                    {selected.recentMistakes.map((m, i) => (
                      <li
                        key={i}
                        className="rounded-xl bg-rose-50 px-2 py-2 text-[11px] text-rose-900"
                      >
                        <div className="font-semibold">
                          {m.subjectName} · {m.chapterTitle}
                        </div>
                        <div className="opacity-80">{m.prompt}</div>
                      </li>
                    ))}
                    {selected.recentMistakes.length === 0 && (
                      <li className="text-slate-400">No mistakes yet.</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
              <Link href="/profile" className="font-bold text-indigo-600 underline">
                Settings
              </Link>{" "}
              → switch to Student mode if needed.
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function TeacherPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm">Loading teacher hub…</div>}>
      <TeacherInner />
    </Suspense>
  );
}
