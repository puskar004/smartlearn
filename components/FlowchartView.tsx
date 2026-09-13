"use client";

import { useMemo, useState } from "react";
import type { ChapterFlowchart, FlowNodeKind } from "@/lib/flowchart-types";
import { toPlainMath } from "@/lib/plain-math";
import { cn } from "@/lib/utils";

const KIND_STYLE: Record<
  FlowNodeKind,
  { bg: string; border: string; badge: string; ring: string }
> = {
  start: {
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    badge: "bg-emerald-600 text-white",
    ring: "ring-emerald-200",
  },
  end: {
    bg: "bg-slate-100",
    border: "border-slate-300",
    badge: "bg-slate-700 text-white",
    ring: "ring-slate-200",
  },
  concept: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    badge: "bg-indigo-600 text-white",
    ring: "ring-indigo-100",
  },
  formula: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    badge: "bg-amber-500 text-white",
    ring: "ring-amber-100",
  },
  exam: {
    bg: "bg-rose-50",
    border: "border-rose-300",
    badge: "bg-rose-600 text-white",
    ring: "ring-rose-100",
  },
  tip: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    badge: "bg-violet-600 text-white",
    ring: "ring-violet-100",
  },
};

const KIND_LABEL: Record<FlowNodeKind, string> = {
  start: "Start",
  end: "Finish",
  concept: "Concept",
  formula: "Formula",
  exam: "Exam",
  tip: "Tip",
};

function layoutLevels(flow: ChapterFlowchart) {
  const ids = flow.nodes.map((n) => n.id);
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const outs = new Map<string, string[]>();
  const ins = new Map<string, number>();
  for (const id of ids) {
    outs.set(id, []);
    ins.set(id, 0);
  }
  for (const e of flow.edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue;
    outs.get(e.from)!.push(e.to);
    ins.set(e.to, (ins.get(e.to) || 0) + 1);
  }
  const roots = ids.filter((id) => (ins.get(id) || 0) === 0);
  const start =
    roots.find((id) => byId.get(id)?.kind === "start") || roots[0] || ids[0];
  const levels: string[][] = [];
  const seen = new Set<string>();
  let queue = start ? [start] : [];
  for (const r of roots) if (r !== start) queue.push(r);

  while (queue.length) {
    const level = queue.filter((id) => !seen.has(id));
    if (!level.length) break;
    level.forEach((id) => seen.add(id));
    levels.push(level);
    const next: string[] = [];
    for (const id of level) {
      for (const t of outs.get(id) || []) {
        if (!seen.has(t) && !next.includes(t)) next.push(t);
      }
    }
    queue = next;
  }
  for (const id of ids) {
    if (!seen.has(id)) {
      levels.push([id]);
      seen.add(id);
    }
  }
  return { levels, byId };
}

export default function FlowchartView({ flow }: { flow: ChapterFlowchart }) {
  // Clean any cached LaTeX so symbols show as plain math
  const cleanFlow = useMemo(() => {
    return {
      ...flow,
      chapter: toPlainMath(flow.chapter),
      subject: flow.subject ? toPlainMath(flow.subject) : flow.subject,
      examBullets: (flow.examBullets || []).map((b) => toPlainMath(b)),
      nodes: flow.nodes.map((n) => ({
        ...n,
        label: toPlainMath(n.label),
        summary: n.summary ? toPlainMath(n.summary) : n.summary,
        points: n.points?.map((p) => toPlainMath(p)),
      })),
      edges: flow.edges,
    };
  }, [flow]);

  const { levels, byId } = useMemo(
    () => layoutLevels(cleanFlow),
    [cleanFlow]
  );
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-violet-600">
            Full chapter revision map
          </p>
          <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">
            {cleanFlow.chapter}
          </h2>
          {(cleanFlow.subject || cleanFlow.grade) && (
            <p className="mt-0.5 text-sm text-slate-500">
              {[cleanFlow.subject, cleanFlow.grade && `Class ${cleanFlow.grade}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            Read top to bottom · each card is a revision block ·{" "}
            {cleanFlow.nodes.length} sections
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
          {(Object.keys(KIND_LABEL) as FlowNodeKind[]).map((k) => (
            <span
              key={k}
              className={cn("rounded-full px-2 py-0.5", KIND_STYLE[k].badge)}
            >
              {KIND_LABEL[k]}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-3xl">
        {levels.map((level, li) => (
          <div key={li} className="relative">
            {li > 0 && (
              <div className="flex justify-center py-1">
                <svg width="24" height="28" viewBox="0 0 24 28" aria-hidden>
                  <path
                    d="M12 0 v18 M6 14 l6 8 6-8"
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
            <div
              className={cn(
                "flex flex-wrap items-stretch justify-center gap-3",
                level.length > 1 && "px-1"
              )}
            >
              {level.map((id, idx) => {
                const n = byId.get(id)!;
                const st = KIND_STYLE[n.kind] || KIND_STYLE.concept;
                const isCollapsed = Boolean(collapsed[id]);
                const stepNo =
                  levels.slice(0, li).reduce((a, L) => a + L.length, 0) +
                  idx +
                  1;
                return (
                  <div
                    key={id}
                    className={cn(
                      "w-full max-w-xl rounded-2xl border-2 px-4 py-4 text-left shadow-sm sm:px-5",
                      st.bg,
                      st.border
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-[11px] font-extrabold text-slate-700 ring-1 ring-black/5">
                        {stepNo}
                      </span>
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide",
                          st.badge
                        )}
                      >
                        {KIND_LABEL[n.kind]}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggle(id)}
                        className="ml-auto text-[10px] font-bold text-slate-500 hover:text-slate-800"
                      >
                        {isCollapsed ? "Expand" : "Collapse"}
                      </button>
                    </div>
                    <p className="mt-2 text-base font-extrabold leading-snug text-slate-900 sm:text-lg">
                      {n.label}
                    </p>
                    {!isCollapsed && (
                      <>
                        {n.summary && (
                          <p className="mt-2 text-sm leading-relaxed text-slate-700">
                            {n.summary}
                          </p>
                        )}
                        {n.points && n.points.length > 0 && (
                          <ul className="mt-3 space-y-1.5 border-t border-black/5 pt-3">
                            {n.points.map((p, i) => (
                              <li
                                key={i}
                                className="flex gap-2 text-[13px] leading-snug text-slate-800"
                              >
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {cleanFlow.examBullets?.length > 0 && (
        <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-amber-50 p-5 sm:p-6">
          <p className="text-xs font-extrabold uppercase tracking-wide text-rose-700">
            Key points before the exam
          </p>
          <p className="mt-1 text-xs text-rose-800/70">
            Memorise these — highest yield facts for this chapter
          </p>
          <ul className="mt-4 space-y-3">
            {cleanFlow.examBullets.map((b, i) => (
              <li
                key={i}
                className="flex gap-3 text-sm font-medium leading-relaxed text-slate-800"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="font-mono text-[13px] sm:font-sans sm:text-sm">
                  {b}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
