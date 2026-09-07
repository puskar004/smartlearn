/**
 * Materials by class code with durable remote JSON index.
 * Clerk only stores a short materialsIndexUrl on the teacher.
 */
import { promises as fs } from "fs";
import path from "path";
import type { TeacherMaterial } from "@/lib/classroom-types";
import { uploadBufferRemote } from "@/lib/remote-upload";

export type CodeBank = {
  byCode: Record<
    string,
    { teacherId: string; teacherName?: string; materials: TeacherMaterial[] }
  >;
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

async function loadBank(seedRemoteUrl?: string | null): Promise<CodeBank> {
  if (mem.bank?.byCode && Object.keys(mem.bank.byCode).length) {
    return mem.bank;
  }

  // Prefer teacher-provided remote seed (from Clerk)
  if (seedRemoteUrl?.startsWith("http")) {
    const remote = await readRemote(seedRemoteUrl);
    if (remote) {
      mem.bank = remote;
      return remote;
    }
  }

  try {
    const raw = await fs.readFile(localPath(), "utf8");
    const j = JSON.parse(raw) as CodeBank;
    if (j?.byCode) {
      mem.bank = j;
      // also try its remoteUrl
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

  const empty: CodeBank = { byCode: {}, updatedAt: Date.now() };
  mem.bank = empty;
  return empty;
}

async function persistBank(bank: CodeBank): Promise<string | null> {
  bank.updatedAt = Date.now();
  mem.bank = bank;
  const fp = localPath();
  try {
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, JSON.stringify(bank), "utf8");
  } catch {
    // ignore
  }

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
  const materials = [material, ...(cur.materials || [])]
    .filter((m) => m?.url && String(m.url).trim())
    .filter(
      (m, i, arr) =>
        arr.findIndex((x) => x.id === m.id || x.url === m.url) === i
    )
    .slice(0, 40);
  bank.byCode[c] = {
    teacherId,
    teacherName: teacherName || cur.teacherName,
    materials,
  };
  const remoteUrl = await persistBank(bank);
  return { materials, remoteUrl };
}

export async function getMaterialsByCode(
  code: string,
  seedRemoteUrl?: string | null
): Promise<TeacherMaterial[]> {
  const c = code.toUpperCase();
  const bank = await loadBank(seedRemoteUrl);
  return bank.byCode[c]?.materials || [];
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
      out[code] = entry.materials || [];
    }
  }
  return out;
}
