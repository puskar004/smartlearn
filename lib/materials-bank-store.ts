/**
 * Class materials bank — visible to students for 48 hours.
 * Mirrored to a public JSON URL so any serverless instance can read it.
 */
import { promises as fs } from "fs";
import path from "path";
import type { TeacherMaterial } from "@/lib/classroom-types";
import { uploadBufferRemote } from "@/lib/remote-upload";

export const MATERIAL_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

export type CodeBank = {
  byCode: Record<
    string,
    { teacherId: string; teacherName?: string; materials: TeacherMaterial[] }
  >;
  /** CODE → dedicated remote JSON for that class (fast student lookup) */
  codeUrls?: Record<string, string>;
  updatedAt: number;
  remoteUrl?: string;
};

const mem: { bank: CodeBank | null } = { bank: null };

function localPath() {
  const dir = process.env.VERCEL
    ? "/tmp"
    : path.join(process.cwd(), ".data");
  return path.join(dir, "smartlearn-class-materials.json");
}

function pointerPath() {
  return localPath() + ".remote";
}

function codeLocalPath(code: string) {
  const dir = process.env.VERCEL
    ? "/tmp"
    : path.join(process.cwd(), ".data");
  return path.join(dir, `smartlearn-mats-${code.toUpperCase()}.json`);
}

export function materialExpiresAt(m: { createdAt?: number; expiresAt?: number }) {
  if (m.expiresAt && m.expiresAt > 0) return m.expiresAt;
  return (m.createdAt || Date.now()) + MATERIAL_TTL_MS;
}

export function isMaterialActive(m: TeacherMaterial) {
  if (!m?.url) return false;
  return Date.now() < materialExpiresAt(m);
}

function pruneList(list: TeacherMaterial[]): TeacherMaterial[] {
  return (list || [])
    .filter(isMaterialActive)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 40);
}

async function readRemote(url: string): Promise<CodeBank | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as CodeBank;
    if (j?.byCode && typeof j.byCode === "object") return j;
  } catch {
    // ignore
  }
  return null;
}

async function readCodeRemote(
  url: string
): Promise<{ materials: TeacherMaterial[]; teacherName?: string } | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      materials?: TeacherMaterial[];
      teacherName?: string;
    };
    if (Array.isArray(j.materials)) {
      return { materials: j.materials, teacherName: j.teacherName };
    }
  } catch {
    // ignore
  }
  return null;
}

async function loadBank(seedRemoteUrl?: string | null): Promise<CodeBank> {
  if (mem.bank?.byCode && Object.keys(mem.bank.byCode).length) {
    return mem.bank;
  }

  if (seedRemoteUrl?.startsWith("http")) {
    const remote = await readRemote(seedRemoteUrl);
    if (remote) {
      mem.bank = remote;
      return remote;
    }
  }

  try {
    const ptr = (await fs.readFile(pointerPath(), "utf8")).trim();
    if (ptr.startsWith("http")) {
      const remote = await readRemote(ptr);
      if (remote) {
        mem.bank = remote;
        return remote;
      }
    }
  } catch {
    // ignore
  }

  try {
    const raw = await fs.readFile(localPath(), "utf8");
    const j = JSON.parse(raw) as CodeBank;
    if (j?.byCode) {
      mem.bank = j;
      if (j.remoteUrl) {
        const remote = await readRemote(j.remoteUrl);
        if (remote) {
          mem.bank = remote;
          return remote;
        }
      }
      return j;
    }
  } catch {
    // ignore
  }

  const empty: CodeBank = { byCode: {}, codeUrls: {}, updatedAt: Date.now() };
  mem.bank = empty;
  return empty;
}

async function persistBank(bank: CodeBank): Promise<string | null> {
  // prune all codes
  for (const code of Object.keys(bank.byCode)) {
    bank.byCode[code].materials = pruneList(bank.byCode[code].materials || []);
  }
  bank.updatedAt = Date.now();
  mem.bank = bank;
  const fp = localPath();
  try {
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, JSON.stringify(bank), "utf8");
  } catch {
    // ignore
  }

  // Always re-upload full bank so other instances see new PDFs
  try {
    const remote = await uploadBufferRemote(
      Buffer.from(JSON.stringify(bank), "utf8"),
      `class-materials-${Date.now()}.json`,
      "application/json"
    );
    if (remote) {
      bank.remoteUrl = remote;
      mem.bank = bank;
      try {
        await fs.writeFile(fp, JSON.stringify(bank), "utf8");
        await fs.writeFile(pointerPath(), remote, "utf8");
      } catch {
        // ignore
      }
      return remote;
    }
  } catch (e) {
    console.error("materials remote mirror", e);
  }
  return bank.remoteUrl || null;
}

