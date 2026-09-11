/**
 * Durable student remarks backup (Clerk metadata can lag/fail).
 * File + memory so Remarks page always has something to show.
 */
import { promises as fs } from "fs";
import path from "path";
import type { TeacherRemark } from "@/lib/classroom-types";

type Store = Record<string, TeacherRemark[]>;

const mem: { data: Store } = { data: {} };

function filePath() {
  const dir = process.env.VERCEL
    ? "/tmp"
    : path.join(process.cwd(), ".data");
  return path.join(dir, "smartlearn-student-remarks.json");
}

async function load(): Promise<Store> {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    const j = JSON.parse(raw) as Store;
    if (j && typeof j === "object") {
      mem.data = { ...mem.data, ...j };
      return mem.data;
    }
  } catch {
    // ignore
  }
  return mem.data;
}

async function save(data: Store) {
  mem.data = data;
  try {
    await fs.mkdir(path.dirname(filePath()), { recursive: true });
    await fs.writeFile(filePath(), JSON.stringify(data), "utf8");
  } catch (e) {
    console.error("remarks-store save", e);
  }
}

export async function appendStudentRemark(
  studentId: string,
  remark: TeacherRemark
) {
  const data = await load();
  const prev = data[studentId] || [];
  const next = [remark, ...prev.filter((r) => r.id !== remark.id)].slice(0, 50);
  data[studentId] = next;
  await save(data);
  return next;
}

export async function listStudentRemarksFile(
  studentId: string
): Promise<TeacherRemark[]> {
  const data = await load();
  return data[studentId] || [];
}
