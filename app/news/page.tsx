"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ExternalLink,
  Loader2,
  Newspaper,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EduNewsItem } from "@/app/api/edu-news/route";

const CATS = [
  "All",
  "CBSE",
  "NTA",
  "JEE",
  "NEET",
  "Form",
  "Board",
  "Other",
] as const;

const CAT_COLOR: Record<string, string> = {
  CBSE: "bg-indigo-100 text-indigo-800",
  NTA: "bg-violet-100 text-violet-800",
  JEE: "bg-amber-100 text-amber-900",
  NEET: "bg-emerald-100 text-emerald-800",
  Form: "bg-rose-100 text-rose-800",
  Board: "bg-sky-100 text-sky-800",
  Other: "bg-slate-100 text-slate-700",
};

export default function NewsPage() {
  const [items, setItems] = useState<EduNewsItem[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/edu-news", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setItems(data.items || []);
      setNote(data.note || "");
      setUpdatedAt(data.updatedAt || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load news");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (cat === "All") return items;
    return items.filter((i) => i.category === cat);
  }, [items, cat]);

  const deadlines = useMemo(
    () =>
      items.filter(
        (i) =>
          i.category === "Form" ||
          /deadline|last date|registration|apply|form/i.test(i.title)
      ),
    [items]
  );

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8">
      <div className="overflow-hidden rounded-[28px] border border-sky-100 bg-gradient-to-r from-sky-50 via-indigo-50 to-violet-50 p-6 shadow-sm sm:p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-sky-800 shadow-sm">
          <Newspaper className="h-3.5 w-3.5" /> Exam News Desk
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          CBSE · NTA · JEE · NEET updates
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Live headlines: syllabus circulars, NTA notices, and competitive exam
          form deadlines — so you never miss a date.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {updatedAt && (
            <span>
              Updated {new Date(updatedAt).toLocaleString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 font-bold text-sky-700 shadow-sm ring-1 ring-sky-100 hover:bg-sky-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />{" "}
            Refresh
          </button>
        </div>
      </div>

      {/* Deadlines strip */}
      {deadlines.length > 0 && (
        <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50/80 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-rose-900">
            <CalendarClock className="h-4 w-4" /> Form / deadline alerts
          </div>
          <ul className="mt-3 space-y-2">
            {deadlines.slice(0, 5).map((d) => (
              <li key={d.id}>
                <a
                  href={d.link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-2 text-xs font-semibold text-rose-900 hover:underline"
                >
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                  {d.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-bold transition",
              cat === c
                ? "bg-sky-600 text-white shadow"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-sky-50"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {loading && (
        <div className="mt-12 flex justify-center text-slate-400">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      )}

      {error && (
        <p className="mt-6 text-center text-sm font-semibold text-rose-600">
          {error}
        </p>
      )}

      {!loading && (
        <>
          {note && (
            <p className="mt-4 text-center text-[11px] text-slate-400">{note}</p>
          )}
          <ul className="mt-4 space-y-3">
            {filtered.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-sky-200 hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      CAT_COLOR[item.category] || CAT_COLOR.Other
                    )}
                  >
                    {item.category}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {item.source}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ·{" "}
                    {isNaN(Date.parse(item.published))
                      ? item.published
                      : new Date(item.published).toLocaleString()}
                  </span>
                </div>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block text-sm font-bold leading-snug text-slate-900 hover:text-sky-700"
                >
                  {item.title}
                </a>
                {item.summary && (
                  <p className="mt-1 text-xs text-slate-500">{item.summary}</p>
                )}
                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:underline"
                >
                  Read full <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
          {filtered.length === 0 && (
            <p className="mt-8 text-center text-sm text-slate-400">
              No items in this category right now.
            </p>
          )}
        </>
      )}

      <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-[11px] text-slate-500">
        <strong className="text-slate-700">Official portals:</strong>{" "}
        <a
          className="font-semibold text-indigo-600 hover:underline"
          href="https://cbseacademic.nic.in/"
          target="_blank"
          rel="noreferrer"
        >
          CBSE Academic
        </a>
        {" · "}
        <a
          className="font-semibold text-indigo-600 hover:underline"
          href="https://nta.ac.in/"
          target="_blank"
          rel="noreferrer"
        >
          NTA
        </a>
        {" · "}
        <a
          className="font-semibold text-indigo-600 hover:underline"
          href="https://jeemain.nta.nic.in/"
          target="_blank"
          rel="noreferrer"
        >
          JEE Main
        </a>
        {" · "}
        <a
          className="font-semibold text-indigo-600 hover:underline"
          href="https://neet.nta.nic.in/"
          target="_blank"
          rel="noreferrer"
        >
          NEET
        </a>
      </div>
    </div>
  );
}
