"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Clock, Loader2, MessageSquare, Users } from "lucide-react";

type Msg = {
  id: string;
  author: string;
  authorId?: string;
  text: string;
  at: number;
};

const COOLDOWN_SEC = 45;

export default function CommonRoomPage() {
  const { user, isSignedIn } = useUser();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/common-room");
      const data = await res.json();
      if (data.messages) setMsgs(data.messages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const post = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isSignedIn) {
      setError("Sign in to post in the common room.");
      return;
    }
    if (left > 0) {
      setError(`Anti-spam timer: wait ${left}s before next post.`);
      return;
    }
    const clean = text.trim();
    if (clean.length < 4) {
      setError("Write a clearer academic question/comment.");
      return;
    }

    setPosting(true);
    try {
      const res = await fetch("/api/common-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to post");
        return;
      }
      if (data.messages) setMsgs(data.messages);
      setText("");
      setLeft(COOLDOWN_SEC);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
        <Users className="h-3.5 w-3.5" /> Common Room · all students
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Shared doubt wall
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Every logged-in student can post questions here. Messages are visible to
        all students (auto-refresh). Keep it academic.
      </p>

      <form onSubmit={(e) => void post(e)} className="mt-6 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="e.g. Why is image virtual for object between F and O in a convex lens?"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            {left > 0 ? `Next post in ${left}s` : "Ready to post"}
          </div>
          <button
            type="submit"
            disabled={left > 0 || posting}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {posting && <Loader2 className="h-4 w-4 animate-spin" />}
            Post to everyone
          </button>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </form>

      {loading ? (
        <p className="mt-8 text-center text-sm text-slate-400">Loading room…</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {msgs.length === 0 && (
            <li className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              No posts yet — ask the first NCERT doubt for the whole community.
            </li>
          )}
          {msgs.map((m) => (
            <li
              key={m.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-200 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  <MessageSquare className="h-3 w-3 text-sky-500" />
                  {m.author}
                </span>
                <span>{new Date(m.at).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-800">
                {m.text}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
