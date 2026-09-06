"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Loader2, Radio, Shield } from "lucide-react";
import MeetFrame from "@/components/MeetFrame";
import { setSessionLock } from "@/components/SessionLock";
import { getJoinedClass, getRole } from "@/lib/teacher-store";

type LiveInfo = {
  title: string;
  subject: string;
  meetUrl?: string;
  joinCode: string;
  active: boolean;
  endsAt: number;
};

export default function LiveClassPage() {
  const { userId, isSignedIn } = useAuth();
  const [live, setLive] = useState<LiveInfo | null>(null);
  const [className, setClassName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/classroom?action=joined");
      const data = await res.json();
      const room = data.classroom;
      if (!room) {
        setLive(null);
        setError("Join a teacher class first (Join Teacher).");
        return;
      }
      setClassName(room.name || "");
      const sess = room.liveSession;
      if (sess?.active) {
        setLive({
          title: sess.title,
          subject: sess.subject,
          meetUrl: sess.meetUrl,
          joinCode: sess.joinCode,
          active: true,
          endsAt: sess.endsAt,
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
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (getRole(userId) === "teacher") return;
    void load();
    const id = setInterval(() => void load(), 8000);
    return () => clearInterval(id);
  }, [userId, load]);

  useEffect(() => {
    if (live?.active) {
      setSessionLock(true, "live");
      return () => setSessionLock(false);
    }
    setSessionLock(false);
  }, [live?.active]);

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
        <Radio className="h-3.5 w-3.5" /> Live class · screen lock on
      </div>
      <h1 className="mt-3 text-2xl font-extrabold text-slate-900 sm:text-3xl">
        Attend online class
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {className || getJoinedClass(userId) || "Your class"} · Google Meet opens
        here · lock stays while session is live
      </p>

      {loading && (
        <div className="mt-10 flex justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {error && !live && (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {error}
          <div className="mt-3">
            <Link href="/join-class" className="font-bold text-indigo-600 underline">
              Join Teacher
            </Link>
          </div>
        </div>
      )}

      {live && (
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800">
            <span>
              LIVE · {live.title} · {live.subject}
            </span>
            <span className="inline-flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" /> Locked to this session
            </span>
          </div>
          <MeetFrame
            meetUrl={live.meetUrl || ""}
            title={`${live.title} · Meet`}
          />
          {!live.meetUrl && (
            <p className="text-center text-xs text-amber-700">
              Teacher has not set a Google Meet link yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
