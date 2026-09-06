"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Brain, Loader2, Sparkles, Lightbulb, History } from "lucide-react";
import { loadProgress, saveProgress } from "@/lib/user-store";
import { bumpTask } from "@/lib/tasks";
import MarkdownAnswer from "@/components/MarkdownAnswer";
import { CURRICULUM, type Grade } from "@/lib/curriculum";

const TIPS = [
  "Use everyday examples (street, kitchen, sports).",
  "Avoid jargon — if you must use a term, define it.",
  "Explain cause → effect in order.",
  "End with one exam-style one-liner.",
];

export default function FeynmanPage() {
  const { userId, isSignedIn } = useAuth();
  const [topic, setTopic] = useState("Ohm's law");
  const [explain, setExplain] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<
    { topic: string; score: number; at: number }[]
  >([]);

  useEffect(() => {
    if (!userId) return;
    setHistory(loadProgress(userId).feynmanScores || []);
  }, [userId]);

  const chapterTopics = useMemo(() => {
    if (!userId) return [] as string[];
    const p = loadProgress(userId);
    const grade = (p.grade || "12") as Grade;
    const pack = CURRICULUM.find((g) => g.grade === grade);
    if (!pack) return [];
    const ids = new Set(p.planChapterIds || []);
    const topics: string[] = [];
    for (const s of pack.subjects) {
      for (const ch of s.chapters) {
        if (ids.size === 0 || ids.has(ch.id)) {
          topics.push(`${ch.title} (${s.name})`);
          for (const t of ch.topics.slice(0, 2)) {
            topics.push(`${t} — ${ch.title}`);
          }
        }
      }
    }
    return topics.slice(0, 40);
  }, [userId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!explain.trim()) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: "Feynman Technique evaluation for CBSE student",
          question: `The student tried to explain "${topic}" in their own words (Feynman technique — teach like age 12):

"""
${explain}
"""

Score clarity from 0-100 for a CBSE Class board exam student.
Reply in this exact structure (markdown ok):
SCORE: <number>
STRENGTHS:
- bullet
- bullet
GAPS:
- bullet
- bullet
SIMPLER VERSION:
<5-8 line NCERT-simple re-explanation a Class student can memorize>
ONE EXAM LINE:
<one high-scoring board answer sentence>
`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const text = String(data.answer || "");
      setFeedback(text);
      const m = text.match(/SCORE:\s*(\d+)/i);
      const sc = m ? Math.min(100, Number(m[1])) : null;
      setScore(sc);
      if (userId && sc != null) {
        const p = loadProgress(userId);
        p.feynmanScores = [
          { topic, score: sc, at: Date.now() },
          ...p.feynmanScores,
        ].slice(0, 50);
        p.xp += Math.max(5, Math.round(sc / 10));
        const today = new Date().toISOString().slice(0, 10);
        if (p.lastStudyDay !== today) {
          const yesterday = new Date(Date.now() - 86400000)
            .toISOString()
            .slice(0, 10);
          p.streak = p.lastStudyDay === yesterday ? p.streak + 1 : 1;
          p.lastStudyDay = today;
        }
        saveProgress(p);
        try {
          window.dispatchEvent(new Event("sl-progress"));
        } catch {
          // ignore
        }
        bumpTask(userId, "weekly-feynman", 1);
        setHistory(p.feynmanScores);
      }
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-slate-500">
        Sign in to use Feynman Mode — explanations are saved only to your
        account.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
        <Brain className="h-3.5 w-3.5" /> Unique · Feynman Mode
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Teach it like you&apos;re 12
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Explain a concept in plain words. Gemini grades clarity, finds gaps, and
        gives a simpler NCERT-style version — real mastery, not copy-paste.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {TIPS.map((t) => (
          <div
            key={t}
            className="flex gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2 text-[11px] text-violet-900"
          >
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            {t}
          </div>
        ))}
      </div>

      {chapterTopics.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Quick pick from your syllabus
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chapterTopics.slice(0, 12).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTopic(t);
                  setExplain("");
                  setFeedback(null);
                  setScore(null);
                }}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  topic === t
                    ? "border-violet-500 bg-violet-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800"
                }`}
              >
                {t}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setTopic("");
                setExplain("");
                setFeedback(null);
                setScore(null);
              }}
              className="rounded-full border border-dashed border-violet-300 bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700"
            >
              + New topic
            </button>
          </div>
        </div>
      )}

      <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
          placeholder="Topic (e.g. Photosynthesis light reaction)"
        />
        <textarea
          value={explain}
          onChange={(e) => setExplain(e.target.value)}
          rows={7}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
          placeholder="Explain in plain words, as if teaching a younger sibling…"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-600/25 hover:bg-violet-500 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Grade my explanation
        </button>
      </form>

      {score != null && (
        <div className="mt-6 flex items-end gap-3">
          <p className="text-4xl font-black text-violet-600">{score}</p>
          <p className="pb-1 text-sm font-semibold text-slate-500">
            / 100 clarity
          </p>
        </div>
      )}
      {feedback && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <MarkdownAnswer content={feedback} />
        </div>
      )}

      <div className="mt-10">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
          <History className="h-3.5 w-3.5" /> Your recent Feynman scores
        </div>
        {history.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {history.slice(0, 8).map((h, i) => (
              <li
                key={`${h.at}-${i}`}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs"
              >
                <button
                  type="button"
                  className="text-left font-medium text-slate-700 hover:text-violet-700"
                  onClick={() => setTopic(h.topic)}
                >
                  {h.topic}
                </button>
                <span className="font-bold text-violet-600">{h.score}/100</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-400">
            No scores yet — explain a topic above.
          </p>
        )}
      </div>
    </div>
  );
}
