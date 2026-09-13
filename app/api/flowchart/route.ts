import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import {
  findBankFlowchart,
  genericFlowchart,
} from "@/lib/flowchart-bank";
import type {
  ChapterFlowchart,
  FlowEdge,
  FlowNode,
  FlowNodeKind,
} from "@/lib/flowchart-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODELS = [
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

const KINDS = new Set<FlowNodeKind>([
  "start",
  "concept",
  "formula",
  "exam",
  "tip",
  "end",
]);

function cleanPoints(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const pts = raw
    .map((p) => String(p || "").trim().slice(0, 220))
    .filter(Boolean)
    .slice(0, 8);
  return pts.length ? pts : undefined;
}

function sanitize(
  raw: unknown,
  chapter: string,
  subject?: string
): ChapterFlowchart {
  const fallback =
    findBankFlowchart(chapter) || genericFlowchart(chapter, subject);
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const nodesIn = Array.isArray(o.nodes) ? o.nodes : [];
  const edgesIn = Array.isArray(o.edges) ? o.edges : [];
  const nodes: FlowNode[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < Math.min(22, nodesIn.length); i++) {
    const n = nodesIn[i] as Record<string, unknown>;
    if (!n || typeof n !== "object") continue;
    const id = String(n.id || `n${i}`)
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 24);
    if (!id || ids.has(id)) continue;
    const kindRaw = String(n.kind || "concept") as FlowNodeKind;
    const kind = KINDS.has(kindRaw) ? kindRaw : "concept";
    const label = String(n.label || "Concept").trim().slice(0, 90);
    if (!label) continue;
    ids.add(id);
    const summary = n.summary
      ? String(n.summary).trim().slice(0, 600)
      : undefined;
    const points = cleanPoints(n.points);
    nodes.push({ id, label, kind, summary, points });
  }
  const edges: FlowEdge[] = [];
  for (const e of edgesIn) {
    if (!e || typeof e !== "object") continue;
    const from = String((e as FlowEdge).from || "");
    const to = String((e as FlowEdge).to || "");
    if (!ids.has(from) || !ids.has(to) || from === to) continue;
    edges.push({
      from,
      to,
      label: (e as FlowEdge).label
        ? String((e as FlowEdge).label).slice(0, 40)
        : undefined,
    });
  }
  if (nodes.length < 5) return fallback;
  if (edges.length < nodes.length - 1) {
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i].id;
      const b = nodes[i + 1].id;
      if (!edges.some((x) => x.from === a && x.to === b)) {
        edges.push({ from: a, to: b });
      }
    }
  }
  const bullets = Array.isArray(o.examBullets)
    ? o.examBullets
        .map((b) => String(b).trim().slice(0, 280))
        .filter(Boolean)
        .slice(0, 14)
    : fallback.examBullets;
  return {
    chapter: String(o.chapter || chapter).trim().slice(0, 100) || chapter,
    subject: String(o.subject || subject || "").slice(0, 50) || subject,
    grade: o.grade ? String(o.grade).slice(0, 8) : undefined,
    examBullets: bullets.length ? bullets : fallback.examBullets,
    nodes,
    edges,
  };
}

function extractJson(text: string): unknown {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : t;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no json");
  return JSON.parse(body.slice(start, end + 1));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const chapter = String(body.chapter || "").trim().slice(0, 100);
    const subject = String(body.subject || "").trim().slice(0, 40);
    const grade = String(body.grade || "").trim().slice(0, 8);

    if (!chapter || chapter.length < 2) {
      return NextResponse.json(
        { error: "Chapter name required" },
        { status: 400 }
      );
    }

    const bank = findBankFlowchart(chapter);
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    // Prefer rich AI when key exists; bank only as fallback (or no key)
    if (!key) {
      const flow = bank || genericFlowchart(chapter, subject);
      return NextResponse.json({
        ok: true,
        flowchart: flow,
        source: bank ? "bank" : "generic",
        demo: true,
      });
    }

    const genAI = new GoogleGenerativeAI(key);
    const prompt = `You are CurioSphere, a CBSE/NCERT Class 9–12 exam coach for Indian students.
Build a DETAILED chapter REVISION FLOWCHART. A student should be able to revise MOST of the chapter by reading this map alone — not a thin outline.

Return ONLY valid JSON (no markdown fences if possible) with this shape:
{
  "chapter": "string",
  "subject": "string",
  "grade": "${grade || "10-12"}",
  "examBullets": ["8 to 12 exam-ready facts, formulas, definitions, or traps — each 1–2 full sentences"],
  "nodes": [
    {
      "id": "unique",
      "label": "clear title up to 10 words",
      "kind": "start|concept|formula|exam|tip|end",
      "summary": "2–4 full sentences of teachable content (definitions, why it matters, how it works)",
      "points": ["4 to 6 short revision bullets: facts, formulas, steps, examples"]
    }
  ],
  "edges": [ { "from": "id", "to": "id", "label": "optional short" } ]
}

Hard rules:
- 10 to 16 nodes covering the FULL chapter in logical study order (intro → concepts → laws/formulas → applications → diagrams → exam strategy → end).
- EVERY node (except maybe pure start) MUST have a detailed "summary" AND "points" array (min 3 points).
- Include real NCERT-level formulas, definitions, differences, and common board question angles.
- kinds: exactly one start, one end; several concept; at least two formula or tip; at least two exam.
- edges connect into a clear flow (one main path; at most one small branch).
- English only. Accurate CBSE/NCERT. No fluff, no politics, no "you should study hard" filler.
- Chapter: "${chapter}"${subject ? ` Subject: ${subject}` : ""}${grade ? ` Class: ${grade}` : ""}
`;

    let lastError = "";
    for (const name of MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: name,
          generationConfig: { temperature: 0.35, maxOutputTokens: 8192 },
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        if (!text?.trim()) continue;
        const parsed = extractJson(text);
        const flowchart = sanitize(parsed, chapter, subject);
        // Require real detail
        const detailed = flowchart.nodes.filter(
          (n) =>
            (n.summary && n.summary.length > 40) ||
            (n.points && n.points.length >= 2)
        ).length;
        if (detailed < 5) {
          lastError = "AI returned thin flowchart";
          continue;
        }
        return NextResponse.json({
          ok: true,
          flowchart,
          source: "gemini",
          model: name,
          demo: false,
        });
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        continue;
      }
    }

    const flow = bank || genericFlowchart(chapter, subject);
    return NextResponse.json({
      ok: true,
      flowchart: flow,
      source: bank ? "bank" : "generic",
      demo: true,
      warn: lastError || "AI busy — used offline detailed map",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
