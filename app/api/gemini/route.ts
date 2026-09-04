import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question = String(body.question || "").trim();
    const context = String(body.context || "").trim();

    if (!question) {
      return NextResponse.json({ error: "Question required" }, { status: 400 });
    }

    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) {
      return NextResponse.json({
        answer:
          `**Demo mode (add GEMINI_API_KEY to .env.local)**\n\n` +
          `**Your question:** ${question}\n\n` +
          `### Step-by-step approach\n` +
          `1. **Identify the chapter concept** — underline keywords from NCERT.\n` +
          `2. **Recall the definition / formula / law** linked to those keywords.\n` +
          `3. **Apply with a small example** (numbers or a short case).\n` +
          `4. **Write the final answer clearly** with units / conditions.\n` +
          `5. **Self-check** against NCERT in-text / exemplar style.\n\n` +
          `${context ? `**Context provided:** ${context}\n\n` : ""}` +
          `Add \`GEMINI_API_KEY\` for live Gemini tutoring.`,
        demo: true,
      });
    }

    const genAI = new GoogleGenerativeAI(key);
    const prompt = `You are SmartLearn, a calm CBSE Class 10–12 tutor.
Rules:
- Answer ONLY academic school questions (NCERT/CBSE science, maths, commerce, humanities, CS).
- Refuse non-educational / harmful / cheating-for-live-exam requests politely.
- Give STEP-BY-STEP solutions with clear numbering.
- Prefer NCERT terminology. Keep language simple for Indian students.
- End with a 2-line rapid revision tip.
${context ? `Chapter/context: ${context}\n` : ""}
Student question: ${question}`;

    const models = [
      "gemini-flash-latest",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
    ];
    let lastError = "";
    for (const name of models) {
      try {
        const model = genAI.getGenerativeModel({ model: name });
        const result = await model.generateContent(prompt);
        const answer = result.response.text();
        return NextResponse.json({ answer, demo: false, model: name });
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    throw new Error(lastError || "All Gemini models failed");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gemini failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
