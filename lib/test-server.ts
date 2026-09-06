import { clerkClient } from "@clerk/nextjs/server";
import { promises as fs } from "fs";
import path from "path";

export type TestMcq = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

export type LiveTest = {
  id: string;
  code: string;
  title: string;
  teacherId: string;
  teacherName: string;
  classCode?: string;
  durationMin: number;
  questions: TestMcq[];
  createdAt: number;
  startsAt: number;
  endsAt: number;
  active: boolean;
  /** studentId → answers + proctor moments */
  submissions: Record<
    string,
    {
      name: string;
      answers: number[];
      score: number;
      total: number;
      at: number;
      moments?: {
        at: number;
        imageDataUrl?: string;
        audioDataUrl?: string;
        note?: string;
      }[];
    }
  >;
};

type Meta = {
  liveTests?: LiveTest[];
  [k: string]: unknown;
};

function filePath() {
  const base = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), ".data");
  return path.join(base, "smartlearn-tests.json");
}

async function readFile(): Promise<LiveTest[]> {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    return (JSON.parse(raw) as { tests?: LiveTest[] }).tests || [];
  } catch {
    return [];
  }
}

async function writeFile(tests: LiveTest[]) {
  const fp = filePath();
  try {
    await fs.mkdir(path.dirname(fp), { recursive: true });
  } catch {
    // ignore
  }
  await fs.writeFile(fp, JSON.stringify({ tests }), "utf8");
}

function metaOf(user: { publicMetadata?: Record<string, unknown> | null }): Meta {
  const m = (user.publicMetadata || {}) as Record<string, unknown>;
  return (m.smartlearn as Meta) || {};
}

export function genTestCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "T";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function saveTest(test: LiveTest) {
  const list = await readFile();
  const next = [test, ...list.filter((t) => t.id !== test.id)].slice(0, 80);
  await writeFile(next);

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(test.teacherId);
    const sm = metaOf(user);
    const liveTests = [test, ...(sm.liveTests || [])]
      .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
      .slice(0, 20);
    await client.users.updateUserMetadata(test.teacherId, {
      publicMetadata: {
        ...user.publicMetadata,
        smartlearn: { ...sm, liveTests },
      },
    });
  } catch (e) {
    console.error("saveTest meta", e);
  }
  return test;
}

export async function findTestByCode(code: string): Promise<LiveTest | null> {
  const c = code.trim().toUpperCase();
  for (const t of await readFile()) {
    if (t.code === c) return t;
  }
  try {
    const client = await clerkClient();
    let offset = 0;
    for (let page = 0; page < 10; page++) {
      const res = await client.users.getUserList({ limit: 100, offset });
      for (const u of res.data) {
        for (const t of metaOf(u).liveTests || []) {
          if (t.code === c) return t;
        }
      }
      offset += 100;
      if (offset >= (res.totalCount || 0) || res.data.length === 0) break;
    }
  } catch (e) {
    console.error("findTestByCode", e);
  }
  return null;
}

export async function listTeacherTests(teacherId: string) {
  const map = new Map<string, LiveTest>();
  for (const t of await readFile()) {
    if (t.teacherId === teacherId) map.set(t.id, t);
  }
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(teacherId);
    for (const t of metaOf(user).liveTests || []) map.set(t.id, t);
  } catch {
    // ignore
  }
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export async function submitTest(
  code: string,
  studentId: string,
  name: string,
  answers: number[]
) {
  const test = await findTestByCode(code);
  if (!test) throw new Error("Test not found");
  if (!test.active) throw new Error("Test is closed by teacher");
  // Grace: setup/proctor can eat clock; still accept while test is active
  // (hard stop only if closed or 2h past end)
  if (Date.now() > test.endsAt + 2 * 60 * 60 * 1000) {
    throw new Error("Test window expired");
  }

  let score = 0;
  test.questions.forEach((q, i) => {
    if (answers[i] === q.correctIndex) score += 1;
  });

  const prev = test.submissions[studentId];
  test.submissions[studentId] = {
    name,
    answers,
    score,
    total: test.questions.length,
    at: Date.now(),
    moments: prev?.moments || [],
  };
  await saveTest(test);
  return test.submissions[studentId];
}

export async function addTestMoment(
  code: string,
  studentId: string,
  name: string,
  moment: {
    at: number;
    imageDataUrl?: string;
    audioDataUrl?: string;
    note?: string;
  }
) {
  const test = await findTestByCode(code);
  if (!test) throw new Error("Test not found");
  if (!test.active) throw new Error("Test closed");

  const cur = test.submissions[studentId] || {
    name,
    answers: [],
    score: 0,
    total: test.questions.length,
    at: Date.now(),
    moments: [],
  };
  const moments = [
    {
      at: moment.at || Date.now(),
      imageDataUrl: moment.imageDataUrl
        ? String(moment.imageDataUrl).slice(0, 140_000)
        : undefined,
      audioDataUrl: moment.audioDataUrl
        ? String(moment.audioDataUrl).slice(0, 140_000)
        : undefined,
      note: moment.note ? String(moment.note).slice(0, 200) : undefined,
    },
    ...(cur.moments || []),
  ].slice(0, 40);

  test.submissions[studentId] = { ...cur, name, moments };
  await saveTest(test);
  return moments;
}
