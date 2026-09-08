"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Loader2, Radio, Shield, RefreshCw } from "lucide-react";
import MeetFrame from "@/components/MeetFrame";
import {
  dropJoinedClasses,
  getJoinedClass,
  getJoinedClasses,
  getRole,
  apiMarkAttendance,
  apiLeaveAttendance,
} from "@/lib/teacher-store";
import { displayName } from "@/lib/display-name";
import { useRouter } from "next/navigation";

type LiveInfo = {
  id?: string;
  title: string;
  subject: string;
  meetUrl?: string;
  joinCode: string;
  active: boolean;
  endsAt: number;
  joinUntil?: number;
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
  const lastAttended = useRef<string | null>(null);
  const preferredCode = useRef<string | null>(null);

  const applyRoom = useCallback(
    (
      room: {
        code?: string;
        name?: string;
        liveSession?: LiveInfo & { active?: boolean } | null;
      },
      joinedFallback?: string
    ) => {
      const code = room.code || joinedFallback || "";
      setClassName(room.name || "");
      setClassCode(code);

      const sess = room.liveSession;
      if (sess?.active) {
        const joinUntil =
          sess.joinUntil || sess.endsAt || Date.now() + 15 * 60_000;
        setLive({
          id: sess.id,
          title: sess.title,
          subject: sess.subject,
          meetUrl: sess.meetUrl,
          joinCode: sess.joinCode,
          active: true,
          endsAt: sess.endsAt || joinUntil,
          joinUntil,
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
          joinUntil: sess.joinUntil,
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
    [user]
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
      if (Array.isArray(data.deleted) && data.deleted.length) {
        dropJoinedClasses(userId, data.deleted as string[]);
      }
      const list = (data.classrooms || []) as {
        code: string;
        name: string;
        liveSession?: LiveInfo & { active?: boolean } | null;
      }[];
      const room = data.classroom as
        | {
            code?: string;
            name?: string;
            liveSession?: LiveInfo | null;
          }
        | null
        | undefined;

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
        list.find((x) => x.liveSession?.active) ||
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
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-8">
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
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800">
            <span>
              LIVE · {live.title} · {live.subject}
            </span>
            <span className="inline-flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" /> Join open until{" "}
              {new Date(
                live.joinUntil || live.endsAt || Date.now()
              ).toLocaleTimeString()}
            </span>
          </div>
          <MeetFrame
            meetUrl={live.meetUrl || ""}
            title={`${live.title} · Meet`}
          />
          <p className="text-[11px] text-slate-500">
            Meet link stays available for the full class session (at least 15
            minutes from start). Use the Join button above to open Google Meet.
          </p>
        </div>
      )}
    </div>
  );
}
