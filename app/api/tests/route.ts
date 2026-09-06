import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  addTestMoment,
  deleteTest,
  findTestByCode,
  genTestCode,
  listTeacherTests,
  readVideoChunk,
  saveTest,
  saveVideoChunk,
  submitTest,
  type LiveTest,
  type TestMcq,
} from "@/lib/test-server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const mine = req.nextUrl.searchParams.get("mine");
  const video = req.nextUrl.searchParams.get("video");
  const { userId } = await auth();

  if (video) {
    if (!userId)
      return NextResponse.json({ error: "Sign in" }, { status: 401 });
    const buf = await readVideoChunk(video);
    if (!buf) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "video/webm",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  if (code) {
    const t = await findTestByCode(code);
    if (!t)
      return NextResponse.json(
        { error: "Invalid code — test not found or teacher deleted it" },
        { status: 404 }
      );
    if (!t.active && userId !== t.teacherId) {
      return NextResponse.json(
        { error: "Test is closed by teacher" },
        { status: 403 }
      );
    }
    const publicQ = t.questions.map(
      ({ correctIndex, explanation, ...rest }) => rest
    );
    const isTeacher = userId === t.teacherId;
    return NextResponse.json({
      ok: true,
      test: {
        ...t,
        // stay live until teacher closes — ignore endsAt for join
        questions: isTeacher ? t.questions : publicQ,
        submissions: isTeacher ? t.submissions : {},
      },
    });
  }

  if (mine === "1") {
    if (!userId)
      return NextResponse.json({ error: "Sign in" }, { status: 401 });
    const tests = await listTeacherTests(userId);
    return NextResponse.json({ ok: true, tests });
  }

  return NextResponse.json({ error: "code or mine required" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const user = await currentUser();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "create");

  if (action === "submit") {
    const code = String(body.code || "");
    const answers = Array.isArray(body.answers) ? body.answers.map(Number) : [];
    const name =
      user?.fullName ||
      user?.firstName ||
      user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
      "Student";
    try {
      const result = await submitTest(code, userId, name, answers);
      return NextResponse.json({ ok: true, result });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Submit failed" },
        { status: 400 }
      );
    }
  }

  if (action === "close") {
    const code = String(body.code || "");
    const t = await findTestByCode(code);
    if (!t || t.teacherId !== userId)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    t.active = false;
    await saveTest(t);
    return NextResponse.json({ ok: true, test: t });
  }

  if (action === "delete") {
    const code = String(body.code || "");
    try {
      await deleteTest(userId, code);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Delete failed" },
        { status: 400 }
      );
    }
  }

  if (action === "moment") {
    const code = String(body.code || "");
    const moment = body.moment || {};
    const name =
      user?.fullName ||
      user?.firstName ||
      user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
      "Student";
    try {
      const moments = await addTestMoment(code, userId, name, {
        at: Number(moment.at) || Date.now(),
        imageDataUrl: moment.imageDataUrl,
        audioDataUrl: moment.audioDataUrl,
        note: moment.note,
        videoKey: moment.videoKey,
      });
      return NextResponse.json({ ok: true, count: moments.length });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Moment failed" },
        { status: 400 }
      );
    }
  }

  if (action === "video") {
    const code = String(body.code || "");
    const dataUrl = String(body.dataUrl || "");
    if (!dataUrl) {
      return NextResponse.json({ error: "No video data" }, { status: 400 });
    }
    try {
      const key = await saveVideoChunk(code, userId, dataUrl, "webm");
      return NextResponse.json({ ok: true, videoKey: key });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Video save failed" },
        { status: 400 }
      );
    }
  }

  // create — stays live until teacher closes (endsAt is soft/info only)
  const title = String(body.title || "Class Test").slice(0, 120);
  const durationMin = Math.min(180, Math.max(5, Number(body.durationMin) || 30));
  let questions = (body.questions || []) as TestMcq[];

  if ((!questions || questions.length === 0) && body.rawText) {
    questions = parseSimpleMcq(String(body.rawText));
  }

  if (!questions.length) {
    return NextResponse.json(
      { error: "Add MCQ questions or paste question text / use Convert PDF" },
      { status: 400 }
    );
  }

  const normalized: TestMcq[] = questions
    .map((q, i) => ({
      id: q.id || `q-${i + 1}`,
      prompt: String(q.prompt || "").slice(0, 800),
      options: (q.options || []).map((o) => String(o).slice(0, 200)).slice(0, 6),
      correctIndex: Math.max(0, Number(q.correctIndex) || 0),
      explanation: q.explanation
        ? String(q.explanation).slice(0, 400)
        : undefined,
    }))
    .filter((q) => q.prompt && q.options.length >= 2);

  if (!normalized.length) {
    return NextResponse.json({ error: "No valid MCQs" }, { status: 400 });
  }

  const now = Date.now();
  const YEAR = 365 * 24 * 60 * 60 * 1000;
  const test: LiveTest = {
    id: `test-${now}`,
    code: genTestCode(),
    title,
    teacherId: userId,
    teacherName: user?.fullName || user?.firstName || "Teacher",
    classCode: body.classCode ? String(body.classCode) : undefined,
    durationMin,
    questions: normalized,
    createdAt: now,
    startsAt: now,
    // far future — only teacher close ends joinability
    endsAt: now + YEAR,
    active: true,
    submissions: {},
  };

  await saveTest(test);
  return NextResponse.json({ ok: true, test });
}

function parseSimpleMcq(raw: string): TestMcq[] {
  const blocks = raw
    .split(/\n(?=\d+[\).])/)
    .filter((b) => b.trim().length > 10);
  const out: TestMcq[] = [];
  for (const b of blocks.slice(0, 40)) {
    const lines = b
      .trim()
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 3) continue;
    const prompt = lines[0].replace(/^\d+[\).]\s*/, "");
    const opts = lines
      .slice(1)
      .filter((l) => /^[a-dA-D][\).]/.test(l) || /^[(\[]?[a-dA-D][)\]]/.test(l))
      .map((l) => l.replace(/^[(\[]?[a-dA-D][)\].:\-]\s*/i, ""));
    if (opts.length < 2) continue;
    let correctIndex = 0;
    const ans = b.match(/answer\s*[:\-]\s*([a-d])/i);
    if (ans) correctIndex = ans[1].toLowerCase().charCodeAt(0) - 97;
    out.push({
      id: `q-${out.length + 1}`,
      prompt,
      options: opts.slice(0, 4),
      correctIndex,
    });
  }
  return out;
}
