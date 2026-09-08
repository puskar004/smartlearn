"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Loader2, Radio, Send, Shield, Ban, RefreshCw } from "lucide-react";
import MeetFrame from "@/components/MeetFrame";
import {
  getJoinedClass,
  getJoinedClasses,
  getRole,
  apiPostMessage,
  apiMarkAttendance,
  apiLeaveAttendance,
} from "@/lib/teacher-store";
import { displayName } from "@/lib/display-name";
import { useRouter } from "next/navigation";
import { pushNotification } from "@/lib/notifications";

type Msg = { id: string; author: string; text: string; at: number };

type LiveInfo = {
  id?: string;
  title: string;
  subject: string;
  meetUrl?: string;
  joinCode: string;
  active: boolean;
  endsAt: number;
  messages: Msg[];
  scheduledAt?: number;
};

export default function LiveClassPage() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [live, setLive] = useState<LiveInfo | null>(null);
  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [sections, setSections] = useState<
    { code: string; name: string; live?: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [kickReason, setKickReason] = useState("");
  const lastAttended = useRef<string | null>(null);
  const kickNotified = useRef(false);
  const preferredCode = useRef<string | null>(null);

  const applyRoom = useCallback(
    (
      room: {
        code?: string;
        name?: string;
        liveSession?: LiveInfo & {
          kickedIds?: string[];
          active?: boolean;
        } | null;
        kicked?: boolean;
        kickReason?: string;
      },
      joinedFallback?: string
    ) => {
      const code = room.code || joinedFallback || "";
      setClassName(room.name || "");
      setClassCode(code);

      if (room.kicked) {
        setKicked(true);
        setKickReason(room.kickReason || "Removed by teacher");
        setLive(null);
        if (!kickNotified.current && userId) {
          kickNotified.current = true;
          pushNotification(userId, {
            title: "Kicked from live class",
            body: room.kickReason || "Teacher removed you",
            href: "/remarks",
          });
        }
        setError(null);
        return;
      }

      setKicked(false);
      const sess = room.liveSession;
      if (sess?.active) {
        setLive({
          id: sess.id,
          title: sess.title,
          subject: sess.subject,
          meetUrl: sess.meetUrl,
          joinCode: sess.joinCode,
          active: true,
          endsAt: sess.endsAt,
          messages: sess.messages || [],
          scheduledAt: sess.scheduledAt,
        });
        setError(null);
        if (code && sess.id && lastAttended.current !== `${code}:${sess.id}`) {
          lastAttended.current = `${code}:${sess.id}`;
          void apiMarkAttendance(
            code,
            displayName(user) || user?.fullName || "Student"
          );
        }
      } else if (sess?.scheduledAt && sess.scheduledAt > Date.now()) {
        setLive({
          title: sess.title,
          subject: sess.subject,
          meetUrl: sess.meetUrl,
          joinCode: sess.joinCode || "",
          active: false,
          endsAt: sess.endsAt || sess.scheduledAt,
          messages: [],
          scheduledAt: sess.scheduledAt,
        });
        setError(null);
      } else {
        setLive(null);
        setError(
          code
            ? `Joined class ${code}. No live session yet — wait for your teacher to start Live, then tap Refresh.`
            : "Join a teacher class first (Class & Notes)."
        );
      }
    },
    [user, userId]
  );

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const localCodes = getJoinedClasses(userId);
      const q = new URLSearchParams({ action: "joined" });
      if (localCodes.length) q.set("codes", localCodes.join(","));
      q.set("_", String(Date.now()));

      const res = await fetch(`/api/classroom?${q.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await res.json();
      const list = (data.classrooms || []) as {
        code: string;
        name: string;
        liveSession?: LiveInfo & { active?: boolean } | null;
        kicked?: boolean;
        kickReason?: string;
      }[];
      const room = data.classroom as
        | {
            code?: string;
            name?: string;
            liveSession?: LiveInfo | null;
            kicked?: boolean;
            kickReason?: string;
          }
        | null
        | undefined;

      // If API empty but local join exists, still show waiting state for that code
      if (!room && !list.length) {
        if (localCodes.length) {
          setSections(
            localCodes.map((c) => ({ code: c, name: `Class ${c}`, live: false }))
          );
          setClassCode(localCodes[0]);
          setClassName(`Class ${localCodes[0]}`);
          setLive(null);
          setError(
            `Joined ${localCodes[0]}. Waiting for teacher to go live — tap Refresh.`
          );
        } else {
          setLive(null);
          setSections([]);
          setError("Join a teacher class first (Class & Notes).");
        }
        setLoading(false);
        return;
      }

      const sec = (list.length ? list : room ? [room] : []).map((r) => ({
        code: String(r.code || ""),
        name: r.name || String(r.code || ""),
        live: Boolean(r.liveSession?.active),
      }));
      setSections(sec.filter((s) => s.code));

      const pick =
        (preferredCode.current &&
          list.find((x) => x.code === preferredCode.current)) ||
        list.find((x) => x.liveSession?.active && !x.kicked) ||
        list.find((x) => x.code === data.joined) ||
        room ||
        list[0];

      if (!pick) {
        setLive(null);
        setError("Join a teacher class first (Class & Notes).");
        setLoading(false);
        return;
      }

      applyRoom(pick, data.joined || localCodes[0]);
    } catch {
      setError("Could not load live class. Check connection and Refresh.");
    } finally {
      setLoading(false);
    }
  }, [userId, applyRoom]);

  useEffect(() => {
    if (!userId) return;
    if (getRole(userId) === "teacher") return;
    void load();
    // Poll often so live appears soon after teacher starts
    const id = setInterval(() => void load(), 6_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("sl_live_alert_")) void load();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("storage", onStorage);
    };
  }, [userId, load]);

  const leaveLive = async () => {
    if (classCode && userId) {
      void apiLeaveAttendance(classCode);
    }
    lastAttended.current = null;
    router.push("/dashboard");
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!msg.trim() || !classCode || kicked) return;
    setSending(true);
    try {
      await apiPostMessage(
        classCode,
        displayName(user) || "Student",
        msg.trim()
      );
      setMsg("");
      await load();
    } finally {
      setSending(false);
    }
  };

  if (!isSignedIn) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        <Link href="/login" className="font-bold text-indigo-600 underline">
          Sign in
        </Link>{" "}
        as student to attend live class.
      </div>
    );
  }

  if (userId && getRole(userId) === "teacher") {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Teachers start live from{" "}
        <Link href="/teacher?tab=live" className="font-bold text-indigo-600">
          Teacher → Live
        </Link>
      </div>
    );
  }

  if (kicked) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 shadow-sm">
          <Ban className="mx-auto h-12 w-12 text-rose-600" />
          <h1 className="mt-4 text-2xl font-extrabold text-rose-900">
            Removed from live class
          </h1>
          <p className="mt-2 text-sm text-rose-800">
            {kickReason || "Your teacher kicked you from this session."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/remarks"
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white"
            >
              Open Remarks
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-800"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-8">
      <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
        <Radio className="h-3.5 w-3.5" /> Live class
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Attend online class
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {className || getJoinedClass(userId || "") || "Your class"}
            {classCode ? (
              <span className="ml-2 font-mono text-xs text-slate-400">
                · {classCode}
              </span>
            ) : null}
          </p>
          {sections.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sections.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => {
                    preferredCode.current = s.code;
                    lastAttended.current = null;
                    kickNotified.current = false;
                    setKicked(false);
                    void load();
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                    classCode === s.code
                      ? "border-rose-300 bg-rose-50 text-rose-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-rose-200"
                  }`}
                >
                  {s.name}
                  {s.live ? " · LIVE" : ""}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          {live?.active && (
            <button
              type="button"
              onClick={() => void leaveLive()}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Leave live · back to study
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="mt-10 flex justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {error && !live?.active && !live?.scheduledAt && !loading && (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {error}
          <div className="mt-3 flex flex-wrap justify-center gap-3">
            <Link
              href="/join-class"
              className="font-bold text-indigo-600 underline"
            >
              Class &amp; Notes
            </Link>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load();
              }}
              className="font-bold text-rose-600 underline"
            >
              Refresh live status
            </button>
          </div>
        </div>
      )}

      {live?.scheduledAt && !live.active && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <strong>Scheduled:</strong> {live.title} · {live.subject}
          <div className="mt-1 text-xs">
            Starts {new Date(live.scheduledAt).toLocaleString()}
          </div>
          {live.meetUrl && (
            <div className="mt-3">
              <MeetFrame meetUrl={live.meetUrl} title="Upcoming Meet" />
            </div>
          )}
        </div>
      )}

      {live?.active && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800">
              <span>
                LIVE · {live.title} · {live.subject}
              </span>
              <span className="inline-flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" /> In session
              </span>
            </div>
            <MeetFrame
              meetUrl={live.meetUrl || ""}
              title={`${live.title} · Meet`}
            />
          </div>

          <div className="flex min-h-[320px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-3 py-2 text-xs font-bold text-slate-800">
              Class chat
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {(live.messages || []).length === 0 && (
                <p className="text-center text-[11px] text-slate-400">
                  No messages yet
                </p>
              )}
              {(live.messages || []).map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs"
                >
                  <div className="font-bold text-slate-800">{m.author}</div>
                  <div className="text-slate-600">{m.text}</div>
                  <div className="text-[10px] text-slate-400">
                    {new Date(m.at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => void send(e)}
              className="flex gap-2 border-t border-slate-100 p-2"
            >
              <input
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Message the class…"
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-900 placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={sending || !msg.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                <Send className="h-3 w-3" /> Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
