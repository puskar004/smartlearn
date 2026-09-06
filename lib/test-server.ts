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

export type ProctorMoment = {
  at: number;
  imageDataUrl?: string;
  audioDataUrl?: string;
  note?: string;
  /** path key for saved screen video chunk */
  videoKey?: string;
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
  /** Informational only — test stays joinable until teacher closes */
  endsAt: number;
  active: boolean;
  submissions: Record<
    string,
    {
      name: string;
      answers: number[];
      score: number;
      total: number;
      at: number;
      moments?: ProctorMoment[];
      /** screen recording chunk keys */
      videoKeys?: string[];
    }
  >;
};

type Meta = {
  liveTests?: LiveTest[];
  [k: string]: unknown;
};

function dataDir() {
  return process.env.VERCEL ? "/tmp" : path.join(process.cwd(), ".data");
}

function filePath() {
  return path.join(dataDir(), "smartlearn-tests.json");
}

function videoDir() {
  return path.join(dataDir(), "test-videos");
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

function metaOf(user: {
  publicMetadata?: Record<string, unknown> | null;
}): Meta {
  const m = (user.publicMetadata || {}) as Record<string, unknown>;
  return (m.smartlearn as Meta) || {};
}

/** Strip heavy moments before Clerk metadata (size limits) */
function lightTest(t: LiveTest): LiveTest {
  const submissions: LiveTest["submissions"] = {};
  for (const [sid, s] of Object.entries(t.submissions || {})) {
    submissions[sid] = {
      name: s.name,
      answers: s.answers,
      score: s.score,
      total: s.total,
      at: s.at,
      videoKeys: s.videoKeys,
      moments: (s.moments || []).slice(0, 5).map((m) => ({
        at: m.at,
        note: m.note,
        videoKey: m.videoKey,
        // keep tiny thumbs only in file store; drop huge base64 from clerk
      })),
    };
  }
  return { ...t, submissions };
}

export function genTestCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "T";
  for (let i = 0; i < 5; i++)
    s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function saveTest(test: LiveTest) {
  const list = await readFile();
  const next = [test, ...list.filter((t) => t.id !== test.id)].slice(0, 100);
  await writeFile(next);

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(test.teacherId);
    const sm = metaOf(user);
    const liveTests = [lightTest(test), ...(sm.liveTests || [])]
      .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
      .slice(0, 30);
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
  const map = new Map<string, LiveTest>();

  for (const t of await readFile()) {
    if (t.code === c) map.set(t.id, t);
  }

  try {
    const client = await clerkClient();
    let offset = 0;
    for (let page = 0; page < 12; page++) {
      const res = await client.users.getUserList({ limit: 100, offset });
      for (const u of res.data) {
        for (const t of metaOf(u).liveTests || []) {
          if (t.code === c) {
            const existing = map.get(t.id);
            // prefer file copy if it has richer submissions/moments
            if (!existing) map.set(t.id, t);
            else {
              map.set(t.id, {
                ...t,
                ...existing,
                submissions: {
                  ...(t.submissions || {}),
                  ...(existing.submissions || {}),
                },
                active: existing.active && t.active ? existing.active : t.active && existing.active !== false ? existing.active : t.active,
              });
            }
          }
        }
      }
      offset += 100;
      if (offset >= (res.totalCount || 0) || res.data.length === 0) break;
    }
  } catch (e) {
    console.error("findTestByCode", e);
  }

  const list = Array.from(map.values());
  if (!list.length) return null;
  // Prefer active tests
  list.sort((a, b) => Number(b.active) - Number(a.active) || b.createdAt - a.createdAt);
  return list[0];
}

export async function listTeacherTests(teacherId: string) {
  const map = new Map<string, LiveTest>();
  for (const t of await readFile()) {
    if (t.teacherId === teacherId) map.set(t.id, t);
  }
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(teacherId);
    for (const t of metaOf(user).liveTests || []) {
      if (t.teacherId === teacherId || !t.teacherId) {
        const ex = map.get(t.id);
        map.set(t.id, ex ? { ...t, ...ex, submissions: { ...t.submissions, ...ex.submissions } } : t);
      }
    }
  } catch {
    // ignore
  }
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteTest(teacherId: string, code: string) {
  const t = await findTestByCode(code);
  if (!t || t.teacherId !== teacherId) throw new Error("Not found");
  t.active = false;
  await saveTest(t);

  // remove from file list optional hard delete
  const list = (await readFile()).filter((x) => x.id !== t.id);
  await writeFile(list);

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(teacherId);
    const sm = metaOf(user);
    const liveTests = (sm.liveTests || []).filter((x) => x.id !== t.id);
    await client.users.updateUserMetadata(teacherId, {
      publicMetadata: {
        ...user.publicMetadata,
        smartlearn: { ...sm, liveTests },
      },
    });
  } catch {
    // ignore
  }
  return true;
}

export async function submitTest(
  code: string,
  studentId: string,
  name: string,
  answers: number[]
) {
  const test = await findTestByCode(code);
  if (!test) throw new Error("Invalid code — test not found or deleted");
  if (!test.active) throw new Error("Test is closed by teacher");

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
    videoKeys: prev?.videoKeys || [],
  };
  await saveTest(test);
  return test.submissions[studentId];
}

export async function addTestMoment(
  code: string,
  studentId: string,
  name: string,
  moment: ProctorMoment
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
    videoKeys: [],
  };

  const entry: ProctorMoment = {
    at: moment.at || Date.now(),
    imageDataUrl: moment.imageDataUrl
      ? String(moment.imageDataUrl).slice(0, 160_000)
      : undefined,
    audioDataUrl: moment.audioDataUrl
      ? String(moment.audioDataUrl).slice(0, 160_000)
      : undefined,
    note: moment.note ? String(moment.note).slice(0, 200) : undefined,
    videoKey: moment.videoKey,
  };

  const moments = [entry, ...(cur.moments || [])].slice(0, 120);
  const videoKeys = moment.videoKey
    ? Array.from(new Set([moment.videoKey, ...(cur.videoKeys || [])])).slice(
        0,
        80
      )
    : cur.videoKeys || [];

  test.submissions[studentId] = { ...cur, name, moments, videoKeys };
  await saveTest(test);
  return moments;
}

export async function saveVideoChunk(
  code: string,
  studentId: string,
  base64: string,
  ext = "webm"
) {
  const test = await findTestByCode(code);
  if (!test) throw new Error("Test not found");
  if (!test.active) throw new Error("Test closed");

  const dir = videoDir();
  await fs.mkdir(dir, { recursive: true });
  const key = `${test.code}_${studentId}_${Date.now()}.${ext}`;
  const raw = base64.replace(/^data:[^;]+;base64,/, "");
  const buf = Buffer.from(raw, "base64");
  // cap ~1.5MB per chunk
  if (buf.length > 1_600_000) throw new Error("Video chunk too large");
  await fs.writeFile(path.join(dir, key), buf);

  await addTestMoment(code, studentId, "Student", {
    at: Date.now(),
    note: "screen-video-chunk",
    videoKey: key,
  });
  return key;
}

export async function readVideoChunk(key: string): Promise<Buffer | null> {
  try {
    const safe = path.basename(key);
    return await fs.readFile(path.join(videoDir(), safe));
  } catch {
    return null;
  }
}
