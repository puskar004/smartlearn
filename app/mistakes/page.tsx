"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { AlertTriangle, Brain, Trash2 } from "lucide-react";
import {
  hardResetUser,
  loadProgress,
  type MistakeItem,
  type UserProgress,
} from "@/lib/user-store";

export default function MistakeVaultPage() {
  const { userId, isSignedIn } = useAuth();
  const [p, setP] = useState<UserProgress | null>(null);

  useEffect(() => {
    if (userId) setP(loadProgress(userId));
  }, [userId]);

  if (!isSignedIn || !userId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Mistake Vault</h1>
        <p className="mt-2 text-sm text-slate-500">
          Sign in so wrong answers become your personal revision bank — not
          mixed with anyone else.
        </p>
      </div>
    );
  }

  const mistakes: MistakeItem[] = p?.mistakes || [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
        <AlertTriangle className="h-3.5 w-3.5" /> Unique · Mistake Vault
      </div>
      <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
        Your personal error DNA
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Unlike generic apps, SmartLearn only stores <strong>your</strong> wrong
        answers. New account = empty vault. Re-learn what YOU actually miss.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/quiz"
          className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white"
        >
          <Brain className="h-3.5 w-3.5" /> Practice board quiz
        </Link>
        <button
          type="button"
          onClick={() => {
            if (confirm("Wipe ALL your SmartLearn progress on this device?")) {
              setP(hardResetUser(userId));
            }
          }}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
        >
          <Trash2 className="h-3.5 w-3.5" /> Fresh start
        </button>
      </div>

      <ul className="mt-8 space-y-3">
        {mistakes.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
            Vault empty — take a chapter quiz. Wrong answers land here
            automatically.
          </li>
        )}
        {mistakes.map((m) => (
          <li
            key={m.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="text-[11px] font-bold uppercase tracking-wide text-rose-600">
              Class {m.grade} · {m.subjectName} · {m.chapterTitle}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {m.prompt}
            </p>
            <p className="mt-2 text-xs text-rose-700">
              You chose: <strong>{m.yourAnswer}</strong>
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Correct: <strong>{m.correctAnswer}</strong>
            </p>
            <p className="mt-2 text-xs text-slate-500">{m.explanation}</p>
            <Link
              href={`/quiz/${m.chapterId}`}
              className="mt-3 inline-block text-xs font-bold text-indigo-600 hover:underline"
            >
              Re-quiz this chapter →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
