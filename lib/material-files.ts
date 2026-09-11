import { promises as fs } from "fs";
import path from "path";
import { uploadBufferRemote } from "@/lib/remote-upload";
import { uploadToSupabaseStorage } from "@/lib/supabase-storage";

const MAX_BYTES = 5 * 1024 * 1024;
/** PDFs up to this size can embed as data: fallback */
const DATA_URL_MAX = 550_000;

const mem = new Map<string, { buf: Buffer; contentType: string }>();

function dataDir() {
  return process.env.VERCEL
    ? "/tmp/smartlearn-materials"
    : path.join(process.cwd(), ".data", "class-materials");
}

export function materialMaxBytes() {
  return MAX_BYTES;
}

function mimeFor(ext: string) {
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

/**
 * Save PDF for class notes.
 * 1) Supabase Storage (preferred, free plan)
 * 2) Free public hosts
 * 3) Small data: embed
 */
export async function saveMaterialFile(
  teacherId: string,
  code: string,
  buf: Buffer,
  ext = "pdf"
): Promise<{ key: string; url: string; durable: boolean; storage?: string }> {
  if (buf.length > MAX_BYTES) {
    throw new Error(`PDF max ${MAX_BYTES / (1024 * 1024)}MB`);
  }
  if (buf.length < 20) throw new Error("Empty or invalid file");

  const safeCode = code.replace(/[^A-Z0-9]/gi, "").slice(0, 12) || "CLASS";
  const key = `${safeCode}_${teacherId.slice(0, 10)}_${Date.now()}_${buf.length}.${(ext || "pdf").replace(/[^a-z0-9]/gi, "")}`;
  const mime = mimeFor((ext || "pdf").toLowerCase());
  const filename = `notes.${(ext || "pdf").replace(/[^a-z0-9]/gi, "") || "pdf"}`;

  mem.set(key, { buf, contentType: mime });
  try {
    await fs.mkdir(dataDir(), { recursive: true });
    await fs.writeFile(path.join(dataDir(), key), buf);
  } catch {
    // ignore
  }

  // 1) Supabase Storage (durable public URL for students)
  try {
    const supabaseUrl = await uploadToSupabaseStorage(buf, {
      code: safeCode,
      teacherId,
      filename,
      contentType: mime,
    });
    if (supabaseUrl && /^https?:\/\//i.test(supabaseUrl)) {
      return { key, url: supabaseUrl, durable: true, storage: "supabase" };
    }
  } catch (e) {
    console.error("supabase material upload", e);
  }

  // 2) Free public hosts fallback
  try {
    const remote = await uploadBufferRemote(buf, key, mime);
    if (remote && /^https?:\/\//i.test(remote)) {
      return { key, url: remote, durable: true, storage: "free-host" };
    }
  } catch {
    // fall through
  }

  // 3) data: embed for small files
  if (buf.length <= DATA_URL_MAX) {
    return {
      key,
      url: `data:${mime};base64,${buf.toString("base64")}`,
      durable: true,
      storage: "data-url",
    };
  }

  return { key, url: "", durable: false };
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
