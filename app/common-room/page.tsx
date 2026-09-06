"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  Clock,
  ImagePlus,
  Loader2,
  MessageSquare,
  Reply,
  Users,
  X,
  ZoomIn,
} from "lucide-react";
import { pushNotification } from "@/lib/notifications";
import { displayName } from "@/lib/display-name";

type Msg = {
  id: string;
  author: string;
  authorId?: string;
  text: string;
  imageDataUrl?: string;
  replyToId?: string;
  replyToAuthor?: string;
  replyToText?: string;
  at: number;
};

const COOLDOWN_SEC = 20;
const MAX_CHARS = 200;
const LOCAL_KEY = "sl_common_room_cache_v3";
const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

function keepFresh(list: Msg[]) {
  const cut = Date.now() - TWO_DAYS;
  return list.filter((m) => (m.at || 0) >= cut);
}

function buildThreads(list: Msg[]): { root: Msg; replies: Msg[] }[] {
  const byId = new Map(list.map((m) => [m.id, m]));
  const children = new Map<string, Msg[]>();
  for (const m of list) {
    if (!m.replyToId || !byId.has(m.replyToId)) continue;
    const arr = children.get(m.replyToId) || [];
    arr.push(m);
    children.set(m.replyToId, arr);
  }
  const collect = (id: string, acc: Msg[] = []): Msg[] => {
    const kids = (children.get(id) || []).slice().sort((a, b) => a.at - b.at);
    for (const k of kids) {
      acc.push(k);
      collect(k.id, acc);
    }
    return acc;
  };
  const roots = list
    .filter((m) => !m.replyToId || !byId.has(m.replyToId))
    .slice()
    .sort((a, b) => b.at - a.at);
  return roots.map((root) => ({ root, replies: collect(root.id) }));
}

