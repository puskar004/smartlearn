"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  GitBranch,
  Loader2,
  Sparkles,
  BookOpen,
  RefreshCw,
} from "lucide-react";
import { CURRICULUM, type Grade } from "@/lib/curriculum";
import { loadProgress } from "@/lib/user-store";
import type { ChapterFlowchart } from "@/lib/flowchart-types";
import FlowchartView from "@/components/FlowchartView";
import { cn } from "@/lib/utils";

const CACHE_KEY = "sl_flowchart_cache_v2";

function cacheGet(key: string): ChapterFlowchart | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, ChapterFlowchart>;
    return all[key] || null;
  } catch {
    return null;
  }
}

function cacheSet(key: string, flow: ChapterFlowchart) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const all = (raw ? JSON.parse(raw) : {}) as Record<string, ChapterFlowchart>;
    all[key] = flow;
    const keys = Object.keys(all);
    if (keys.length > 40) {
      for (const k of keys.slice(0, keys.length - 30)) delete all[k];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

export default function FlowchartPage() {
  const { userId } = useAuth();
  const [chapter, setChapter] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState<Grade | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flow, setFlow] = useState<ChapterFlowchart | null>(null);
  const [source, setSource] = useState<string>("");
  const [warn, setWarn] = useState<string>("");

  useEffect(() => {
    if (!userId) return;
    const p = loadProgress(userId);
    if (p.grade) setGrade(p.grade as Grade);
  }, [userId]);

  const suggestions = useMemo(() => {
    const g = (grade || "10") as Grade;
    const pack = CURRICULUM.find((x) => x.grade === g);
    if (!pack) return [] as { title: string; subject: string }[];
    const out: { title: string; subject: string }[] = [];
    for (const s of pack.subjects) {
      for (const ch of s.chapters.slice(0, 8)) {
        out.push({ title: ch.title, subject: s.name });
      }
    }
    return out.slice(0, 18);
  }, [grade]);

  const generate = async (e?: FormEvent, force = false) => {
    e?.preventDefault();
    const ch = chapter.trim();
    if (ch.length < 2) {
      setError("Enter a chapter name (at least 2 characters).");
      return;
    }
    setError(null);
    setWarn("");
    const cacheKey = `${grade || "x"}|${subject || "x"}|${ch.toLowerCase()}`;
    if (!force) {
      const hit = cacheGet(cacheKey);
      if (hit) {
        setFlow(hit);
        setSource("cache");
        return;
      }
    }
    setLoading(true);
    try {
      const res = await fetch("/api/flowchart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapter: ch,
          subject: subject || undefined,
          grade: grade || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      const fc = data.flowchart as ChapterFlowchart;
      if (!fc?.nodes?.length) throw new Error("Empty flowchart");
      setFlow(fc);
      setSource(String(data.source || "api"));
      if (data.warn) setWarn(String(data.warn));
      cacheSet(cacheKey, fc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const pick = (title: string, sub: string) => {
    setChapter(title);
    setSubject(sub);
    setError(null);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
        <GitBranch className="h-3.5 w-3.5" />
        Exam overview map
      </div>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
        Chapter Flowchart
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">
        Enter a chapter name to get a detailed revision flowchart — concepts,
        formulas, bullets, and exam points so you can revise the whole chapter
        from one map.
      </p>

      <form
        onSubmit={(e) => void generate(e)}
        className="mt-8 space-y-3 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-bold text-slate-600 sm:col-span-1">
            Class
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value as Grade | "")}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-400"
            >
              <option value="">Any</option>
              <option value="10">Class 10</option>
              <option value="11">Class 11</option>
              <option value="12">Class 12</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-600 sm:col-span-2">
            Subject (optional)
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Physics, Science, Maths"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
            />
          </label>
        </div>
        <label className="block text-xs font-bold text-slate-600">
          Chapter name
          <input
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder="e.g. Photosynthesis · Quadratic Equations · Electricity"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-indigo-400"
            required
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-500 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate flowchart
          </button>
          {flow && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void generate(undefined, true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </button>
          )}
        </div>
      </form>

      {suggestions.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <BookOpen className="h-3.5 w-3.5" />
            Quick pick (Class {grade || "10"})
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.title + s.subject}
                type="button"
                onClick={() => pick(s.title, s.subject)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                  chapter === s.title
                    ? "border-indigo-400 bg-indigo-50 text-indigo-800"
                    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/50"
                )}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}
      {warn && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          {warn}
        </p>
      )}

      {flow && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          {source && (
            <p className="mb-4 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Source: {source}
              {source === "cache" ? " · local" : ""}
            </p>
          )}
          <FlowchartView flow={flow} />
        </div>
      )}

      {!flow && !loading && (
        <div className="mt-10 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 px-6 py-12 text-center">
          <GitBranch className="mx-auto h-10 w-10 text-indigo-300" />
          <p className="mt-3 text-sm font-semibold text-slate-600">
            Pick a chapter or type a name, then tap Generate
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Each card has full notes + bullets · exam checklist at the bottom
          </p>
        </div>
      )}
    </div>
  );
}
