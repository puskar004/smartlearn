import { promises as fs } from "fs";
import path from "path";
import { uploadBufferRemote } from "@/lib/remote-upload";

const MAX_BYTES = 5 * 1024 * 1024;

/** In-memory fallback for current serverless instance */
const mem = new Map<string, { buf: Buffer; contentType: string }>();

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
  if (buf.length < 20) throw new Error("Empty or invalid file");

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

  // 1) Prefer public durable host
  const remote = await uploadBufferRemote(buf, key, mime);
  if (remote) {
    mem.set(key, { buf, contentType: mime });
    try {
      await fs.mkdir(dataDir(), { recursive: true });
      await fs.writeFile(path.join(dataDir(), key), buf);
    } catch {
      // ignore
    }
    return { key, url: remote, durable: true };
  }

  // 2) Local disk + API URL (works in dev; on Vercel may be same-instance only)
  try {
    await fs.mkdir(dataDir(), { recursive: true });
    await fs.writeFile(path.join(dataDir(), key), buf);
  } catch {
    // ignore
  }
  mem.set(key, { buf, contentType: mime });

  // 3) Small files: embed as data URL so students always get the file via Clerk bank
  if (buf.length <= 220_000) {
    const b64 = buf.toString("base64");
    return {
      key,
      url: `data:${mime};base64,${b64}`,
      durable: true,
    };
  }

  // 4) Serve via our API (student must hit warm instance — better than nothing)
  return {
    key,
    url: `/api/classroom/material?key=${encodeURIComponent(key)}`,
    durable: false,
  };
}

export async function readMaterialFile(
  key: string
): Promise<{ buf: Buffer; contentType: string } | null> {
  const safe = path.basename(key);
  if (!safe || safe.includes("..")) return null;

  const hit = mem.get(safe);
  if (hit) return hit;

  try {
    const buf = await fs.readFile(path.join(dataDir(), safe));
    const lower = safe.toLowerCase();
    let contentType = "application/octet-stream";
    if (lower.endsWith(".pdf")) contentType = "application/pdf";
    else if (lower.endsWith(".png")) contentType = "image/png";
    else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
      contentType = "image/jpeg";
    mem.set(safe, { buf, contentType });
    return { buf, contentType };
  } catch {
    return null;
  }
}
