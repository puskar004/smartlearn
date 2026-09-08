/**
 * Class code → teacherId + materials (48h).
 * Always mirrored to a public JSON URL so every serverless instance can read it.
 */
import { promises as fs } from "fs";
import path from "path";
import type { LiveSession, TeacherMaterial } from "@/lib/classroom-types";
import { uploadBufferRemote } from "@/lib/remote-upload";

const MATERIAL_TTL_MS = 48 * 60 * 60 * 1000;

/** Lightweight live payload shared across servers (students poll this) */
export type SharedLive = {
  id: string;
  title: string;
  subject: string;
  meetUrl?: string;
  joinCode: string;
  active: boolean;
  startedAt: number;
  endsAt: number;
  scheduledAt?: number;
  teacherName?: string;
  className?: string;
};

type Index = {
  codes: Record<string, string>; // CODE -> teacherId
  /** Inline materials per code (https URLs preferred) */
  materials?: Record<string, TeacherMaterial[]>;
  /** Optional dedicated pack URL per code */
  matsUrls?: Record<string, string>;
  /** CODE → current live session (cross-instance) */
  live?: Record<string, SharedLive | null>;
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

function stillActive(m: TeacherMaterial) {
  if (!m?.url) return false;
  const exp = m.expiresAt || (m.createdAt || 0) + MATERIAL_TTL_MS;
  if (m.createdAt && exp < Date.now()) return false;
  return true;
}

function pruneMats(list: TeacherMaterial[] = []) {
  return list
    .filter(stillActive)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 30);
}

async function readRemote(url: string): Promise<Index | null> {
  try {
    const res = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), {
      cache: "no-store",
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Index;
    if (j?.codes) return j;
  } catch {
    // ignore
  }
  return null;
}

async function loadIndex(forceRemote = false): Promise<Index> {
  if (!forceRemote && mem.idx?.codes) return mem.idx;

  // Prefer remote mirror first (cross-instance truth)
  try {
    const url = (await fs.readFile(pointerPath(), "utf8")).trim();
    if (url.startsWith("http")) {
      const remote = await readRemote(url);
      if (remote) {
        mem.idx = remote;
        // keep pointer
        return remote;
      }
    }
  } catch {
    // ignore
  }

  // Known remote from mem
  if (mem.idx?.remoteUrl) {
    const remote = await readRemote(mem.idx.remoteUrl);
    if (remote) {
      mem.idx = remote;
      return remote;
    }
  }

  try {
    const raw = await fs.readFile(localPath(), "utf8");
    const j = JSON.parse(raw) as Index;
    if (j?.codes) {
      if (j.remoteUrl) {
        const remote = await readRemote(j.remoteUrl);
        if (remote) {
          mem.idx = remote;
          return remote;
        }
      }
      mem.idx = j;
      return j;
    }
  } catch {
    // ignore
  }

  const empty: Index = {
    codes: {},
    materials: {},
    matsUrls: {},
    updatedAt: Date.now(),
  };
  mem.idx = empty;
  return empty;
}

