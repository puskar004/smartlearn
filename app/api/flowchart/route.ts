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

function sanitize(raw: unknown, chapter: string, subject?: string): ChapterFlowchart {
  const fallback = findBankFlowchart(chapter) || genericFlowchart(chapter, subject);
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const nodesIn = Array.isArray(o.nodes) ? o.nodes : [];
  const edgesIn = Array.isArray(o.edges) ? o.edges : [];
  const nodes: FlowNode[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < Math.min(16, nodesIn.length); i++) {
    const n = nodesIn[i] as Record<string, unknown>;
    if (!n || typeof n !== "object") continue;
    const id = String(n.id || `n${i}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
    if (!id || ids.has(id)) continue;
    const kindRaw = String(n.kind || "concept") as FlowNodeKind;
    const kind = KINDS.has(kindRaw) ? kindRaw : "concept";
    const label = String(n.label || "Concept").trim().slice(0, 60);
    if (!label) continue;
    ids.add(id);
    nodes.push({
      id,
      label,
      kind,
      summary: n.summary ? String(n.summary).trim().slice(0, 120) : undefined,
    });
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
        ? String((e as FlowEdge).label).slice(0, 24)
        : undefined,
    });
  }
  if (nodes.length < 4) return fallback;
  // Ensure connectivity: if few edges, chain nodes
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
    ? o.examBullets.map((b) => String(b).trim().slice(0, 140)).filter(Boolean).slice(0, 6)
    : fallback.examBullets;
  return {
    chapter: String(o.chapter || chapter).trim().slice(0, 80) || chapter,
    subject: String(o.subject || subject || "").slice(0, 40) || subject,
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

    // Instant bank hit
    const bank = findBankFlowchart(chapter);
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!key) {
      const flow = bank || genericFlowchart(chapter, subject);
      return NextResponse.json({ ok: true, flowchart: flow, source: bank ? "bank" : "generic", demo: true });
    }

    const genAI = new GoogleGenerativeAI(key);
    const prompt = `You are CurioSphere, a CBSE Class 9–12 exam coach for Indian students.
Create a STUDY FLOWCHART overview for chapter revision BEFORE exams.

Return ONLY valid JSON (no markdown outside JSON) with this shape:
{
  "chapter": "string",
  "subject": "string",
  "grade": "${grade || "10-12"}",
  "examBullets": ["3-5 short exam facts/formulas"],
  "nodes": [
    { "id": "s", "label": "short", "kind": "start|concept|formula|exam|tip|end", "summary": "optional max 15 words" }
  ],
  "edges": [ { "from": "id", "to": "id", "label": "optional" } ]
}

Rules:
- 7 to 12 nodes only. Labels max 6 words. Clear left-to-right study order.
- kinds: one start, one end, mix concept/formula/exam/tip.
- edges must connect nodes into a readable flow (can branch once).
- CBSE/NCERT accurate. Language simple (English). No politics.
- Chapter: "${chapter}"${subject ? ` Subject: ${subject}` : ""}${grade ? ` Class: ${grade}` : ""}
`;

    let lastError = "";
    for (const name of MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: name,
          generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
        });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        if (!text?.trim()) continue;
        const parsed = extractJson(text);
        const flowchart = sanitize(parsed, chapter, subject);
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

    // Fallback bank / generic
    const flow = bank || genericFlowchart(chapter, subject);
    return NextResponse.json({
      ok: true,
      flowchart: flow,
      source: bank ? "bank" : "generic",
      demo: true,
      warn: lastError || "AI busy — used offline map",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
