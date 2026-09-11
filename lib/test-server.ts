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
  /** path key for saved photo snap */
  imageKey?: string;
  /** path key for saved audio clip */
  audioKey?: string;
};

export type LiveTest = {
  id: string;
  code: string;
  title: string;
  teacherId: string;
  teacherName: string;
  /** Subject label e.g. Physics */
  subject?: string;
  classCode?: string;
  durationMin: number;
  /** Students may join only until this time (default startsAt + 15 min) */
  joinUntil?: number;
  questions: TestMcq[];
  createdAt: number;
  startsAt: number;
  /** Soft/info — student timer uses durationMin from their start */
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
      moments: (s.moments || []).slice(0, 12).map((m) => ({
        at: m.at,
        note: m.note,
        videoKey: m.videoKey,
        imageKey: m.imageKey,
        audioKey: m.audioKey,
        // small preview so teacher still sees snaps after cold start
        imageDataUrl: m.imageDataUrl
          ? String(m.imageDataUrl).slice(0, 80_000)
          : undefined,
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
  // Merge with any existing file copy so concurrent moment/submit don't wipe fields
  const list = await readFile();
  const prev = list.find((t) => t.id === test.id || t.code === test.code);
  const merged: LiveTest = prev
    ? {
        ...prev,
        ...test,
        // Explicit close wins; otherwise stay live if either copy is active
        active:
          test.active === false
            ? false
            : Boolean(test.active || prev.active),
        questions:
          (test.questions?.length || 0) >= (prev.questions?.length || 0)
            ? test.questions
            : prev.questions,
        submissions: mergeSubmissions(prev.submissions, test.submissions),
        joinUntil: Math.max(test.joinUntil || 0, prev.joinUntil || 0),
      }
    : test;

  const next = [merged, ...list.filter((t) => t.id !== merged.id)].slice(
    0,
    100
  );
  await writeFile(next);

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(merged.teacherId);
    const sm = metaOf(user);
    const liveTests = [lightTest(merged), ...(sm.liveTests || [])]
      .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
      .map((t) =>
        t.id === merged.id
          ? {
              ...t,
              active: merged.active,
              submissions: mergeSubmissions(
                t.submissions,
                lightTest(merged).submissions
              ),
            }
          : t
      )
      .slice(0, 40);
    await client.users.updateUserMetadata(merged.teacherId, {
      publicMetadata: {
        ...user.publicMetadata,
        smartlearn: { ...sm, liveTests },
      },
    });
  } catch (e) {
    console.error("saveTest meta", e);
  }
  return merged;
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
                // Prefer whichever copy is richer / still active
                questions:
                  (existing.questions?.length || 0) >=
                  (t.questions?.length || 0)
                    ? existing.questions
                    : t.questions,
                submissions: mergeSubmissions(
                  t.submissions,
                  existing.submissions
                ),
                // Stay active if EITHER source says active (don't drop live tests)
                active: Boolean(existing.active || t.active),
                teacherId: existing.teacherId || t.teacherId,
                joinUntil: Math.max(
                  existing.joinUntil || 0,
                  t.joinUntil || 0,
                  existing.startsAt || t.startsAt || 0
                ),
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
        map.set(
          t.id,
          ex
            ? {
                ...t,
                ...ex,
                questions:
                  (ex.questions?.length || 0) >= (t.questions?.length || 0)
                    ? ex.questions
                    : t.questions,
                submissions: mergeSubmissions(t.submissions, ex.submissions),
                teacherId: ex.teacherId || t.teacherId || teacherId,
                active: Boolean(ex.active || t.active),
              }
            : { ...t, teacherId: t.teacherId || teacherId }
        );
      }
    }
  } catch {
    // ignore
  }
  // Active first, then newest
  return Array.from(map.values()).sort(
    (a, b) => Number(b.active) - Number(a.active) || b.createdAt - a.createdAt
  );
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

  const prev = test.submissions[studentId];
  // Block re-attempt if already fully submitted
  if (
    prev &&
    Array.isArray(prev.answers) &&
    prev.answers.length === test.questions.length &&
    prev.at &&
    prev.total === test.questions.length
  ) {
    throw new Error(
      `You have already attempted this test (score ${prev.score}/${prev.total}).`
    );
  }

  let score = 0;
  test.questions.forEach((q, i) => {
    if (answers[i] === q.correctIndex) score += 1;
  });

  const cleanName =
    (name && String(name).trim()) || prev?.name || "Student";
  test.submissions[studentId] = {
    name: cleanName.slice(0, 80),
    answers,
    score,
    total: test.questions.length,
    at: Date.now(),
    moments: prev?.moments || [],
    videoKeys: prev?.videoKeys || [],
  };
  await saveTest(test);
  // Re-read merge in case concurrent moments wrote
  const fresh = await findTestByCode(code);
  const saved = fresh?.submissions?.[studentId] || test.submissions[studentId];
  return saved;
}

