"use client";

import { FormEvent, useState } from "react";
import { Loader2, Play, Search, Shield } from "lucide-react";
import Link from "next/link";

type Result = {
  id: string;
  title: string;
  channel: string;
  thumbnail?: string;
  watchUrl?: string;
  searchTerm?: string;
  educational?: boolean;
};

export default function SafeSearchPage() {
  const [q, setQ] = useState("Class 12 Physics Ray Optics NCERT");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  const search = async (e?: FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setMessage(null);
    setActive(null);
    try {
      const res = await fetch(`/api/youtube-edu?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.blocked) {
        setResults([]);
        setMessage(data.message);
        return;
      }
      setResults(data.results || []);
      if (data.note) setMessage(data.note);
    } catch {
      setMessage("Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        <Shield className="h-3.5 w-3.5" /> In-App Safe Search · Education only
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Educational YouTube — locked to studies
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">
        Queries are forced through a CBSE/NCERT education filter. Entertainment,
        gaming, and non-study terms are blocked. Stay on this tab — Focus Lock
        alerts parents if you leave.
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

      {message && (
        <p className="mt-3 text-xs text-slate-500">{message}</p>
      )}

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
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-lg">
          <iframe
            title="Educational video"
            src={active}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {results.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="text-sm font-bold text-slate-900">{r.title}</div>
            <div className="mt-1 text-xs text-slate-500">{r.channel}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.watchUrl?.includes("embed") ? (
                <button
                  type="button"
                  onClick={() => setActive(r.watchUrl!)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                >
                  <Play className="h-3 w-3" /> Play in-app
                </button>
              ) : (
                <a
                  href={r.watchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                >
                  <Play className="h-3 w-3" /> Open edu results
                </a>
              )}
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
