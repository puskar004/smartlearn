"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2, Play, Search, Shield, X } from "lucide-react";
import Link from "next/link";
import { ytEmbed } from "@/lib/media-catalog";

type Result = {
  id: string;
  title: string;
  channel: string;
  thumbnail?: string;
  watchUrl: string;
  educational?: boolean;
};

export default function SafeSearchPage() {
  const [q, setQ] = useState("Class 12 Physics Ray Optics NCERT");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [related, setRelated] = useState<Result[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [active, setActive] = useState<Result | null>(null);

  const normalize = (list: Result[]) =>
    list.map((r) => {
      const id = r.id.includes("-") ? r.id.split("-")[0] : r.id;
      return {
        ...r,
        id,
        watchUrl: ytEmbed(id),
        thumbnail: r.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    });

  const search = async (e?: FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/youtube-edu?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.blocked) {
        setResults([]);
        setRelated([]);
        setActive(null);
        setMessage(data.message);
        return;
      }
      const list = normalize((data.results || []) as Result[]);
      setResults(list);
      if (list[0]) {
        setActive(list[0]);
        void loadRelated(list[0].id, q);
      }
      if (data.note) setMessage(data.note);
    } catch {
      setMessage("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const loadRelated = async (videoId: string, query: string) => {
    try {
      const res = await fetch(
        `/api/youtube-edu?q=${encodeURIComponent(query)}&related=${encodeURIComponent(videoId)}`
      );
      const data = await res.json();
      const list = normalize((data.results || []) as Result[]).filter(
        (r) => r.id !== videoId
      );
      setRelated(list.slice(0, 8));
    } catch {
      setRelated([]);
    }
  };

  const play = (r: Result) => {
    const id = r.id.includes("-") ? r.id.split("-")[0] : r.id;
    const next = { ...r, id, watchUrl: ytEmbed(id, { autoplay: true }) };
    setActive(next);
    void loadRelated(id, q);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        <Shield className="h-3.5 w-3.5" /> In-App Safe Search · related videos
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Educational YouTube inside SmartLearn
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">
        Videos play here with related lectures below. Entertainment queries are
        blocked.
      </p>

      <form onSubmit={search} className="mt-8 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400"
          placeholder="e.g. Class 10 Life Processes nutrition"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Search
        </button>
      </form>

      {message && <p className="mt-3 text-xs text-slate-500">{message}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          "Class 12 Current Electricity Kirchhoff",
          "Class 11 Organic Chemistry IUPAC",
          "Class 10 Quadratic Equations",
          "Class 12 Biology Molecular Basis of Inheritance",
        ].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setQ(s)}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
          >
            {s}
          </button>
        ))}
      </div>

      {active && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-black shadow-xl">
          <div className="flex items-center justify-between gap-2 bg-slate-900 px-3 py-2">
            <div className="truncate text-xs font-semibold text-white">
              {active.title}
            </div>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Close player"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <iframe
            key={active.id + "-player"}
            title={active.title}
            src={ytEmbed(active.id, { autoplay: true })}
            className="aspect-video w-full bg-black"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <div className="bg-slate-950 px-3 py-2 text-[11px] text-slate-500">
            Playing inside SmartLearn · {active.channel} · related below
          </div>
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-slate-800">Related videos</h2>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {related.map((r) => (
              <button
                key={`rel-${r.id}`}
                type="button"
                onClick={() => play(r)}
                className="w-44 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm hover:border-emerald-300"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.thumbnail}
                  alt=""
                  className="h-24 w-full object-cover"
                />
                <div className="p-2 text-[11px] font-semibold leading-snug text-slate-800 line-clamp-2">
                  {r.title}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {results.map((r) => (
          <div
            key={r.id + r.title}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            {r.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.thumbnail}
                alt=""
                className="mb-3 h-36 w-full rounded-xl object-cover"
              />
            )}
            <div className="text-sm font-bold text-slate-900">{r.title}</div>
            <div className="mt-1 text-xs text-slate-500">{r.channel}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => play(r)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
              >
                <Play className="h-3 w-3" /> Play here
              </button>
              <Link
                href={`/ai-tutor?q=${encodeURIComponent(
                  `Explain key points of: ${r.title}`
                )}`}
                className="rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-bold text-violet-800"
              >
                Ask Gemini
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
