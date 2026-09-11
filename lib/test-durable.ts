/**
 * Durable cross-instance test store.
 * Vercel /tmp is per-instance — student submit on instance A was invisible
 * to teacher on instance B. This mirrors full tests to a public JSON URL.
 */
import { promises as fs } from "fs";
import path from "path";
import type { LiveTest } from "@/lib/test-server";
import { uploadBufferRemote } from "@/lib/remote-upload";

type Index = {
  /** CODE → remote JSON URL of full test */
  byCode: Record<string, string>;
  /** teacherId → list of codes */
  byTeacher: Record<string, string[]>;
  updatedAt: number;
  remoteUrl?: string;
};

const memIndex: { idx: Index | null } = { idx: null };
const memTests = new Map<string, LiveTest>(); // code → test

function dataDir() {
  return process.env.VERCEL
    ? "/tmp/smartlearn-tests-durable"
    : path.join(process.cwd(), ".data", "tests-durable");
}

function indexLocal() {
  return path.join(dataDir(), "index.json");
}
function indexPointer() {
  return indexLocal() + ".remote";
}
function testLocal(code: string) {
  return path.join(dataDir(), `test-${code.toUpperCase()}.json`);
}
function testPointer(code: string) {
  return testLocal(code) + ".remote";
}

function emptyIndex(): Index {
  return { byCode: {}, byTeacher: {}, updatedAt: Date.now() };
}

async function readJsonFile<T>(fp: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(fp, "utf8")) as T;
  } catch {
    return null;
  }
}

async function readRemoteJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(
      url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(),
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function loadIndex(): Promise<Index> {
  let remote: Index | null = null;
  try {
    const ptr = (await fs.readFile(indexPointer(), "utf8")).trim();
    if (ptr.startsWith("http")) remote = await readRemoteJson<Index>(ptr);
  } catch {
    // ignore
  }
  if (!remote && memIndex.idx?.remoteUrl) {
    remote = await readRemoteJson<Index>(memIndex.idx.remoteUrl);
  }
  const local = (await readJsonFile<Index>(indexLocal())) || memIndex.idx;
  const idx: Index = {
    byCode: { ...(remote?.byCode || {}), ...(local?.byCode || {}) },
    byTeacher: { ...(remote?.byTeacher || {}), ...(local?.byTeacher || {}) },
    updatedAt: Date.now(),
    remoteUrl: remote?.remoteUrl || local?.remoteUrl,
  };
  // merge teacher code lists
  const teachers = new Set([
    ...Object.keys(remote?.byTeacher || {}),
    ...Object.keys(local?.byTeacher || {}),
  ]);
  for (const tid of teachers) {
    idx.byTeacher[tid] = Array.from(
      new Set([
        ...(remote?.byTeacher?.[tid] || []),
        ...(local?.byTeacher?.[tid] || []),
      ])
    ).slice(0, 80);
  }
  memIndex.idx = idx;
  return idx;
}

async function persistIndex(idx: Index) {
  idx.updatedAt = Date.now();
  memIndex.idx = idx;
  try {
    await fs.mkdir(dataDir(), { recursive: true });
    await fs.writeFile(indexLocal(), JSON.stringify(idx), "utf8");
  } catch {
    // ignore
  }
  try {
    const remote = await uploadBufferRemote(
      Buffer.from(JSON.stringify(idx), "utf8"),
      `tests-index-${Date.now()}.json`,
      "application/json"
    );
    if (remote) {
      idx.remoteUrl = remote;
      memIndex.idx = idx;
      await fs.writeFile(indexPointer(), remote, "utf8");
      await fs.writeFile(indexLocal(), JSON.stringify(idx), "utf8");
    }
  } catch (e) {
    console.error("test durable index", e);
  }
}

function slimForRemote(t: LiveTest): LiveTest {
  // Keep scores/names/keys; trim huge inline base64 for remote JSON size
  const submissions: LiveTest["submissions"] = {};
  for (const [sid, s] of Object.entries(t.submissions || {})) {
    submissions[sid] = {
      ...s,
      moments: (s.moments || []).slice(0, 40).map((m) => ({
        at: m.at,
        note: m.note,
        videoKey: m.videoKey,
        imageKey: m.imageKey,
        audioKey: m.audioKey,
        // keep modest preview for teacher UI across instances
        imageDataUrl: m.imageDataUrl
          ? String(m.imageDataUrl).slice(0, 60_000)
          : undefined,
      })),
    };
  }
  return { ...t, submissions };
}

export async function durableSaveTest(test: LiveTest) {
  const c = test.code.toUpperCase();
  const payload = slimForRemote({ ...test, code: c });
  memTests.set(c, payload);

  try {
    await fs.mkdir(dataDir(), { recursive: true });
    await fs.writeFile(testLocal(c), JSON.stringify(payload), "utf8");
  } catch (e) {
    console.error("durable test local", e);
  }

  let testUrl: string | null = null;
  try {
    // Skip remote if payload huge (many snaps) — local + index still work
    const raw = Buffer.from(JSON.stringify(payload), "utf8");
    if (raw.length < 3_500_000) {
      testUrl = await uploadBufferRemote(
        raw,
        `test-${c}-${Date.now()}.json`,
        "application/json"
      );
    }
    if (testUrl) {
      try {
        await fs.writeFile(testPointer(c), testUrl, "utf8");
      } catch {
        // ignore
      }
    }
  } catch (e) {
    console.error("durable test remote", e);
  }

  const idx = await loadIndex();
  if (testUrl) idx.byCode[c] = testUrl;
  const tid = test.teacherId || "";
  if (tid) {
    const codes = new Set([...(idx.byTeacher[tid] || []), c]);
    idx.byTeacher[tid] = Array.from(codes).slice(0, 80);
  }
  await persistIndex(idx);
  return payload;
}

export async function durableLoadByCode(code: string): Promise<LiveTest | null> {
  const c = code.trim().toUpperCase();
  if (memTests.has(c)) return memTests.get(c)!;

  const local = await readJsonFile<LiveTest>(testLocal(c));
  if (local?.code) {
    memTests.set(c, local);
    return local;
  }

  let url: string | null = null;
  try {
    const ptr = (await fs.readFile(testPointer(c), "utf8")).trim();
    if (ptr.startsWith("http")) url = ptr;
  } catch {
    // ignore
  }
  if (!url) {
    const idx = await loadIndex();
    url = idx.byCode[c] || null;
  }
  if (url?.startsWith("http")) {
    const remote = await readRemoteJson<LiveTest>(url);
    if (remote?.code) {
      memTests.set(c, remote);
      try {
        await fs.mkdir(dataDir(), { recursive: true });
        await fs.writeFile(testLocal(c), JSON.stringify(remote), "utf8");
      } catch {
        // ignore
      }
      return remote;
    }
  }
  return null;
}

export async function durableListForTeacher(
  teacherId: string
): Promise<LiveTest[]> {
  const idx = await loadIndex();
  const codes = idx.byTeacher[teacherId] || [];
  const out: LiveTest[] = [];
  for (const code of codes) {
    const t = await durableLoadByCode(code);
    if (t && (t.teacherId === teacherId || !t.teacherId)) {
      out.push({ ...t, teacherId: t.teacherId || teacherId });
    }
  }
  return out;
}
