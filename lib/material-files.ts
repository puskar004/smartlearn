import { promises as fs } from "fs";
import path from "path";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function dataDir() {
  return process.env.VERCEL
    ? "/tmp/smartlearn-materials"
    : path.join(process.cwd(), ".data", "class-materials");
}

export function materialMaxBytes() {
  return MAX_BYTES;
}

export async function saveMaterialFile(
  teacherId: string,
  code: string,
  buf: Buffer,
  ext = "pdf"
): Promise<string> {
  if (buf.length > MAX_BYTES) {
    throw new Error(`PDF max ${MAX_BYTES / (1024 * 1024)}MB`);
  }
  if (buf.length < 50) {
    throw new Error("Empty or invalid file");
  }
  const dir = dataDir();
  await fs.mkdir(dir, { recursive: true });
  const safeCode = code.replace(/[^A-Z0-9]/gi, "").slice(0, 12) || "CLASS";
  const key = `${safeCode}_${teacherId.slice(0, 12)}_${Date.now()}.${ext.replace(/[^a-z0-9]/gi, "") || "pdf"}`;
  await fs.writeFile(path.join(dir, key), buf);
  return key;
}

export async function readMaterialFile(
  key: string
): Promise<{ buf: Buffer; contentType: string } | null> {
  try {
    const safe = path.basename(key);
    if (!safe || safe.includes("..")) return null;
    const buf = await fs.readFile(path.join(dataDir(), safe));
    const lower = safe.toLowerCase();
    let contentType = "application/octet-stream";
    if (lower.endsWith(".pdf")) contentType = "application/pdf";
    else if (lower.endsWith(".png")) contentType = "image/png";
    else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
      contentType = "image/jpeg";
    else if (lower.endsWith(".webp")) contentType = "image/webp";
    return { buf, contentType };
  } catch {
    return null;
  }
}

export function materialFileUrl(key: string) {
  return `/api/classroom/material?key=${encodeURIComponent(key)}`;
}
