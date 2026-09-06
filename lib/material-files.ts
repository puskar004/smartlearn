import { promises as fs } from "fs";
import path from "path";
import { uploadBufferRemote } from "@/lib/remote-upload";

const MAX_BYTES = 5 * 1024 * 1024;

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
): Promise<{ key: string; url: string; durable: boolean }> {
  if (buf.length > MAX_BYTES) {
    throw new Error(`PDF max ${MAX_BYTES / (1024 * 1024)}MB`);
  }
  if (buf.length < 50) throw new Error("Empty or invalid file");

  const safeCode = code.replace(/[^A-Z0-9]/gi, "").slice(0, 12) || "CLASS";
  const key = `${safeCode}_${teacherId.slice(0, 10)}_${Date.now()}.${(ext || "pdf").replace(/[^a-z0-9]/gi, "")}`;
  const mime =
    ext === "pdf"
      ? "application/pdf"
      : ext === "png"
        ? "image/png"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : "application/octet-stream";

  const remote = await uploadBufferRemote(buf, key, mime);
  if (remote) {
    try {
      await fs.mkdir(dataDir(), { recursive: true });
      await fs.writeFile(path.join(dataDir(), key), buf);
    } catch {
      // ignore
    }
    return { key, url: remote, durable: true };
  }

  // Dev local only
  if (!process.env.VERCEL) {
    await fs.mkdir(dataDir(), { recursive: true });
    await fs.writeFile(path.join(dataDir(), key), buf);
    return {
      key,
      url: `/api/classroom/material?key=${encodeURIComponent(key)}`,
      durable: false,
    };
  }

  throw new Error(
    "Could not store PDF online. Paste a Google Drive link (Share → Anyone with the link) instead."
  );
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
    return { buf, contentType };
  } catch {
    return null;
  }
}
