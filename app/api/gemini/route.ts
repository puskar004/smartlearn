import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
  "gemini-flash-latest",
];

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
          `**Demo mode (add GEMINI_API_KEY)**\n\n` +
          `**Your question:** ${question}\n\n` +
          `1. Identify NCERT keywords\n2. Recall definition/formula\n3. Apply with one example\n4. Write final answer clearly\n`,
        demo: true,
      });
    }

    const genAI = new GoogleGenerativeAI(key);
    const prompt = `You are SmartLearn, a calm CBSE Class 10–12 tutor for Indian students.

OUTPUT FORMAT (strict):
- Use GitHub-flavored Markdown only.
- Start with ## Answer
- Then ### Step-by-step with a numbered list (1. 2. 3.)
- Bold key terms with **like this**
- Use bullet lists for properties/points
- For formulas write them on their own line in backticks, e.g. \`V = IR\`
- End with ### Rapid revision tip (2 short lines)
- Do NOT use messy LaTeX blocks. Avoid raw \\( \\) noise. Prefer plain readable math.

Rules:
- Answer ONLY academic school questions (NCERT/CBSE).
- Refuse non-educational requests politely.
- Keep language simple for Indian board students.
${context ? `Context: ${context}\n` : ""}
Student question: ${question}`;

    let lastError = "";
    for (const name of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: name });
        const result = await model.generateContent(prompt);
        const answer = result.response.text();
        if (answer?.trim()) {
          return NextResponse.json({ answer, demo: false, model: name });
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // try next model on 404/503/high demand
        continue;
      }
    }

    return NextResponse.json(
      {
        error:
          lastError ||
          "AI tutor is busy right now. Please try again in a few seconds.",
      },
      { status: 503 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gemini failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
