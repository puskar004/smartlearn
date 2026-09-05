"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  BookOpen,
  GraduationCap,
  Radio,
  Upload,
  Users,
  Video,
} from "lucide-react";
import {
  addMaterial,
  createClassroom,
  demoStudentsIfEmpty,
  endLiveSession,
  getClassroom,
  getRole,
  listTeacherClasses,
  postLiveMessage,
  setRole,
  startLiveSession,
  type Classroom,
  type StudentSnapshot,
} from "@/lib/teacher-store";
import { cn } from "@/lib/utils";

export default function TeacherPage() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();
  const [role, setRoleState] = useState<"student" | "teacher">("student");
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [activeCode, setActiveCode] = useState<string | null>(null);
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
  const [tab, setTab] = useState<"students" | "materials" | "live">("students");

  const refresh = () => {
    if (!userId) return;
    const list = listTeacherClasses(userId);
    setClasses(list);
    if (!activeCode && list[0]) setActiveCode(list[0].code);
  };

  useEffect(() => {
    if (!userId) return;
    setRoleState(getRole(userId));
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const room = useMemo(() => {
    if (!activeCode) return null;
    const r = getClassroom(activeCode);
    return r ? demoStudentsIfEmpty(r) : null;
  }, [activeCode, classes]);

  if (!isSignedIn || !userId) {
    return (
      <div className="px-6 py-16 text-center text-sm text-slate-500">
        Sign in to open the Teacher Hub.
      </div>
    );
  }

  const becomeTeacher = () => {
    setRole(userId, "teacher");
    setRoleState("teacher");
  };

  const create = () => {
    const c = createClassroom(
      userId,
      user?.fullName || "Teacher",
      className
    );
    setActiveCode(c.code);
    refresh();
  };

  const upload = (e: FormEvent) => {
    e.preventDefault();
    if (!activeCode || !matTitle.trim() || !matUrl.trim()) return;
    addMaterial(activeCode, {
      title: matTitle.trim(),
      url: matUrl.trim(),
      type: matType,
      subject: matSubject,
      teacherName: user?.fullName || "Teacher",
    });
    setMatTitle("");
    setMatUrl("");
    refresh();
  };

  const startLive = () => {
    if (!activeCode) return;
    startLiveSession(activeCode, liveTitle, liveSubject, liveMins);
    refresh();
    setTab("live");
  };

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">
              Teacher Hub
            </p>
            <h1 className="mt-1 text-3xl font-black text-slate-900">
              See every learner clearly
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Track what students study, where they slip, upload notes & lectures,
              and run live interaction sessions.
            </p>
          </div>
          {role !== "teacher" ? (
            <button
              type="button"
              onClick={becomeTeacher}
              className="rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md"
            >
              Enable teacher mode
            </button>
          ) : (
            <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              Teacher mode on
            </div>
          )}
        </div>
      </div>

      {role !== "teacher" ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-sm text-slate-500">
          Switch to teacher mode to create a class, share a code with students,
          and monitor their SmartLearn history.
          <div className="mt-3">
            <Link href="/profile" className="font-bold text-violet-600 underline">
              Students join from Profile → Class code
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-3">
            <input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              placeholder="Class name"
            />
            <button
              type="button"
              onClick={create}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white"
            >
              <GraduationCap className="h-4 w-4" /> Create class
            </button>
            {classes.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setActiveCode(c.code)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs font-bold transition",
                  activeCode === c.code
                    ? "border-violet-300 bg-violet-50 text-violet-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-violet-200"
                )}
              >
                {c.name} · {c.code}
              </button>
            ))}
          </div>

          {room && (
            <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_320px]">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                    Code: {room.code}
                  </span>
                  <span className="text-xs text-slate-500">
                    Share with students → Profile → Join class
                  </span>
                </div>

                <div className="mb-4 flex gap-2 rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-slate-200">
                  {(
                    [
                      ["students", "Students"],
                      ["materials", "Notes & videos"],
                      ["live", "Live session"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={cn(
                        "flex-1 rounded-full px-3 py-2 text-xs font-bold transition",
                        tab === id
                          ? "bg-violet-600 text-white"
                          : "text-slate-500 hover:bg-violet-50"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {tab === "students" && (
                  <div className="space-y-3">
                    {room.students.map((s) => (
                      <button
                        key={s.studentId}
                        type="button"
                        onClick={() => setSelected(s)}
                        className={cn(
                          "sl-card w-full rounded-2xl border border-white/80 bg-white/80 p-4 text-left shadow-sm",
                          selected?.studentId === s.studentId &&
                            "border-violet-300 ring-2 ring-violet-100"
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900">
                              {s.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Class {s.grade} · last active{" "}
                              {new Date(s.lastActive).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex gap-2 text-[11px] font-bold">
                            <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                              {s.xp} XP
                            </span>
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                              {s.accuracy ?? "—"}%
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
                          {" · "}
                          Chapters opened: {s.chaptersOpened}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {tab === "materials" && (
                  <div className="space-y-4">
                    <form
                      onSubmit={upload}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <Upload className="h-4 w-4 text-violet-600" /> Upload
                        notes / lecture
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
                          placeholder="https://… (Drive, YouTube, PDF)"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
                      >
                        Publish to class
                      </button>
                    </form>

                    <ul className="space-y-2">
                      {room.materials.map((m) => (
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
                              {m.subject} · {m.teacherName}
                            </div>
                          </div>
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold text-violet-600 hover:underline"
                          >
                            Open
                          </a>
                        </li>
                      ))}
                      {room.materials.length === 0 && (
                        <li className="text-center text-xs text-slate-400">
                          No materials yet.
                        </li>
                      )}
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
                            onClick={startLive}
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
                              Join code {room.liveSession.joinCode} · ends{" "}
                              {new Date(
                                room.liveSession.endsAt
                              ).toLocaleTimeString()}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              endLiveSession(room.code);
                              refresh();
                            }}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
                          >
                            End session
                          </button>
                        </div>
                        <div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-xl bg-white p-3">
                          {room.liveSession.messages.map((m) => (
                            <div key={m.id} className="text-xs">
                              <strong>{m.author}:</strong> {m.text}
                            </div>
                          ))}
                          {room.liveSession.messages.length === 0 && (
                            <p className="text-xs text-slate-400">
                              No messages yet — students can join from Profile.
                            </p>
                          )}
                        </div>
                        <form
                          className="mt-2 flex gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!msg.trim()) return;
                            postLiveMessage(
                              room.code,
                              user?.fullName || "Teacher",
                              msg.trim()
                            );
                            setMsg("");
                            refresh();
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
                      Select a student to see full history.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      <div className="text-base font-bold text-slate-900">
                        {selected.name}
                      </div>
                      <div>Email: {selected.email || "—"}</div>
                      <div>
                        Streak {selected.streak}d · XP {selected.xp}
                      </div>
                      <div>Accuracy {selected.accuracy ?? "—"}%</div>
                      <div>
                        Weak subjects:{" "}
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
                          <li className="text-slate-400">No mistakes logged.</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}
