"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import MarkdownAnswer from "@/components/MarkdownAnswer";

function AiInner() {
  const sp = useSearchParams();
  const [question, setQuestion] = useState(sp.get("q") || "");
  const [context, setContext] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          context,
          format:
            "Respond in clean GitHub-flavored Markdown: use ## headings, numbered lists, **bold** key terms, and $...$ only if needed as plain text. No messy symbols.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setAnswer(data.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
        <Sparkles className="h-3.5 w-3.5" /> Gemini AI Tutor
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Step-by-step NCERT solutions
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Answers render as clean formatted notes (headings, lists, bold) — easy
        to revise.
      </p>

      <form onSubmit={ask} className="mt-8 space-y-3">
        <input
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Optional context (e.g. Class 12 Physics · Ray Optics)"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
        />
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
          placeholder="e.g. Derive mirror formula and explain sign convention with one numerical…"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Get step-by-step solution
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {answer && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">
            <Bot className="h-4 w-4 text-violet-600" /> SmartLearn Tutor
          </div>
          <MarkdownAnswer content={answer} />
        </div>
      )}
    </div>
  );
}

export default function AiTutorPage() {
  return (
    <Suspense fallback={<div className="p-10 text-sm">Loading tutor…</div>}>
      <AiInner />
    </Suspense>
  );
}
