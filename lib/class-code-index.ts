/**
 * Class code → teacherId + materials (48h).
 * Always mirrored to a public JSON URL so every serverless instance can read it.
 */
import { promises as fs } from "fs";
import path from "path";
import type { LiveSession, TeacherMaterial } from "@/lib/classroom-types";
import { uploadBufferRemote } from "@/lib/remote-upload";

/** Keep teacher PDFs visible longer so history is not wiped after 2 days */
const MATERIAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Lightweight live payload shared across servers (students poll this) */
export type SharedLive = {
  id: string;
  title: string;
  subject: string;
  meetUrl?: string;
  joinCode: string;
  active: boolean;
  /** Explicit end marker — students must hide Meet/banner */
  ended?: boolean;
  startedAt: number;
  endsAt: number;
  joinUntil?: number;
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
  /** CODE → dedicated tiny live JSON URL (more reliable than full index) */
  liveUrls?: Record<string, string>;
  /** Soft-deleted codes (students should drop these) */
  deleted?: Record<string, number>;
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

function mergeMaterialLists(
  ...lists: (TeacherMaterial[] | undefined)[]
): TeacherMaterial[] {
  // One entry per URL; newest createdAt wins — old + new PDFs both kept
  const byUrl = new Map<string, TeacherMaterial>();
  for (const list of lists) {
    for (const m of list || []) {
      if (!m?.url || !stillActive(m)) continue;
      const prev = byUrl.get(m.url);
      if (!prev || (m.createdAt || 0) >= (prev.createdAt || 0)) {
        byUrl.set(m.url, m);
      }
    }
  }
  return pruneMats(Array.from(byUrl.values()));
}

function mergeIndexes(a: Index, b: Index): Index {
  const codes = { ...(a.codes || {}), ...(b.codes || {}) };
  const matsA = a.materials || {};
  const matsB = b.materials || {};
  const materials: Record<string, TeacherMaterial[]> = {};
  for (const c of new Set([...Object.keys(matsA), ...Object.keys(matsB)])) {
    materials[c] = mergeMaterialLists(matsA[c], matsB[c]);
  }
  return {
    codes,
    materials,
    matsUrls: { ...(a.matsUrls || {}), ...(b.matsUrls || {}) },
    live: { ...(a.live || {}), ...(b.live || {}) },
    liveUrls: { ...(a.liveUrls || {}), ...(b.liveUrls || {}) },
    deleted: { ...(a.deleted || {}), ...(b.deleted || {}) },
    updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0, Date.now()),
    remoteUrl: b.remoteUrl || a.remoteUrl,
  };
}

async function readLocalIndex(): Promise<Index | null> {
  try {
    const raw = await fs.readFile(localPath(), "utf8");
    const j = JSON.parse(raw) as Index;
    if (j?.codes) return j;
  } catch {
    // ignore
  }
  return null;
}