async function persist(idx: Index, forceRemote = true) {
  // prune materials
  if (idx.materials) {
    for (const c of Object.keys(idx.materials)) {
      idx.materials[c] = pruneMats(idx.materials[c]);
    }
  }
  idx.updatedAt = Date.now();
  mem.idx = idx;
  const fp = localPath();
  try {
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, JSON.stringify(idx), "utf8");
  } catch {
    // ignore
  }

  if (!forceRemote && idx.remoteUrl) return;

  try {
    const remote = await uploadBufferRemote(
      Buffer.from(JSON.stringify(idx), "utf8"),
      `class-codes-${Date.now()}.json`,
      "application/json"
    );
    if (remote) {
      idx.remoteUrl = remote;
      mem.idx = idx;
      try {
        await fs.writeFile(fp, JSON.stringify(idx), "utf8");
        await fs.writeFile(pointerPath(), remote, "utf8");
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

export async function registerClassCode(code: string, teacherId: string) {
  const c = code.toUpperCase();
  const idx = await loadIndex(true);
  idx.codes[c] = teacherId;
  await persist(idx, true);
}

export async function unregisterClassCode(code: string) {
  const c = code.toUpperCase();
  const idx = await loadIndex(true);
  delete idx.codes[c];
  if (idx.materials) delete idx.materials[c];
  if (idx.matsUrls) delete idx.matsUrls[c];
  if (idx.live) delete idx.live[c];
  await persist(idx, true);
}

/** Teacher starts/ends live → students see it on any server */
export async function publishClassLive(
  code: string,
  teacherId: string,
  live: SharedLive | null
) {
  const c = code.toUpperCase();
  const idx = await loadIndex(true);
  idx.codes[c] = teacherId || idx.codes[c] || "";
  if (!idx.live) idx.live = {};
  if (!live || (!live.active && !(live.scheduledAt && live.scheduledAt > Date.now()))) {
    delete idx.live[c];
  } else {
    idx.live[c] = {
      id: live.id,
      title: live.title,
      subject: live.subject,
      meetUrl: live.meetUrl,
      joinCode: live.joinCode,
      active: Boolean(live.active),
      startedAt: live.startedAt,
      endsAt: live.endsAt,
      scheduledAt: live.scheduledAt,
      teacherName: live.teacherName,
      className: live.className,
    };
  }
  await persist(idx, true);
}

export async function getClassLive(code: string): Promise<SharedLive | null> {
  const c = code.toUpperCase();
  const idx = await loadIndex(true);
  const live = idx.live?.[c] || null;
  if (!live) return null;
  const now = Date.now();
  // Expired active session
  if (live.active && live.endsAt && live.endsAt < now - 30 * 60_000) {
    return null;
  }
  if (
    !live.active &&
    live.scheduledAt &&
    live.scheduledAt < now - 60 * 60_000
  ) {
    return null;
  }
  return live;
}

export async function getClassLiveMany(
  codes: string[]
): Promise<Record<string, SharedLive>> {
  const out: Record<string, SharedLive> = {};
  for (const raw of codes) {
    const live = await getClassLive(raw);
    if (live) out[raw.toUpperCase()] = live;
  }
  return out;
}

export async function lookupTeacherByCode(
  code: string
): Promise<string | null> {
  const c = code.toUpperCase();
  const idx = await loadIndex(true);
  return idx.codes[c] || null;
}

export async function isCodeTaken(code: string): Promise<boolean> {
  const tid = await lookupTeacherByCode(code);
  return Boolean(tid);
}

/** Publish materials for a class — students read this across all instances */
export async function publishClassMaterials(
  code: string,
  teacherId: string,
  materials: TeacherMaterial[],
  teacherName?: string
) {
  const c = code.toUpperCase();
  const idx = await loadIndex(true);
  idx.codes[c] = teacherId || idx.codes[c] || "";
  if (!idx.materials) idx.materials = {};

  // Merge + prune 48h; keep https and small data URLs
  const incoming = pruneMats(
    materials.map((m) => {
      let url = m.url || "";
      // Shared JSON can hold small data PDFs; huge ones need https host
      if (url.startsWith("data:") && url.length > 200_000) url = "";
      return {
        ...m,
        url,
        expiresAt: m.expiresAt || (m.createdAt || Date.now()) + MATERIAL_TTL_MS,
        teacherName: m.teacherName || teacherName || "Teacher",
      };
    })
  ).filter((m) => m.url);

  const prev = idx.materials[c] || [];
  const map = new Map<string, TeacherMaterial>();
  for (const m of [...incoming, ...prev]) {
    if (!stillActive(m) || !m.url) continue;
    map.set(m.id || m.url, m);
  }
  idx.materials[c] = pruneMats(Array.from(map.values()));

  await persist(idx, true); // ALWAYS re-upload remote index
  return idx.materials[c];
}

export async function getClassMaterials(
  code: string
): Promise<TeacherMaterial[]> {
  const c = code.toUpperCase();
  // Always refresh from remote so student sees latest teacher uploads
  const idx = await loadIndex(true);
  return pruneMats(idx.materials?.[c] || []);
}

export async function setClassMaterialsUrl(code: string, matsUrl: string) {
  const c = code.toUpperCase();
  if (!matsUrl?.startsWith("http")) return;
  const idx = await loadIndex(true);
  if (!idx.matsUrls) idx.matsUrls = {};
  idx.matsUrls[c] = matsUrl;
  await persist(idx, true);
}

export async function getClassMaterialsUrl(
  code: string
): Promise<string | null> {
  const c = code.toUpperCase();
  const idx = await loadIndex(true);
  return idx.matsUrls?.[c] || null;
}
