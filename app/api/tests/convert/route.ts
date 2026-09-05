import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "").slice(0, 20000);
  if (text.length < 40) {
    return NextResponse.json(
      { error: "Paste question paper text (from PDF) — at least a few questions." },
      { status: 400 }
    );
  }

  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    // fallback naive parse
    return NextResponse.json({
      ok: true,
      questions: naive(text),
      source: "local-parser",
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(
      `Convert this exam paper text into JSON MCQ array only (no markdown).
Each item: {"prompt":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"short"}
Max 25 questions. If answer key missing, best-guess correctIndex.
TEXT:
${text}`
    );
    const raw = result.response.text();
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const questions = jsonMatch ? JSON.parse(jsonMatch[0]) : naive(text);
    return NextResponse.json({ ok: true, questions, source: "gemini" });
  } catch (e) {
    return NextResponse.json({
      ok: true,
      questions: naive(text),
      source: "local-parser",
      note: e instanceof Error ? e.message : "gemini failed",
    });
  }
}

function naive(raw: string) {
  const blocks = raw.split(/\n(?=\d+[\).])/).filter((b) => b.trim().length > 10);
  const out = [];
  for (const b of blocks.slice(0, 25)) {
    const lines = b.trim().split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;
    const prompt = lines[0].replace(/^\d+[\).]\s*/, "");
    const options = lines
      .slice(1)
      .filter((l) => /^[a-dA-D][\).]/.test(l))
      .map((l) => l.replace(/^[a-dA-D][\).]\s*/i, ""));
    if (options.length < 2) continue;
    out.push({ prompt, options: options.slice(0, 4), correctIndex: 0, explanation: "" });
  }
  return out;
}
