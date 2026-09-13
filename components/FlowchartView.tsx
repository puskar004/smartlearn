"use client";

import { useMemo, useState } from "react";
import type { ChapterFlowchart, FlowNodeKind } from "@/lib/flowchart-types";
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

/** Level-order layout from edges */
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
  // include other roots
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
  // orphans
  for (const id of ids) {
    if (!seen.has(id)) {
      levels.push([id]);
      seen.add(id);
    }
  }
  return { levels, byId, outs };
}

export default function FlowchartView({
  flow,
}: {
  flow: ChapterFlowchart;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { levels, byId } = useMemo(() => layoutLevels(flow), [flow]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-violet-600">
            Chapter map
          </p>
          <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">
            {flow.chapter}
          </h2>
          {(flow.subject || flow.grade) && (
            <p className="mt-0.5 text-sm text-slate-500">
              {[flow.subject, flow.grade && `Class ${flow.grade}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
          {(Object.keys(KIND_LABEL) as FlowNodeKind[]).map((k) => (
            <span
              key={k}
              className={cn(
                "rounded-full px-2 py-0.5",
                KIND_STYLE[k].badge
              )}
            >
              {KIND_LABEL[k]}
            </span>
          ))}
        </div>
      </div>

      {/* Vertical flowchart */}
      <div className="relative mx-auto max-w-2xl">
        {levels.map((level, li) => (
          <div key={li} className="relative">
            {li > 0 && (
              <div className="flex justify-center py-1">
                <div className="flex h-8 w-8 items-center justify-center">
                  <svg width="24" height="32" viewBox="0 0 24 32" aria-hidden>
                    <path
                      d="M12 0 v22 M6 18 l6 8 6-8"
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            )}
            <div
              className={cn(
                "flex flex-wrap items-stretch justify-center gap-3",
                level.length > 1 && "px-1"
              )}
            >
              {level.map((id) => {
                const n = byId.get(id)!;
                const st = KIND_STYLE[n.kind] || KIND_STYLE.concept;
                const open = openId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setOpenId(open ? null : id)}
                    className={cn(
                      "w-full max-w-[280px] rounded-2xl border-2 px-4 py-3 text-left shadow-sm transition hover:shadow-md",
                      st.bg,
                      st.border,
                      open && "ring-4",
                      open && st.ring
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide",
                          st.badge
                        )}
                      >
                        {KIND_LABEL[n.kind]}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-extrabold leading-snug text-slate-900">
                      {n.label}
                    </p>
                    {open && n.summary && (
                      <p className="mt-2 border-t border-black/5 pt-2 text-xs leading-relaxed text-slate-600">
                        {n.summary}
                      </p>
                    )}
                    {!open && n.summary && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                        {n.summary}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {flow.examBullets?.length > 0 && (
        <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-amber-50 p-5">
          <p className="text-xs font-extrabold uppercase tracking-wide text-rose-700">
            Key points before the exam
          </p>
          <ul className="mt-3 space-y-2">
            {flow.examBullets.map((b, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm font-medium text-slate-800"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