async function saveMediaFile(
  code: string,
  studentId: string,
  dataUrl: string,
  kind: "jpg" | "webm" | "webm-audio"
): Promise<string | undefined> {
  try {
    const dir = videoDir();
    await fs.mkdir(dir, { recursive: true });
    const ext =
      kind === "jpg" ? "jpg" : kind === "webm-audio" ? "webm" : "webm";
    const key = `${code}_${studentId}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 5)}.${ext}`;
    const raw = dataUrl.replace(/^data:[^;]+;base64,/, "");
    const buf = Buffer.from(raw, "base64");
    if (buf.length < 80) return undefined;
    if (buf.length > 1_800_000) return undefined;
    try {
      await fs.writeFile(path.join(dir, key), buf);
    } catch {
      // local may fail on serverless — still try remote
    }
    // Durable public URL so teacher can view after cold start
    try {
      const { uploadBufferRemote } = await import("@/lib/remote-upload");
      const mime =
        kind === "jpg"
          ? "image/jpeg"
          : kind === "webm-audio"
            ? "audio/webm"
            : "video/webm";
      const remote = await uploadBufferRemote(buf, key, mime);
      if (remote) return remote;
    } catch (e) {
      console.error("saveMediaFile remote", e);
    }
    return key;
  } catch (e) {
    console.error("saveMediaFile", e);
    return undefined;
  }
}