async function loadIndex(forceRemote = false): Promise<Index> {
  if (!forceRemote && mem.idx?.codes) return mem.idx;

  const local = (await readLocalIndex()) || mem.idx;
  let remote: Index | null = null;

  try {
    const url = (await fs.readFile(pointerPath(), "utf8")).trim();
    if (url.startsWith("http")) remote = await readRemote(url);
  } catch {
    // ignore
  }
  if (!remote && (local?.remoteUrl || mem.idx?.remoteUrl)) {
    remote = await readRemote(
      (local?.remoteUrl || mem.idx?.remoteUrl) as string
    );
  }

  let out: Index;
  if (remote && local) out = mergeIndexes(remote, local);
  else if (remote) out = remote;
  else if (local) out = local;
  else {
    out = {
      codes: {},
      materials: {},
      matsUrls: {},
      updatedAt: Date.now(),
    };
  }
  // Always fold in-memory latest publish (same instance) so new PDF not lost
  if (mem.idx?.materials) out = mergeIndexes(out, mem.idx);
  mem.idx = out;
  return out;
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

function liveLocalPath(code: string) {
  const dir = process.env.VERCEL
    ? "/tmp"
    : path.join(process.cwd(), ".data");
  return path.join(dir, `smartlearn-live-${code.toUpperCase()}.json`);
}

function liveStillValid(live: SharedLive | null): live is SharedLive {
  if (!live) return false;
  if (live.ended === true || live.active === false) return false;
  const now = Date.now();
  if (live.active) {
    const softMax = (live.startedAt || now) + 12 * 60 * 60 * 1000;
    return now <= softMax;
  }
  if (live.scheduledAt && live.scheduledAt > now) return true;
  return false;
}

export type LiveLookup =
  | { status: "active"; live: SharedLive }
  | { status: "ended" }
  | { status: "none" };

function isEndedPayload(j: SharedLive | null | undefined): boolean {
  return Boolean(j && (j.ended === true || j.active === false));
}

/** Teacher starts/ends live → students see it on any server */
export async function publishClassLive(
  code: string,
  teacherId: string,
  live: SharedLive | null
) {
  const c = code.toUpperCase();
  const ending = !live || live.ended || live.active === false;
  const payload: SharedLive | null = ending
    ? {
        id: live?.id || `ended-${Date.now()}`,
        title: live?.title || "Ended",
        subject: live?.subject || "",
        meetUrl: undefined,
        joinCode: "",
        active: false,
        ended: true,
        startedAt: live?.startedAt || Date.now(),
        endsAt: Date.now(),
        joinUntil: Date.now(),
        teacherName: live?.teacherName,
        className: live?.className,
      }
    : live &&
        (live.active ||
          (live.scheduledAt != null && live.scheduledAt > Date.now()))
      ? {
          id: live.id,
          title: live.title,
          subject: live.subject,
          meetUrl: live.meetUrl,
          joinCode: live.joinCode,
          active: Boolean(live.active),
          ended: false,
          startedAt: live.startedAt,
          endsAt: live.endsAt,
          joinUntil: live.joinUntil || live.endsAt,
          scheduledAt: live.scheduledAt,
          teacherName: live.teacherName,
          className: live.className,
        }
      : null;

  // 1) Local live file — ended tombstone or active payload (never leave stale active)
  try {
    await fs.mkdir(path.dirname(liveLocalPath(c)), { recursive: true });
    if (payload) {
      await fs.writeFile(liveLocalPath(c), JSON.stringify(payload), "utf8");
    }
  } catch {
    // ignore
  }

  // 2) Always upload new remote JSON so old active URLs are abandoned
  let liveUrl: string | null = null;
  if (payload) {
    try {
      liveUrl = await uploadBufferRemote(
        Buffer.from(JSON.stringify(payload), "utf8"),
        `live-${c}-${Date.now()}.json`,
        "application/json"
      );
    } catch {
      liveUrl = null;
    }
  }

  // 3) Shared index — always store payload (active or ended)
  // Prefer mem merge so we don't lose live when remote load is stale
  let idx = mem.idx;
  try {
    idx = await loadIndex(true);
  } catch {
    idx = mem.idx;
  }
  if (!idx) {
    idx = {
      codes: {},
      materials: {},
      matsUrls: {},
      live: {},
      liveUrls: {},
      updatedAt: Date.now(),
    };
  }
  // Re-apply mem live entries that are newer (instance that just published)
  if (mem.idx?.live) {
    idx.live = { ...(idx.live || {}), ...mem.idx.live };
  }
  if (mem.idx?.liveUrls) {
    idx.liveUrls = { ...(idx.liveUrls || {}), ...mem.idx.liveUrls };
  }

  idx.codes[c] = teacherId || idx.codes[c] || "";
  if (!idx.live) idx.live = {};
  if (!idx.liveUrls) idx.liveUrls = {};
  if (payload) {
    if (payload.ended || !payload.active) {
      // Keep ended marker in live map so other instances know it ended
      idx.live[c] = payload;
    } else {
      idx.live[c] = payload;
    }
    if (liveUrl) idx.liveUrls[c] = liveUrl;
  }
  mem.idx = idx;
  await persist(idx, true);
}

export async function lookupClassLive(code: string): Promise<LiveLookup> {
  const c = code.toUpperCase();

  // A) Local file
  try {
    const raw = await fs.readFile(liveLocalPath(c), "utf8");
    const j = JSON.parse(raw) as SharedLive;
    if (isEndedPayload(j)) return { status: "ended" };
    if (liveStillValid(j)) return { status: "active", live: j };
  } catch {
    // ignore
  }

  // B) In-memory index (same instance as teacher start — critical on Vercel)
  if (mem.idx?.live?.[c]) {
    const j = mem.idx.live[c];
    if (isEndedPayload(j)) return { status: "ended" };
    if (liveStillValid(j)) return { status: "active", live: j };
  }

  // C) Remote URL + disk index
  try {
    const idx = await loadIndex(true);
    // Merge mem again after load (load may overwrite)
    if (mem.idx?.live?.[c] && liveStillValid(mem.idx.live[c])) {
      return { status: "active", live: mem.idx.live[c]! };
    }
    const url = idx.liveUrls?.[c];
    if (url?.startsWith("http")) {
      const res = await fetch(
        url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(),
        { cache: "no-store", headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        const j = (await res.json()) as SharedLive;
        if (isEndedPayload(j)) {
          try {
            await fs.writeFile(liveLocalPath(c), JSON.stringify(j), "utf8");
          } catch {
            // ignore
          }
          return { status: "ended" };
        }
        if (liveStillValid(j)) {
          try {
            await fs.writeFile(liveLocalPath(c), JSON.stringify(j), "utf8");
          } catch {
            // ignore
          }
          return { status: "active", live: j };
        }
      }
    }
    const live = idx.live?.[c] || null;
    if (isEndedPayload(live)) return { status: "ended" };
    if (liveStillValid(live)) return { status: "active", live: live! };
  } catch {
    // ignore
  }

  return { status: "none" };
}

export async function getClassLive(code: string): Promise<SharedLive | null> {
  const r = await lookupClassLive(code);
  return r.status === "active" ? r.live : null;
}

/** Mark class deleted so students drop it on next poll */
export async function markClassDeleted(code: string) {
  const c = code.toUpperCase();
  const idx = await loadIndex(true);
  if (!idx.deleted) idx.deleted = {};
  idx.deleted[c] = Date.now();
  delete idx.codes[c];
  if (idx.live) delete idx.live[c];
  if (idx.liveUrls) delete idx.liveUrls[c];
  if (idx.materials) delete idx.materials[c];
  await persist(idx, true);
  try {
    await fs.unlink(liveLocalPath(c));
  } catch {
    // ignore
  }
}

export async function getDeletedCodes(codes: string[]): Promise<string[]> {
  if (!codes.length) return [];
  const idx = await loadIndex(true);
  const del = idx.deleted || {};
  const out: string[] = [];
  for (const raw of codes) {
    const c = raw.toUpperCase();
    if (del[c]) out.push(c);
    // also deleted if code no longer registered and was once known empty
  }
  return out;
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

  // Merge + keep https/small data; NEW uploads always win by createdAt
  const incoming = materials
    .map((m) => {
      let url = m.url || "";
      if (url.startsWith("data:") && url.length > 200_000) url = "";
      const createdAt = m.createdAt || Date.now();
      return {
        ...m,
        id: m.id || `mat-${createdAt}-${Math.random().toString(36).slice(2, 7)}`,
        url,
        createdAt,
        expiresAt: m.expiresAt || createdAt + MATERIAL_TTL_MS,
        teacherName: m.teacherName || teacherName || "Teacher",
      };
    })
    .filter((m) => m.url);

  const prev = idx.materials[c] || [];
  // Incoming first so new PDFs are never dropped
  idx.materials[c] = mergeMaterialLists(incoming, prev);
  mem.idx = idx;

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
