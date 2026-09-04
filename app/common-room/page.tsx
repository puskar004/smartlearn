"use client";

import { FormEvent, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Clock, MessageSquare } from "lucide-react";

type Msg = {
  id: string;
  author: string;
  text: string;
  at: number;
};

const STORAGE = "sl_common_room_v1";
const COOLDOWN_SEC = 60;

export default function CommonRoomPage() {
  const { user, isSignedIn } = useUser();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setMsgs(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const persist = (next: Msg[]) => {
    setMsgs(next);
    localStorage.setItem(STORAGE, JSON.stringify(next.slice(0, 100)));
  };

  const post = (e: FormEvent) => {
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
    if (clean.length > 400) {
      setError("Keep it under 400 characters.");
      return;
    }

    const msg: Msg = {
      id: crypto.randomUUID(),
      author:
        user?.fullName ||
        user?.primaryEmailAddress?.emailAddress ||
        "Student",
      text: clean,
      at: Date.now(),
    };
    persist([msg, ...msgs]);
    setText("");
    setLeft(COOLDOWN_SEC);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
        <MessageSquare className="h-3.5 w-3.5" /> Common Room
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Discuss doubts — without spam
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Share academic questions with peers. A {COOLDOWN_SEC}s cooldown between
        posts keeps the room useful.
      </p>

      <form onSubmit={post} className="mt-6 space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="e.g. Can someone explain why image is virtual in a convex lens for object between F and O?"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            {left > 0 ? `Next post in ${left}s` : "Ready to post"}
          </div>
          <button
            type="submit"
            disabled={left > 0}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Post question
          </button>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </form>

      <ul className="mt-8 space-y-3">
        {msgs.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            No discussions yet — ask the first NCERT doubt.
          </li>
        )}
        {msgs.map((m) => (
          <li
            key={m.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-700">{m.author}</span>
              <span>{new Date(m.at).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-800">
              {m.text}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