/** Compress image so Photo button always works under size limits */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 900;
        let w = img.width;
        let h = img.height;
        if (w > max || h > max) {
          const r = Math.min(max / w, max / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        let q = 0.72;
        let data = canvas.toDataURL("image/jpeg", q);
        while (data.length > 280_000 && q > 0.35) {
          q -= 0.08;
          data = canvas.toDataURL("image/jpeg", q);
        }
        resolve(data);
      };
      img.onerror = () => reject(new Error("image"));
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function PostBody({
  m,
  onReply,
  onLightbox,
  compact,
}: {
  m: Msg;
  onReply: (m: Msg) => void;
  onLightbox: (src: string) => void;
  compact?: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
          <MessageSquare className="h-3 w-3 text-sky-500" />
          {m.author}
        </span>
        <span>{new Date(m.at).toLocaleString()}</span>
      </div>
      {m.text && m.text !== "📷 Photo" && (
        <p
          className={`mt-2 leading-relaxed text-slate-800 ${compact ? "text-xs" : "text-sm"}`}
        >
          {m.text}
        </p>
      )}
      {m.imageDataUrl && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onLightbox(m.imageDataUrl!);
          }}
          className="group relative mt-3 block max-w-full cursor-zoom-in overflow-hidden rounded-xl border border-slate-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.imageDataUrl}
            alt="shared"
            className={`pointer-events-none w-auto object-contain transition group-hover:opacity-95 ${compact ? "max-h-40" : "max-h-64"}`}
          />
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
            <ZoomIn className="h-3 w-3" /> Enlarge
          </span>
        </button>
      )}
      <div className="mt-2">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onReply(m);
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-bold text-sky-800 hover:bg-sky-100"
        >
          <Reply className="h-3.5 w-3.5" /> Reply
        </button>
      </div>
    </>
  );
}

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
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const textRef = useRef<HTMLTextAreaElement>(null);

  const merge = useCallback(
    (incoming: Msg[]) => {
      const map = new Map<string, Msg>();
      try {
        const cached = JSON.parse(
          localStorage.getItem(LOCAL_KEY) || "[]"
        ) as Msg[];
        for (const m of cached) map.set(m.id, m);
      } catch {
        // ignore
      }
      for (const m of incoming) map.set(m.id, m);
      const list = keepFresh(
        Array.from(map.values()).sort((a, b) => b.at - a.at)
      ).slice(0, 300);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
      setMsgs(list);

      if (userId) {
        for (const m of incoming) {
          if (seenIds.current.has(m.id)) continue;
          seenIds.current.add(m.id);
          if (m.authorId && m.authorId !== userId) {
            pushNotification(userId, {
              title: m.replyToId ? "Common Room reply" : "Common Room",
              body: `${m.author}: ${m.text.slice(0, 80)}`,
              href: "/common-room",
            });
          }
        }
      }
    },
    [userId]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/common-room");
      const data = await res.json();
      if (data.messages) merge(data.messages);
      else {
        try {
          setMsgs(JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"));
        } catch {
          // ignore
        }
      }
    } catch {
      try {
        setMsgs(JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"));
      } catch {
        // ignore
      }
    } finally {
      setLoading(false);
    }
  }, [merge]);

  useEffect(() => {
    try {
      const cached = keepFresh(
        JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") as Msg[]
      );
      cached.forEach((m) => seenIds.current.add(m.id));
      if (cached.length) setMsgs(cached);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(cached));
    } catch {
      // ignore
    }
    void load();
    const id = setInterval(() => void load(), 12_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  useEffect(() => {
    if (!lightbox) {
      delete document.documentElement.dataset.modalOpen;
      return;
    }
    document.documentElement.dataset.modalOpen = "1";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      delete document.documentElement.dataset.modalOpen;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightbox]);

  const onFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only images allowed.");
      return;
    }
    setError(null);
    try {
      const data = await compressImage(file);
      setImage(data);
    } catch {
      setError("Could not read photo. Try another image.");
    }
  };

  const startReply = (m: Msg) => {
    setReplyTo(m);
    window.setTimeout(() => {
      textRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      textRef.current?.focus();
    }, 50);
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
        body: JSON.stringify({
          text: clean,
          imageDataUrl: image || undefined,
          replyToId: replyTo?.id,
          replyToAuthor: replyTo?.author,
          replyToText: replyTo?.text?.slice(0, 80),
        }),
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
      setReplyTo(null);
      setLeft(COOLDOWN_SEC);
      if (userId) {
        pushNotification(userId, {
          title: replyTo ? "Reply posted" : "Posted to Common Room",
          body: replyTo
            ? `Replied to ${replyTo.author}`
            : "Your question is visible to all students.",
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
        Chat + photos stay <strong>at least 2 days</strong>. Tap photo to
        enlarge · Reply · Max {MAX_CHARS} chars. Signed in as{" "}
        <strong className="text-slate-700">{displayName(user)}</strong>
      </p>

      <form onSubmit={(e) => void post(e)} className="mt-6 space-y-3">
        {replyTo && (
          <div className="flex items-start justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs">
            <div>
              <div className="font-bold text-sky-800">
                Replying to {replyTo.author}
              </div>
              <div className="text-sky-700/80 line-clamp-2">
                {replyTo.text}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="rounded-lg p-1 text-sky-700 hover:bg-sky-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="relative">
          <textarea
            ref={textRef}
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
              onClick={() => setLightbox(image)}
              className="h-24 cursor-zoom-in rounded-xl border border-slate-200 object-cover"
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
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <ImagePlus className="h-3.5 w-3.5" /> Photo
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  void onFile(e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={left > 0 || posting}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {posting && <Loader2 className="h-4 w-4 animate-spin" />}
            {replyTo ? "Post reply" : "Post to everyone"}
          </button>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </form>

      {loading && msgs.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-400">Loading room…</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {msgs.length === 0 && (
            <li className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              No posts yet — ask the first NCERT doubt.
            </li>
          )}
          {buildThreads(msgs).map(({ root, replies }) => (
            <li
              key={root.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-200 hover:shadow-md"
            >
              <PostBody
                m={root}
                onReply={startReply}
                onLightbox={setLightbox}
              />
              {replies.length > 0 && (
                <ul className="mt-3 space-y-2 border-l-2 border-sky-100 pl-3 sm:pl-4">
                  {replies.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"
                    >
                      {r.replyToAuthor && r.replyToId !== root.id && (
                        <div className="mb-1.5 text-[10px] font-semibold text-slate-400">
                          <Reply className="mr-1 inline h-2.5 w-2.5" />
                          to {r.replyToAuthor}
                        </div>
                      )}
                      <PostBody
                        m={r}
                        onReply={startReply}
                        onLightbox={setLightbox}
                        compact
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal
          data-modal-open="1"
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-10 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="enlarged"
            className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
