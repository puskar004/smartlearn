"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Loader2, Radio, Send, Shield } from "lucide-react";
import MeetFrame from "@/components/MeetFrame";
import {
  getJoinedClass,
  getRole,
  apiPostMessage,
  apiMarkAttendance,
  apiLeaveAttendance,
} from "@/lib/teacher-store";
import { displayName } from "@/lib/display-name";
import { useRouter } from "next/navigation";

type Msg = { id: string; author: string; text: string; at: number };

type LiveInfo = {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const lastAttended = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch("/api/classroom?action=joined");
      const data = await res.json();
      const room = data.classroom;
      if (!room) {
        setLive(null);
        setError("Join a teacher class first (Join Teacher).");
        setLoading(false);
        return;
      }
      setClassName(room.name || "");
      setClassCode(room.code || data.joined || "");
      const sess = room.liveSession;
      if (sess?.active) {
        setLive({
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
        if (sess.id && lastAttended.current !== sess.id) {
          lastAttended.current = sess.id;
          void apiMarkAttendance(
            room.code || data.joined || "",
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
        setError("No live session right now. Wait for your teacher to go live.");
      }
    } catch {
      setError("Could not load live class");
    } finally {
      setLoading(false);
    }
  }, [userId, user]);

  useEffect(() => {
    if (!userId) return;
    if (getRole(userId) === "teacher") return;
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
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
    if (!msg.trim() || !classCode) return;
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
          </p>
        </div>
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
      <p className="mt-2 text-[11px] text-slate-400">
        You can leave anytime and still use NCERT PDFs, quizzes, and the rest of
        SmartLearn while class continues.
      </p>

      {loading && (
        <div className="mt-10 flex justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {error && !live?.active && !live?.scheduledAt && (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {error}
          <div className="mt-3">
            <Link
              href="/join-class"
              className="font-bold text-indigo-600 underline"
            >
              Join Teacher
            </Link>
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
                <Shield className="h-3.5 w-3.5" /> Focus session
              </span>
            </div>
            <MeetFrame meetUrl={live.meetUrl || ""} title={`${live.title} · Meet`} />
          </div>

          {/* In-room chat — teacher + students */}
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
