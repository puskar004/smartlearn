"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  CheckCircle2,
  Circle,
  ListTodo,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteTask,
  loadTasks,
  toggleTaskDone,
  type StudyTask,
  type TaskCadence,
} from "@/lib/tasks";
import { addXp } from "@/lib/user-store";
import { cn } from "@/lib/utils";

export default function TaskChecklist({
  floating = true,
}: {
  floating?: boolean;
}) {
  const { userId, isSignedIn } = useAuth();
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (userId) setTasks(loadTasks(userId));
  }, [userId]);

  if (!isSignedIn || !userId) return null;

  const doneCount = tasks.filter((t) => t.completed).length;

  const body = (
    <div className="flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-violet-100 bg-white/95 shadow-xl shadow-violet-500/10 backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
          <ListTodo className="h-4 w-4 text-violet-600" />
          Auto progress
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
            {doneCount}/{tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {floating && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <p className="border-b border-slate-100 bg-violet-50/50 px-3 py-1.5 text-[10px] text-violet-800">
        System tracks quizzes, NCERT, Feynman &amp; PYQs automatically.
      </p>

      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {(["daily", "weekly", "monthly"] as TaskCadence[]).map((c) => {
          const group = tasks.filter((t) => t.cadence === c);
          if (!group.length) return null;
          return (
            <li key={c} className="mb-2">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {c}
              </div>
              {group.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-xl px-2 py-2 transition",
                    t.completed
                      ? "bg-emerald-50/80 hover:bg-emerald-50"
                      : "hover:bg-violet-50"
                  )}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const was = t.completed;
                      const next = toggleTaskDone(userId, t.id);
                      setTasks(next);
                      if (!was) addXp(userId, 3);
                    }}
                    className="mt-0.5 shrink-0"
                    title="Toggle done"
                  >
                    {t.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-300" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const was = t.completed;
                      const next = toggleTaskDone(userId, t.id);
                      setTasks(next);
                      if (!was) addXp(userId, 3);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div
                      className={cn(
                        "text-xs font-semibold",
                        t.completed
                          ? "text-emerald-800 line-through"
                          : "text-slate-800"
                      )}
                    >
                      {t.title}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {t.done}/{t.target} {t.unit}
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          t.completed ? "bg-emerald-500" : "bg-violet-500"
                        )}
                        style={{
                          width: `${Math.min(100, (t.done / t.target) * 100)}%`,
                        }}
                      />
                    </div>
                  </button>
                  <button
                    type="button"
                    title="Delete task"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete task “${t.title}”?`)) {
                        setTasks(deleteTask(userId, t.id));
                      }
                    }}
                    className="mt-0.5 shrink-0 rounded-lg p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );

  if (!floating) return body;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-500"
      >
        <ListTodo className="h-4 w-4" />
        Tasks {doneCount}/{tasks.length}
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[min(100vw-1.5rem,320px)]">
      {body}
    </div>
  );
}
