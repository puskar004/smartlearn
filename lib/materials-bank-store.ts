/**
 * Materials by class code — primary store students read from.
 * Survives better than only Clerk / only /tmp.
 */
import { promises as fs } from "fs";
import path from "path";
import type { TeacherMaterial } from "@/lib/classroom-types";
import { uploadBufferRemote } from "@/lib/remote-upload";

type CodeBank = {
  /** classCode → materials */
  byCode: Record<
    string,
    { teacherId: string; teacherName?: string; materials: TeacherMaterial[] }
  >;
  updatedAt: number;
  /** last remote mirror URL */
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

async function readRemote(url: string): Promise<CodeBank | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as CodeBank;
    if (j?.byCode) return j;
  } catch {
    // ignore
  }
  return null;
}

async function loadBank(): Promise<CodeBank> {
  if (mem.bank) return mem.bank;

  // 1) local file
  try {
    const raw = await fs.readFile(localPath(), "utf8");
    const j = JSON.parse(raw) as CodeBank;
    if (j?.byCode) {
      mem.bank = j;
      return j;
    }
  } catch {
    // ignore
  }

  // 2) remote pointer
  try {
    const url = (await fs.readFile(pointerPath(), "utf8")).trim();
    if (url.startsWith("http")) {
      const remote = await readRemote(url);
      if (remote) {
        mem.bank = remote;
        return remote;
      }
    }
  } catch {
    // ignore
  }

  const empty: CodeBank = { byCode: {}, updatedAt: Date.now() };
  mem.bank = empty;
  return empty;
}

async function persistBank(bank: CodeBank) {
  bank.updatedAt = Date.now();
  mem.bank = bank;
  const fp = localPath();
  try {
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, JSON.stringify(bank), "utf8");
  } catch (e) {
    console.error("materials local write", e);
  }

  // Mirror whole bank to public host so other serverless instances can read
  try {
    const remote = await uploadBufferRemote(
      Buffer.from(JSON.stringify(bank), "utf8"),
      `class-materials-${Date.now()}.json`,
      "application/json"
    );
    if (remote) {
      bank.remoteUrl = remote;
      mem.bank = bank;
      await fs.writeFile(pointerPath(), remote, "utf8").catch(() => null);
      await fs.writeFile(fp, JSON.stringify(bank), "utf8").catch(() => null);
    }
  } catch (e) {
    console.error("materials remote mirror", e);
  }
}

export async function addMaterialToBank(
  teacherId: string,
  code: string,
  material: TeacherMaterial,
  teacherName?: string
): Promise<TeacherMaterial[]> {
  const c = code.toUpperCase();
  const bank = await loadBank();
  const cur = bank.byCode[c] || {
    teacherId,
    teacherName,
    materials: [],
  };
  const materials = [material, ...(cur.materials || [])]
    .filter((m) => m?.url)
    .slice(0, 40);
  bank.byCode[c] = {
    teacherId,
    teacherName: teacherName || cur.teacherName,
    materials,
  };
  await persistBank(bank);
  return materials;
}

export async function getMaterialsByCode(
  code: string
): Promise<TeacherMaterial[]> {
  const c = code.toUpperCase();
  let bank = await loadBank();

  // If empty in mem/local, try last remote URL again
  if (!bank.byCode[c]?.materials?.length && bank.remoteUrl) {
    const remote = await readRemote(bank.remoteUrl);
    if (remote?.byCode) {
      bank = remote;
      mem.bank = remote;
    }
  }

  return bank.byCode[c]?.materials || [];
}

export async function getMaterialsFromBank(
  teacherId: string,
  code: string
): Promise<TeacherMaterial[]> {
  const c = code.toUpperCase();
  const bank = await loadBank();
  const entry = bank.byCode[c];
  if (entry?.teacherId && entry.teacherId !== teacherId) {
    // still return — same class code
  }
  return entry?.materials || [];
}

export async function getMaterialsForTeacher(
  teacherId: string
): Promise<Record<string, TeacherMaterial[]>> {
  const bank = await loadBank();
  const out: Record<string, TeacherMaterial[]> = {};
  for (const [code, entry] of Object.entries(bank.byCode)) {
    if (entry.teacherId === teacherId) {
      out[code] = entry.materials || [];
    }
  }
  return out;
}
