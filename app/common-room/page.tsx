"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Clock, ImagePlus, Loader2, MessageSquare, Users, X } from "lucide-react";
import { pushNotification } from "@/lib/notifications";
import { useAuth } from "@clerk/nextjs";

type Msg = {
  id: string;
  author: string;
  authorId?: string;
  text: string;
  imageDataUrl?: string;
  at: number;
};

const COOLDOWN_SEC = 30;
const MAX_CHARS = 200;
const LOCAL_KEY = "sl_common_room_cache_v2";

export default function CommonRoomPage() {
  const { user, isSignedIn } = useUser();
  const { userId } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const merge = useCallback((incoming: Msg[]) => {
    const map = new Map<string, Msg>();
    try {
      const cached = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") as Msg[];
      for (const m of cached) map.set(m.id, m);
    } catch {
      // ignore
    }
    for (const m of incoming) map.set(m.id, m);
    const list = Array.from(map.values()).sort((a, b) => b.at - a.at).slice(0, 300);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    setMsgs(list);

    // notify about others' new posts
    if (userId) {
      for (const m of incoming) {
        if (seenIds.current.has(m.id)) continue;
        seenIds.current.add(m.id);
        if (m.authorId && m.authorId !== userId) {
          pushNotification(userId, {
            title: "Common Room",
            body: `${m.author}: ${m.text.slice(0, 80)}`,
            href: "/common-room",
          });
        }
      }
    }
  }, [userId]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/common-room");
      const data = await res.json();
      if (data.messages) merge(data.messages);
      else {
        // fallback cache
        try {
          const cached = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
          setMsgs(cached);
        } catch {
          // ignore
        }
      }
    } catch {
      try {
        const cached = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
        setMsgs(cached);
      } catch {
        // ignore
      }
    } finally {
      setLoading(false);
    }
  }, [merge]);

  useEffect(() => {
    // seed seen set so we don't notify on first load
    try {
      const cached = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") as Msg[];
      cached.forEach((m) => seenIds.current.add(m.id));
      if (cached.length) setMsgs(cached);
    } catch {
      // ignore
    }
    void load();
    const id = setInterval(() => void load(), 4000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const onFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only images allowed.");
      return;
    }
    if (file.size > 280_000) {
      setError("Image too large (max ~280KB). Compress and retry.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result || ""));
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const post = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isSignedIn) {
      setError("Sign in to post in the common room.");
      return;
    }
    if (left > 0) {
      setError(`Wait ${left}s before next post.`);
      return;
    }
    const clean = text.trim();
    if (clean.length < 1 && !image) {
      setError("Write a message or attach a photo.");
      return;
    }
    if (clean.length > MAX_CHARS) {
      setError(`Max ${MAX_CHARS} characters.`);
      return;
    }

    setPosting(true);
    try {
      const res = await fetch("/api/common-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, imageDataUrl: image || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to post");
        return;
      }
      if (data.messages) merge(data.messages);
      else if (data.message) merge([data.message, ...msgs]);
      setText("");
      setImage(null);
      setLeft(COOLDOWN_SEC);
      if (userId) {
        pushNotification(userId, {
          title: "Posted to Common Room",
          body: "Your question is visible to all students.",
          href: "/common-room",
        });
      }
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
        Posts stay saved for everyone. You can also attach a small photo. Max{" "}
        {MAX_CHARS} characters.
      </p>

      <form onSubmit={(e) => void post(e)} className="mt-6 space-y-3">
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            rows={3}
            maxLength={MAX_CHARS}
            placeholder="e.g. Why is image virtual for object between F and O in a convex lens?"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pb-8 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
          <span
            className={`pointer-events-none absolute bottom-2 right-3 text-[11px] font-semibold ${
              text.length >= MAX_CHARS ? "text-rose-600" : "text-slate-400"
            }`}
          >
            {text.length}/{MAX_CHARS}
          </span>
        </div>

        {image && (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt="attach"
              className="h-24 rounded-xl border border-slate-200 object-cover"
            />
            <button
              type="button"
              onClick={() => setImage(null)}
              className="absolute -right-2 -top-2 rounded-full bg-rose-600 p-1 text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              {left > 0 ? `Next post in ${left}s` : "Ready"}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <ImagePlus className="h-3.5 w-3.5" /> Photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] || null)}
            />
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

      {loading && msgs.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-400">Loading room…</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {msgs.length === 0 && (
            <li className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              No posts yet — ask the first NCERT doubt.
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
              {m.text && m.text !== "📷 Photo" && (
                <p className="mt-2 text-sm leading-relaxed text-slate-800">
                  {m.text}
                </p>
              )}
              {m.imageDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.imageDataUrl}
                  alt="shared"
                  className="mt-3 max-h-64 rounded-xl border border-slate-100 object-contain"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
