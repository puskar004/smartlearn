/**
 * Durable materials index (class code → notes list).
 * Avoids stuffing large classroom objects into Clerk on every upload.
 */
import { promises as fs } from "fs";
import path from "path";
import type { TeacherMaterial } from "@/lib/classroom-types";
import { uploadBufferRemote } from "@/lib/remote-upload";

type BankFile = {
  /** teacherId → code → materials */
  byTeacher: Record<string, Record<string, TeacherMaterial[]>>;
  updatedAt: number;
};

function filePath() {
  const dir = process.env.VERCEL
    ? "/tmp"
    : path.join(process.cwd(), ".data");
  return path.join(dir, "smartlearn-materials-bank.json");
}

async function readBank(): Promise<BankFile> {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    const j = JSON.parse(raw) as BankFile;
    if (j?.byTeacher) return j;
  } catch {
    // ignore
  }
  return { byTeacher: {}, updatedAt: Date.now() };
}

async function writeBank(bank: BankFile) {
  bank.updatedAt = Date.now();
  const fp = filePath();
  try {
    await fs.mkdir(path.dirname(fp), { recursive: true });
  } catch {
    // ignore
  }
  await fs.writeFile(fp, JSON.stringify(bank), "utf8");

  // Best-effort remote mirror so cold starts can recover (optional)
  try {
    const remote = await uploadBufferRemote(
      Buffer.from(JSON.stringify(bank), "utf8"),
      `materials-bank-${Date.now()}.json`,
      "application/json"
    );
    if (remote) {
      // store pointer beside file
      await fs.writeFile(
        fp + ".url",
        remote,
        "utf8"
      ).catch(() => null);
    }
  } catch {
    // ignore
  }
}

export async function addMaterialToBank(
  teacherId: string,
  code: string,
  material: TeacherMaterial
): Promise<TeacherMaterial[]> {
  const c = code.toUpperCase();
  const bank = await readBank();
  if (!bank.byTeacher[teacherId]) bank.byTeacher[teacherId] = {};
  const list = bank.byTeacher[teacherId][c] || [];
  const next = [material, ...list].slice(0, 40);
  bank.byTeacher[teacherId][c] = next;
  await writeBank(bank);
  return next;
}

export async function getMaterialsFromBank(
  teacherId: string,
  code: string
): Promise<TeacherMaterial[]> {
  const c = code.toUpperCase();
  const bank = await readBank();
  return bank.byTeacher[teacherId]?.[c] || [];
}

export async function getMaterialsForTeacher(
  teacherId: string
): Promise<Record<string, TeacherMaterial[]>> {
  const bank = await readBank();
  return bank.byTeacher[teacherId] || {};
}
