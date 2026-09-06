"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  BookOpen,
  ClipboardList,
  Copy,
  GraduationCap,
  Loader2,
  Pencil,
  Radio,
  Trash2,
  Upload,
  Users,
  Video,
} from "lucide-react";
import MeetFrame from "@/components/MeetFrame";
import {
  apiAddMaterial,
  apiCreateClassroom,
  apiDeleteClassroom,
  apiEndLive,
  apiGetRoom,
  apiListMyClasses,
  apiPostMessage,
  apiKickLive,
  apiRenameClassroom,
  apiSendRemark,
  apiStartLive,
  apiUploadMaterialFile,
  getRole,
  setRole,
  type Classroom,
  type StudentSnapshot,
} from "@/lib/teacher-store";
import { cn } from "@/lib/utils";

type TeacherTab = "students" | "materials" | "live" | "code" | "attendance";

function TeacherInner() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const sp = useSearchParams();
  const tab = (sp.get("tab") as TeacherTab) || "students";

  const [classes, setClasses] = useState<Classroom[]>([]);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [room, setRoom] = useState<Classroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [className, setClassName] = useState("Class 12 Science A");
  const [renameTo, setRenameTo] = useState("");
  const [selected, setSelected] = useState<StudentSnapshot | null>(null);
  const [matTitle, setMatTitle] = useState("");
  const [matUrl, setMatUrl] = useState("");
  const [matFile, setMatFile] = useState<File | null>(null);
  const [matType, setMatType] = useState<"notes" | "video" | "link">("notes");
  const [matSubject, setMatSubject] = useState("Physics");
  const [liveTitle, setLiveTitle] = useState("Doubt clearing hour");
  const [liveSubject, setLiveSubject] = useState("Physics");
  const [liveMins, setLiveMins] = useState(40);
  const [meetUrl, setMeetUrl] = useState("https://meet.google.com/");
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [matNote, setMatNote] = useState<string | null>(null);
  const [sentRemarks, setSentRemarks] = useState<
    { studentId: string; name: string; text: string; at: number }[]
  >([]);
  const [penaltyNote, setPenaltyNote] = useState("");

  const showHomeBanner = tab === "students" || !sp.get("tab");

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
    const id = setInterval(() => void refresh(), 25_000);
    return () => clearInterval(id);
  }, [userId, refresh]);

  useEffect(() => {
    if (room?.name) setRenameTo(room.name);
  }, [room?.code, room?.name]);

  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(`sl_teacher_sent_remarks_${userId}`);
      if (raw) setSentRemarks(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [userId]);

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
      setRenameTo(c.name);
      router.replace("/teacher?tab=code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const rename = async () => {
    if (!activeCode || !renameTo.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiRenameClassroom(activeCode, renameTo.trim());
      if (!data.ok) throw new Error(data.error || "Rename failed");
      if (data.classroom) {
        setRoom(data.classroom);
        setClasses((prev) =>
          prev.map((c) =>
            c.code === data.classroom.code ? data.classroom : c
          )
        );
      }
      setMatNote("Class renamed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setBusy(false);
    }
  };

  const removeClass = async () => {
    if (!activeCode || !room) return;
    if (
      !window.confirm(
        `Delete class “${room.name}” (${room.code})? Students will be unlinked.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await apiDeleteClassroom(activeCode);
      if (!data.ok) throw new Error(data.error || "Delete failed");
      const list = (data.classrooms || []) as Classroom[];
      setClasses(list);
      const next = list[0]?.code || null;
      setActiveCode(next);
      setRoom(next ? (await apiGetRoom(next)) : null);
      setRenameTo(list[0]?.name || "");
      setMatNote("Class deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
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
      // Broadcast for students who already linked this class (notifications)
      try {
        localStorage.setItem(
          "sl_class_code_share",
          JSON.stringify({
            code: room.code,
            name: room.name,
            at: Date.now(),
          })
        );
        // Also push into each joined student's notification channel via storage event
        for (const s of room.students || []) {
          localStorage.setItem(
            `sl_notify_student_${s.studentId}`,
            JSON.stringify({
              title: "Class code from teacher",
              body: `Join/open class ${room.name} with code ${room.code}`,
              href: "/join-class",
              at: Date.now(),
            })
          );
        }
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  };

  const normalizeMaterialUrl = (raw: string) => {
    let u = raw.trim();
    // Google Drive share → direct-ish view URL students can open
    const driveFile = u.match(
      /drive\.google\.com\/file\/d\/([^/]+)/i
    );
    if (driveFile) {
      return `https://drive.google.com/file/d/${driveFile[1]}/view`;
    }
    const driveOpen = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (u.includes("drive.google.com") && driveOpen) {
      return `https://drive.google.com/file/d/${driveOpen[1]}/view`;
    }
    return u;
  };

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeCode || !matTitle.trim()) {
      setError("Title required.");
      return;
    }
    const hasFile = !!matFile;
    const hasUrl = matUrl.trim().length > 0 && !matUrl.startsWith("data:");
    if (!hasFile && !hasUrl) {
      setError("Provide either a Drive/link OR a PDF file (up to 5MB).");
      return;
    }
    setBusy(true);
    setMatNote(null);
    setError(null);
    try {
      if (hasFile && matFile) {
        const data = await apiUploadMaterialFile({
          code: activeCode,
          title: matTitle.trim(),
          subject: matSubject.trim() || "General",
          type: matType,
          file: matFile,
        });
        if (!data.ok) {
          throw new Error(
            data.error ||
              (typeof data === "string" ? data : "Upload failed")
          );
        }
        if (data.classroom) setRoom(data.classroom as Classroom);
        setMatNote(
          data.durable === false
            ? `Saved locally only — students may not see it. Prefer Drive link.`
            : `Published PDF (${((data.size || matFile.size) / (1024 * 1024)).toFixed(2)} MB) · open from Join Teacher`
        );
      } else {
        const url = normalizeMaterialUrl(matUrl);
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          throw new Error("Link must start with https://");
        }
        const data = await apiAddMaterial(activeCode, {
          title: matTitle.trim(),
          url,
          type: matType,
          subject: matSubject.trim() || "General",
          teacherName: user?.fullName || "Teacher",
        });
        if (!data.ok) throw new Error(data.error || "Upload failed");
        if (data.classroom) setRoom(data.classroom);
        setMatNote(
          `Published link · ${matSubject || "General"} — students see it under Join Teacher.`
        );
      }
      setMatTitle("");
      setMatUrl("");
      setMatFile(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(
        /unprocessable|422|entity|metadata|too large|clerk/i.test(msg)
          ? "Upload blocked (server limit). Use a Google Drive link: Share → Anyone with the link → paste below."
          : msg
      );
    } finally {
      setBusy(false);
    }
  };

  const onOfflinePdf = (file: File | null) => {
    if (!file) return;
    const max = 5 * 1024 * 1024;
    if (file.size > max) {
      setError(
        `PDF max 5MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB — compress or use Drive.`
      );
      return;
    }
    setError(null);
    setMatFile(file);
    setMatUrl(""); // exclusive: file OR link
    setMatType("notes");
    if (!matTitle.trim()) setMatTitle(file.name.replace(/\.pdf$/i, ""));
    setMatNote(
      `Ready: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB) — click Publish`
    );
  };

  const startLive = async (schedule = false) => {
    if (!activeCode) return;
    if (!meetUrl.trim() || !meetUrl.includes("http")) {
      setError("Paste a valid Google Meet link first.");
      return;
    }
    let scheduledAt: number | undefined;
    if (schedule && scheduleLocal) {
      scheduledAt = new Date(scheduleLocal).getTime();
      if (Number.isNaN(scheduledAt) || scheduledAt < Date.now()) {
        setError("Pick a future date/time to schedule.");
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const data = await apiStartLive(
        activeCode,
        liveTitle,
        liveSubject,
        liveMins,
        meetUrl.trim(),
        scheduledAt
      );
      if (!data.ok) throw new Error(data.error || "Could not start live");
      if (data.classroom) setRoom(data.classroom);
      // Notify joined students via local broadcast key they poll
      try {
        localStorage.setItem(
          `sl_live_alert_${activeCode}`,
          JSON.stringify({
            title: liveTitle,
            meetUrl: meetUrl.trim(),
            at: Date.now(),
            scheduledAt,
          })
        );
      } catch {
        // ignore
      }
      router.replace("/teacher?tab=live");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Live start failed");
    } finally {
      setBusy(false);
    }
  };

  const setTab = (t: TeacherTab) => router.replace(`/teacher?tab=${t}`);

  const field =
    "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      {showHomeBanner && (
        <div className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-lg sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-100">
            Teacher console
          </p>
          <h1 className="mt-1 text-3xl font-black">
            Hello{user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-indigo-100">
            Create a private code → share with students → see progress, mistakes
            feedback, uploads & Google Meet live.
          </p>
        </div>
      )}

      {!showHomeBanner && (
        <h1 className="text-xl font-extrabold text-slate-900">
          {tab === "materials"
            ? "Upload notes / PDF"
            : tab === "live"
              ? "Live session"
              : tab === "code"
                ? "Class code"
                : tab === "attendance"
                  ? "Attendance"
                  : "Teacher"}
        </h1>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {showHomeBanner && (
      <div className="mt-6 flex flex-wrap gap-3">
        <input
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          className={field}
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
      )}

      {!showHomeBanner && classes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {classes.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => {
                setActiveCode(c.code);
                void apiGetRoom(c.code).then((r) => setRoom(r));
              }}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[11px] font-bold",
                activeCode === c.code
                  ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                  : "border-slate-200 text-slate-500"
              )}
            >
              {c.code}
            </button>
          ))}
        </div>
      )}

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
                  ["attendance", "Attendance"],
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
              <div className="space-y-4">
                <div className="rounded-3xl border border-indigo-100 bg-white p-8 text-center shadow-sm">
                  <p className="text-sm font-semibold text-slate-500">
                    Private class code for{" "}
                    <strong className="text-slate-900">{room.name}</strong>
                  </p>
                  <p className="mt-4 font-mono text-5xl font-black tracking-[0.35em] text-indigo-700">
                    {room.code}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    Students open <strong>Join Teacher</strong> and type this
                    code (any device). Then they appear under Students.
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
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Pencil className="h-4 w-4 text-indigo-600" /> Manage class
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      value={renameTo}
                      onChange={(e) => setRenameTo(e.target.value)}
                      placeholder="Class name"
                      className={`${field} min-w-[180px] flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => void rename()}
                      disabled={busy || !renameTo.trim()}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeClass()}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete class
                    </button>
                  </div>
                </div>
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
                    PDF
                  </h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      value={matTitle}
                      onChange={(e) => setMatTitle(e.target.value)}
                      placeholder="Title"
                      className={field}
                      required
                    />
                    <input
                      value={matSubject}
                      onChange={(e) => setMatSubject(e.target.value)}
                      placeholder="Subject"
                      className={field}
                    />
                    <select
                      value={matType}
                      onChange={(e) =>
                        setMatType(e.target.value as "notes" | "video" | "link")
                      }
                      className={field}
                    >
                      <option value="notes">Notes / PDF</option>
                      <option value="video">Video lecture link</option>
                      <option value="link">Other link</option>
                    </select>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100">
                      <Upload className="h-3.5 w-3.5" /> Offline PDF from device
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          onOfflinePdf(e.target.files?.[0] || null);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <input
                      value={matFile ? "" : matUrl}
                      onChange={(e) => {
                        setMatUrl(e.target.value);
                        if (e.target.value.trim()) setMatFile(null);
                      }}
                      placeholder="Or paste https:// Drive / YouTube link"
                      className={`${field} sm:col-span-2`}
                      disabled={!!matFile}
                    />
                    <p className="sm:col-span-2 text-[10px] text-slate-400">
                      PDF from device up to <strong>5 MB</strong>, or a Drive
                      link — one is enough.
                    </p>
                    {matFile && (
                      <p className="sm:col-span-2 text-[11px] font-semibold text-emerald-700">
                        PDF ready: {matFile.name} (
                        {(matFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                  {matNote && (
                    <p className="mt-2 text-xs font-semibold text-emerald-700">
                      {matNote}
                    </p>
                  )}
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
                      <button
                        type="button"
                        onClick={() => {
                          const u = m.url || "";
                          if (u.startsWith("data:")) {
                            const a = document.createElement("a");
                            a.href = u;
                            a.download = `${m.title || "notes"}.pdf`;
                            a.click();
                            return;
                          }
                          window.open(u, "_blank", "noopener,noreferrer");
                        }}
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        Open
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tab === "attendance" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <ClipboardList className="h-4 w-4 text-indigo-600" />{" "}
                    Session attendance
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Students are marked present when they open Live Class during
                    an active session.
                  </p>
                </div>
                {room.liveSession?.active && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
                    <div className="text-sm font-bold text-rose-800">
                      LIVE now · {room.liveSession.title} ·{" "}
                      {room.liveSession.subject}
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {(room.liveSession.attendees || []).length === 0 && (
                        <li className="text-xs text-rose-600/80">
                          No one joined yet.
                        </li>
                      )}
                      {(room.liveSession.attendees || []).map((a) => (
                        <li
                          key={a.studentId + a.joinedAt}
                          className="flex flex-wrap justify-between gap-1 rounded-lg bg-white/80 px-3 py-2 text-xs"
                        >
                          <span className="font-semibold text-slate-800">
                            {a.name}
                          </span>
                          <span className="text-slate-400">
                            in {new Date(a.joinedAt).toLocaleTimeString()}
                            {a.leftAt
                              ? ` · out ${new Date(a.leftAt).toLocaleTimeString()}`
                              : " · still in"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <ul className="space-y-3">
                  {(room.attendanceLog || []).length === 0 &&
                    !room.liveSession?.active && (
                      <li className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-8 text-center text-sm text-slate-500">
                        No sessions yet. Start a live class to track who joins.
                      </li>
                    )}
                  {(room.attendanceLog || []).map((rec) => (
                    <li
                      key={rec.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {rec.sessionTitle}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {rec.subject} ·{" "}
                            {new Date(rec.startedAt).toLocaleString()}
                            {rec.endedAt
                              ? ` → ${new Date(rec.endedAt).toLocaleTimeString()}`
                              : " · open"}
                          </div>
                        </div>
                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                          {rec.attendees?.length || 0} present
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {(rec.attendees || []).map((a) => (
                          <li
                            key={a.studentId + a.joinedAt}
                            className="flex flex-wrap justify-between gap-1 text-xs text-slate-600"
                          >
                            <span>{a.name}</span>
                            <span className="text-slate-400">
                              in {new Date(a.joinedAt).toLocaleTimeString()}
                              {a.leftAt
                                ? ` · out ${new Date(a.leftAt).toLocaleTimeString()}`
                                : ""}
                            </span>
                          </li>
                        ))}
                        {(rec.attendees || []).length === 0 && (
                          <li className="text-[11px] text-slate-400">
                            Nobody marked present
                          </li>
                        )}
                      </ul>
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
                      <Radio className="h-4 w-4 text-rose-500" /> Start Google
                      Meet live
                    </h3>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <input
                        value={liveTitle}
                        onChange={(e) => setLiveTitle(e.target.value)}
                        placeholder="Session title"
                        className={`${field} sm:col-span-2`}
                      />
                      <input
                        type="number"
                        min={10}
                        value={liveMins}
                        onChange={(e) =>
                          setLiveMins(Number(e.target.value) || 40)
                        }
                        placeholder="Minutes"
                        className={field}
                      />
                      <input
                        value={liveSubject}
                        onChange={(e) => setLiveSubject(e.target.value)}
                        placeholder="Subject"
                        className={`${field} sm:col-span-2`}
                      />
                      <input
                        value={meetUrl}
                        onChange={(e) => setMeetUrl(e.target.value)}
                        placeholder="https://meet.google.com/xxx-xxxx-xxx"
                        className={`${field} sm:col-span-3`}
                      />
                      <label className="sm:col-span-3 text-[11px] font-semibold text-slate-600">
                        Schedule for later (optional)
                        <input
                          type="datetime-local"
                          value={scheduleLocal}
                          onChange={(e) => setScheduleLocal(e.target.value)}
                          className={`${field} mt-1 w-full`}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void startLive(false)}
                        disabled={busy}
                        className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white sm:col-span-2"
                      >
                        Go live now
                      </button>
                      <button
                        type="button"
                        onClick={() => void startLive(true)}
                        disabled={busy || !scheduleLocal}
                        className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Schedule meeting
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Create Meet at{" "}
                      <a
                        href="https://meet.google.com/new"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-indigo-600 underline"
                      >
                        meet.google.com/new
                      </a>{" "}
                      → paste link. Students open{" "}
                      <strong>Live Class</strong> to join + chat.
                    </p>
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
                    {room.liveSession.meetUrl && (
                      <div className="mt-3">
                        <MeetFrame
                          meetUrl={room.liveSession.meetUrl}
                          title="Teacher · Google Meet"
                        />
                        <p className="mt-2 text-[11px] text-slate-500">
                          To remove someone from Google Meet, use Meet’s own
                          controls (people → remove). Below: SmartLearn penalty
                          + kick from live attendance.
                        </p>
                      </div>
                    )}
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <div className="text-xs font-bold text-amber-900">
                        Kick from live class
                      </div>
                      <p className="mt-1 text-[10px] text-amber-800/80">
                        Student is blocked from this live session (Meet link
                        hidden). Also remove them inside Google Meet if needed.
                      </p>
                      <input
                        value={penaltyNote}
                        onChange={(e) => setPenaltyNote(e.target.value)}
                        placeholder="Reason (misconduct, noise…)"
                        className="mt-2 w-full rounded-lg border border-amber-200 px-2 py-1.5 text-xs"
                      />
                      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                        {(() => {
                          const kicked = new Set(
                            room.liveSession.kickedIds || []
                          );
                          const present = (room.liveSession.attendees || [])
                            .filter((a) => !a.leftAt && !kicked.has(a.studentId))
                            .map((a) => ({
                              id: a.studentId,
                              name: a.name,
                              tag: "in live",
                            }));
                          const roster = (room.students || [])
                            .filter(
                              (s) =>
                                !kicked.has(s.studentId) &&
                                !present.some((p) => p.id === s.studentId)
                            )
                            .map((s) => ({
                              id: s.studentId,
                              name: s.name,
                              tag: "in class",
                            }));
                          const list = [...present, ...roster];
                          if (!list.length) {
                            return (
                              <li className="text-[11px] text-amber-800/70">
                                No students to kick (none joined / all kicked).
                              </li>
                            );
                          }
                          return list.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-xs"
                            >
                              <span>
                                <span className="font-semibold text-slate-800">
                                  {s.name}
                                </span>
                                <span className="ml-1 text-[10px] text-slate-400">
                                  · {s.tag}
                                </span>
                              </span>
                              <button
                                type="button"
                                disabled={busy}
                                className="rounded-md bg-rose-600 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-50"
                                onClick={() => {
                                  void (async () => {
                                    const reason =
                                      penaltyNote.trim() ||
                                      "Misconduct in live class";
                                    setBusy(true);
                                    setError(null);
                                    try {
                                      const data = await apiKickLive(
                                        room.code,
                                        s.id,
                                        reason
                                      );
                                      if (!data.ok) {
                                        throw new Error(
                                          data.error || "Kick failed"
                                        );
                                      }
                                      if (data.classroom) setRoom(data.classroom);
                                      setMatNote(
                                        `Kicked ${s.name} from live · they cannot rejoin this session`
                                      );
                                      setPenaltyNote("");
                                      void refresh();
                                    } catch (e) {
                                      setError(
                                        e instanceof Error
                                          ? e.message
                                          : "Could not kick student"
                                      );
                                    } finally {
                                      setBusy(false);
                                    }
                                  })();
                                }}
                              >
                                Kick out
                              </button>
                            </li>
                          ));
                        })()}
                      </ul>
                      {(room.liveSession.kickedIds || []).length > 0 && (
                        <div className="mt-2 border-t border-amber-200 pt-2 text-[10px] text-rose-700">
                          Kicked this session:{" "}
                          {(room.liveSession.kickedIds || []).length} student(s)
                        </div>
                      )}
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
                  <div className="pt-3">
                    <div className="font-bold text-slate-800">
                      Teacher feedback
                    </div>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={3}
                      placeholder={`Feedback for ${selected.name} on weak topics…`}
                      className={`${field} mt-1 w-full text-xs`}
                    />
                    {sentRemarks.filter((r) => r.studentId === selected.studentId)
                      .length > 0 && (
                      <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">
                        {sentRemarks
                          .filter((r) => r.studentId === selected.studentId)
                          .slice(0, 5)
                          .map((r, i) => (
                            <li
                              key={i}
                              className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] text-indigo-900"
                            >
                              {new Date(r.at).toLocaleString()}: {r.text}
                            </li>
                          ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!feedback.trim() || !selected) return;
                        void (async () => {
                          try {
                            const data = await apiSendRemark(
                              selected.studentId,
                              feedback.trim(),
                              room?.code,
                              room?.name
                            );
                            if (!data.ok) {
                              throw new Error(data.error || "Send failed");
                            }
                            const entry = {
                              studentId: selected.studentId,
                              name: selected.name,
                              text: feedback.trim(),
                              at: Date.now(),
                            };
                            setSentRemarks((prev) => {
                              const next = [entry, ...prev].slice(0, 40);
                              try {
                                localStorage.setItem(
                                  `sl_teacher_sent_remarks_${userId}`,
                                  JSON.stringify(next)
                                );
                              } catch {
                                // ignore
                              }
                              return next;
                            });
                            setFeedback("");
                            setMatNote(
                              `Remark sent to ${selected.name} (saved here + student Remarks)`
                            );
                          } catch (e) {
                            setError(
                              e instanceof Error
                                ? e.message
                                : "Could not send feedback"
                            );
                          }
                        })();
                      }}
                      className="mt-2 w-full rounded-lg bg-indigo-600 py-1.5 text-[11px] font-bold text-white"
                    >
                      Send remark to student
                    </button>
                  </div>
                </div>
              )}
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