/** Upload per-class JSON (small, fast for students) */
async function persistClassPack(
  code: string,
  teacherId: string,
  teacherName: string,
  materials: TeacherMaterial[]
): Promise<string | null> {
  const c = code.toUpperCase();
  const pack = {
    code: c,
    teacherId,
    teacherName,
    materials: pruneList(materials),
    updatedAt: Date.now(),
    ttlHours: 48,
  };
  try {
    await fs.writeFile(codeLocalPath(c), JSON.stringify(pack), "utf8");
  } catch {
    // ignore
  }
  try {
    const remote = await uploadBufferRemote(
      Buffer.from(JSON.stringify(pack), "utf8"),
      `mats-${c}-${Date.now()}.json`,
      "application/json"
    );
    return remote;
  } catch {
    return null;
  }
}

export async function addMaterialToBank(
  teacherId: string,
  code: string,
  material: TeacherMaterial,
  teacherName?: string,
  seedRemoteUrl?: string | null
): Promise<{ materials: TeacherMaterial[]; remoteUrl: string | null }> {
  const c = code.toUpperCase();
  const bank = await loadBank(seedRemoteUrl);
  const cur = bank.byCode[c] || {
    teacherId,
    teacherName,
    materials: [],
  };

  const withExpiry: TeacherMaterial = {
    ...material,
    createdAt: material.createdAt || Date.now(),
    expiresAt:
      material.expiresAt ||
      (material.createdAt || Date.now()) + MATERIAL_TTL_MS,
  };

  const materials = pruneList([
    withExpiry,
    ...(cur.materials || []).filter(
      (m) => m.id !== withExpiry.id && m.url !== withExpiry.url
    ),
  ]);

  bank.byCode[c] = {
    teacherId,
    teacherName: teacherName || cur.teacherName,
    materials,
  };

  const classUrl = await persistClassPack(
    c,
    teacherId,
    teacherName || cur.teacherName || "Teacher",
    materials
  );
  if (!bank.codeUrls) bank.codeUrls = {};
  if (classUrl) bank.codeUrls[c] = classUrl;

  const remoteUrl = await persistBank(bank);

  // Keep class code → mats URL pointer for student lookup without Clerk
  try {
    const { setClassMaterialsUrl } = await import("@/lib/class-code-index");
    if (classUrl) await setClassMaterialsUrl(c, classUrl);
  } catch {
    // ignore
  }

  return { materials, remoteUrl: classUrl || remoteUrl };
}

export async function getMaterialsByCode(
  code: string,
  seedRemoteUrl?: string | null
): Promise<TeacherMaterial[]> {
  const c = code.toUpperCase();

  // 1) Per-class remote URL from code index
  try {
    const { getClassMaterialsUrl } = await import("@/lib/class-code-index");
    const u = await getClassMaterialsUrl(c);
    if (u) {
      const pack = await readCodeRemote(u);
      if (pack?.materials?.length) return pruneList(pack.materials);
    }
  } catch {
    // ignore
  }

  // 2) Local per-class file
  try {
    const raw = await fs.readFile(codeLocalPath(c), "utf8");
    const j = JSON.parse(raw) as { materials?: TeacherMaterial[] };
    if (j.materials?.length) return pruneList(j.materials);
  } catch {
    // ignore
  }

  // 3) Full bank (mem / remote / disk)
  const bank = await loadBank(seedRemoteUrl);
  if (bank.codeUrls?.[c]) {
    const pack = await readCodeRemote(bank.codeUrls[c]);
    if (pack?.materials?.length) return pruneList(pack.materials);
  }
  return pruneList(bank.byCode[c]?.materials || []);
}

export async function getMaterialsFromBank(
  teacherId: string,
  code: string,
  seedRemoteUrl?: string | null
): Promise<TeacherMaterial[]> {
  return getMaterialsByCode(code, seedRemoteUrl);
}

export async function getMaterialsForTeacher(
  teacherId: string,
  seedRemoteUrl?: string | null
): Promise<Record<string, TeacherMaterial[]>> {
  const bank = await loadBank(seedRemoteUrl);
  const out: Record<string, TeacherMaterial[]> = {};
  for (const [code, entry] of Object.entries(bank.byCode)) {
    if (entry.teacherId === teacherId) {
      out[code] = pruneList(entry.materials || []);
    }
  }
  return out;
}
