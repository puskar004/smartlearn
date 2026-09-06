import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODELS = [
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "").slice(0, 30000);
  if (text.trim().length < 15) {
    return NextResponse.json(
      {
        error:
          "Paste or upload question text first (at least a few lines of MCQs).",
      },
      { status: 400 }
    );
  }

  const local = naive(text);
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!key) {
    if (local.length === 0) {
      return NextResponse.json(
        {
          error:
            "Could not parse MCQs. Format like:\n1. Question?\nA) ...\nB) ...\nC) ...\nD) ...\nAnswer: A",
          questions: [],
        },
        { status: 400 }
      );
    }
    return NextResponse.json({
      ok: true,
      questions: local,
      source: "local-parser",
    });
  }

  const prompt = `Convert this exam paper into a JSON array of MCQs ONLY (no markdown fences).
Each item must be:
{"prompt":"question text","options":["optA","optB","optC","optD"],"correctIndex":0,"explanation":"short"}
Rules: max 30 questions; correctIndex 0-3; if answer key missing guess best option.
TEXT:
${text}`;

  for (const modelName of MODELS) {
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const raw = result.response.text();
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;
      const parsed = JSON.parse(jsonMatch[0]) as {
        prompt?: string;
        options?: string[];
        correctIndex?: number;
        explanation?: string;
      }[];
      const questions = (parsed || [])
        .filter((q) => q.prompt && Array.isArray(q.options) && q.options.length >= 2)
        .map((q) => ({
          prompt: String(q.prompt),
          options: q.options!.map(String).slice(0, 4),
          correctIndex: Math.min(
            3,
            Math.max(0, Number(q.correctIndex) || 0)
          ),
          explanation: String(q.explanation || ""),
        }));
      if (questions.length) {
        return NextResponse.json({
          ok: true,
          questions,
          source: `gemini:${modelName}`,
        });
      }
    } catch {
      // try next model
    }
  }

  if (local.length) {
    return NextResponse.json({
      ok: true,
      questions: local,
      source: "local-parser",
      note: "Gemini unavailable — used local parser",
    });
  }

  return NextResponse.json(
    {
      error:
        "Convert failed. Paste MCQs as:\n1. Q?\nA) a\nB) b\nC) c\nD) d\nAnswer: A",
      questions: [],
    },
    { status: 400 }
  );
}

function naive(raw: string) {
  const blocks = raw
    .split(/\n(?=\s*\d+[\).\:]\s)/)
    .map((b) => b.trim())
    .filter((b) => b.length > 8);
  const out: {
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[] = [];

  for (const b of blocks.slice(0, 40)) {
    const lines = b
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) continue;
    const prompt = lines[0].replace(/^\d+[\).\:]\s*/, "");
    const options = lines
      .slice(1)
      .filter((l) => /^[(\[]?[a-dA-D][)\].:\-]/i.test(l))
      .map((l) => l.replace(/^[(\[]?[a-dA-D][)\].:\-]\s*/i, "").trim())
      .filter(Boolean);
    if (options.length < 2) continue;
    let correctIndex = 0;
    const ans = b.match(
      /(?:answer|ans|correct)\s*[:\-]\s*([a-dA-D])/i
    );
    if (ans) correctIndex = ans[1].toUpperCase().charCodeAt(0) - 65;
    out.push({
      prompt,
      options: options.slice(0, 4),
      correctIndex: Math.min(options.length - 1, Math.max(0, correctIndex)),
      explanation: "",
    });
  }

  // fallback: split by blank lines
  if (out.length === 0) {
    const paras = raw.split(/\n\s*\n/).filter((p) => p.trim().length > 20);
    for (const p of paras.slice(0, 15)) {
      const lines = p.split(/\n/).map((l) => l.trim()).filter(Boolean);
      const opts = lines.filter((l) => /^[a-dA-D][\).]/.test(l));
      if (opts.length >= 2) {
        out.push({
          prompt: lines[0].replace(/^\d+[\).]\s*/, ""),
          options: opts
            .map((l) => l.replace(/^[a-dA-D][\).]\s*/i, ""))
            .slice(0, 4),
          correctIndex: 0,
          explanation: "",
        });
      }
    }
  }

  return out;
}