function mergeSubmission(
  a?: LiveTest["submissions"][string],
  b?: LiveTest["submissions"][string]
): LiveTest["submissions"][string] | undefined {
  if (!a) return b;
  if (!b) return a;
  const aDone =
    Array.isArray(a.answers) &&
    a.answers.length > 0 &&
    typeof a.score === "number" &&
    a.total > 0;
  const bDone =
    Array.isArray(b.answers) &&
    b.answers.length > 0 &&
    typeof b.score === "number" &&
    b.total > 0;
  const base = aDone && !bDone ? a : bDone && !aDone ? b : a.at >= b.at ? a : b;
  const other = base === a ? b : a;
  const name =
    base.name && base.name !== "Student"
      ? base.name
      : other.name || base.name || "Student";
  const moments = [
    ...(base.moments || []),
    ...(other.moments || []),
  ]
    .sort((x, y) => (y.at || 0) - (x.at || 0))
    .slice(0, 900);
  const seen = new Set<string>();
  const uniqMoments = moments.filter((m) => {
    const k = `${m.at}|${m.imageKey || m.imageDataUrl?.slice(0, 40) || m.note || ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const videoKeys = Array.from(
    new Set([...(base.videoKeys || []), ...(other.videoKeys || [])])
  ).slice(0, 80);
  return {
    name,
    answers:
      aDone && base === a
        ? a.answers
        : bDone && base === b
          ? b.answers
          : a.answers?.length
            ? a.answers
            : b.answers || [],
    score: aDone || bDone ? base.score : Math.max(a.score || 0, b.score || 0),
    total: base.total || other.total || 0,
    at: Math.max(a.at || 0, b.at || 0),
    moments: uniqMoments,
    videoKeys,
  };
}

function mergeSubmissions(
  ...maps: (LiveTest["submissions"] | undefined)[]
): LiveTest["submissions"] {
  const out: LiveTest["submissions"] = {};
  for (const m of maps) {
    for (const [sid, sub] of Object.entries(m || {})) {
      out[sid] = mergeSubmission(out[sid], sub) || sub;
    }
  }
  return out;
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

  let imageKey = moment.imageKey;
  let audioKey = moment.audioKey;
  if (moment.imageDataUrl && !imageKey) {
    imageKey = await saveMediaFile(
      test.code,
      studentId,
      moment.imageDataUrl,
      "jpg"
    );
  }
  if (moment.audioDataUrl && !audioKey) {
    audioKey = await saveMediaFile(
      test.code,
      studentId,
      moment.audioDataUrl,
      "webm-audio"
    );
  }

  const entry: ProctorMoment = {
    at: moment.at || Date.now(),
    imageKey,
    audioKey,
    // Keep a small inline preview so teacher UI always has something to show
    // even if /tmp keys are lost on cold start (remote imageKey preferred)
    imageDataUrl: moment.imageDataUrl
      ? String(moment.imageDataUrl).slice(0, 120_000)
      : undefined,
    audioDataUrl:
      !audioKey && moment.audioDataUrl
        ? String(moment.audioDataUrl).slice(0, 80_000)
        : undefined,
    note: moment.note ? String(moment.note).slice(0, 200) : undefined,
    videoKey: moment.videoKey,
  };

  const moments = [entry, ...(cur.moments || [])].slice(0, 900);
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

  const raw = base64.replace(/^data:[^;]+;base64,/, "");
  const buf = Buffer.from(raw, "base64");
  if (buf.length < 200) throw new Error("Video chunk too small");
  if (buf.length > 2_500_000) throw new Error("Video chunk too large");

  const localKey = `${test.code}_${studentId}_${Date.now()}.${ext}`;
  try {
    const dir = videoDir();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, localKey), buf);
  } catch {
    // ignore local
  }

  // Prefer durable remote URL so teacher can play after cold start
  let storeKey = localKey;
  try {
    const { uploadBufferRemote } = await import("@/lib/remote-upload");
    const remote = await uploadBufferRemote(buf, localKey, "video/webm");
    if (remote) storeKey = remote;
  } catch {
    // keep local key
  }

  await addTestMoment(code, studentId, "Student", {
    at: Date.now(),
    note: "screen-video-chunk",
    videoKey: storeKey,
  });
  return storeKey;
}

export async function readVideoChunk(key: string): Promise<Buffer | null> {
  // Remote URL — caller should redirect; return null to signal remote
  if (key.startsWith("http://") || key.startsWith("https://")) {
    try {
      const res = await fetch(key);
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    } catch {
      return null;
    }
  }
  try {
    const safe = path.basename(key);
    return await fs.readFile(path.join(videoDir(), safe));
  } catch {
    return null;
  }
}

export async function readMediaChunk(key: string): Promise<{
  buf: Buffer;
  contentType: string;
} | null> {
  if (key.startsWith("http://") || key.startsWith("https://")) {
    try {
      const res = await fetch(key, { cache: "no-store" });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get("content-type") || "";
      let contentType = "application/octet-stream";
      if (ct.includes("jpeg") || ct.includes("jpg") || key.includes(".jpg"))
        contentType = "image/jpeg";
      else if (ct.includes("png") || key.includes(".png"))
        contentType = "image/png";
      else if (ct.includes("webm") || key.includes(".webm"))
        contentType = "audio/webm";
      else if (ct) contentType = ct.split(";")[0];
      return { buf, contentType };
    } catch {
      return null;
    }
  }
  try {
    const safe = path.basename(key);
    const buf = await fs.readFile(path.join(videoDir(), safe));
    const lower = safe.toLowerCase();
    let contentType = "application/octet-stream";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
      contentType = "image/jpeg";
    else if (lower.endsWith(".png")) contentType = "image/png";
    else if (lower.endsWith(".webm")) contentType = "audio/webm";
    else if (lower.endsWith(".mp3")) contentType = "audio/mpeg";
    return { buf, contentType };
  } catch {
    return null;
  }
}
