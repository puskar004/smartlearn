"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Brain, Loader2, Sparkles } from "lucide-react";
import { loadProgress, saveProgress } from "@/lib/user-store";
import MarkdownAnswer from "@/components/MarkdownAnswer";

export default function FeynmanPage() {
  const { userId, isSignedIn } = useAuth();
  const [topic, setTopic] = useState("Ohm's law");
  const [explain, setExplain] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

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
          question: `The student tried to explain "${topic}" in their own words:

"""
${explain}
"""

Score clarity from 0-100.
Reply in this exact structure:
SCORE: <number>
STRENGTHS: <2 bullets>
GAPS: <2 bullets>
SIMPLER VERSION: <5-8 line NCERT-simple re-explanation a Class student can memorize>
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
        p.xp += Math.round(sc / 10);
        saveProgress(p);
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
        Most apps only give answers. SmartLearn forces you to explain — then AI
        grades clarity and fills gaps. That&apos;s real mastery.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          placeholder="Topic (e.g. Photosynthesis light reaction)"
        />
        <textarea
          value={explain}
          onChange={(e) => setExplain(e.target.value)}
          rows={6}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
          placeholder="Explain in plain words, as if teaching a younger sibling…"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
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
        <p className="mt-6 text-3xl font-black text-violet-600">
          Clarity {score}/100
        </p>
      )}
      {feedback && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <MarkdownAnswer content={feedback} />
        </div>
      )}
    </div>
  );
}
