/**
 * Class code → teacherId index.
 * Avoids scanning all Clerk users (rate limit / Too Many Requests).
 */
import { promises as fs } from "fs";
import path from "path";
import { uploadBufferRemote } from "@/lib/remote-upload";

type Index = {
  codes: Record<string, string>; // CODE -> teacherId
  updatedAt: number;
  remoteUrl?: string;
};

const mem: { idx: Index | null } = { idx: null };

function localPath() {
  const dir = process.env.VERCEL
    ? "/tmp"
    : path.join(process.cwd(), ".data");
  return path.join(dir, "smartlearn-class-codes.json");
}

function pointerPath() {
  return localPath() + ".remote";
}

async function readRemote(url: string): Promise<Index | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as Index;
    if (j?.codes) return j;
  } catch {
    // ignore
  }
  return null;
}

async function loadIndex(): Promise<Index> {
  if (mem.idx) return mem.idx;

  try {
    const raw = await fs.readFile(localPath(), "utf8");
    const j = JSON.parse(raw) as Index;
    if (j?.codes) {
      mem.idx = j;
      return j;
    }
  } catch {
    // ignore
  }

  try {
    const url = (await fs.readFile(pointerPath(), "utf8")).trim();
    if (url.startsWith("http")) {
      const remote = await readRemote(url);
      if (remote) {
        mem.idx = remote;
        return remote;
      }
    }
  } catch {
    // ignore
  }

  const empty: Index = { codes: {}, updatedAt: Date.now() };
  mem.idx = empty;
  return empty;
}

async function persist(idx: Index) {
  idx.updatedAt = Date.now();
  mem.idx = idx;
  const fp = localPath();
  try {
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, JSON.stringify(idx), "utf8");
  } catch {
    // ignore
  }
  try {
    const remote = await uploadBufferRemote(
      Buffer.from(JSON.stringify(idx), "utf8"),
      `class-codes-${Date.now()}.json`,
      "application/json"
    );
    if (remote) {
      idx.remoteUrl = remote;
      mem.idx = idx;
      await fs.writeFile(pointerPath(), remote, "utf8").catch(() => null);
      await fs.writeFile(fp, JSON.stringify(idx), "utf8").catch(() => null);
    }
  } catch {
    // ignore
  }
}

export async function registerClassCode(code: string, teacherId: string) {
  const c = code.toUpperCase();
  const idx = await loadIndex();
  idx.codes[c] = teacherId;
  await persist(idx);
}

export async function unregisterClassCode(code: string) {
  const c = code.toUpperCase();
  const idx = await loadIndex();
  delete idx.codes[c];
  await persist(idx);
}

export async function lookupTeacherByCode(
  code: string
): Promise<string | null> {
  const c = code.toUpperCase();
  let idx = await loadIndex();
  if (!idx.codes[c] && idx.remoteUrl) {
    const remote = await readRemote(idx.remoteUrl);
    if (remote?.codes) {
      idx = remote;
      mem.idx = remote;
    }
  }
  return idx.codes[c] || null;
}

export async function isCodeTaken(code: string): Promise<boolean> {
  const tid = await lookupTeacherByCode(code);
  return Boolean(tid);
}
