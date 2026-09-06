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

/** Upload to free durable host so Vercel /tmp cold starts don't lose files */
async function uploadRemote(buf: Buffer, filename: string): Promise<string | null> {
  // 1) Vercel Blob if token configured
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(`smartlearn-materials/${filename}`, buf, {
        access: "public",
        token,
        contentType: filename.endsWith(".pdf")
          ? "application/pdf"
          : "application/octet-stream",
      });
      if (blob?.url) return blob.url;
    } catch (e) {
      console.error("blob upload", e);
    }
  }

  // 2) catbox.moe anonymous upload (public URL, works cross-server)
  try {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    const bytes = new Uint8Array(buf);
    form.append(
      "fileToUpload",
      new Blob([bytes], {
        type: filename.endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
      }),
      filename
    );
    const res = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: form,
    });
    const text = (await res.text()).trim();
    if (text.startsWith("https://") || text.startsWith("http://")) {
      return text;
    }
    console.error("catbox response", text.slice(0, 200));
  } catch (e) {
    console.error("catbox upload", e);
  }

  // 3) 0x0.st fallback
  try {
    const form = new FormData();
    const bytes = new Uint8Array(buf);
    form.append(
      "file",
      new Blob([bytes], {
        type: filename.endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
      }),
      filename
    );
    const res = await fetch("https://0x0.st", { method: "POST", body: form });
    const text = (await res.text()).trim();
    if (text.startsWith("https://") || text.startsWith("http://")) {
      return text;
    }
  } catch (e) {
    console.error("0x0 upload", e);
  }

  return null;
}

/**
 * Save material file. Returns a durable https URL when possible,
 * otherwise a local key URL (dev only — lost on Vercel cold start).
 */
export async function saveMaterialFile(
  teacherId: string,
  code: string,
  buf: Buffer,
  ext = "pdf"
): Promise<{ key: string; url: string; durable: boolean }> {
  if (buf.length > MAX_BYTES) {
    throw new Error(`PDF max ${MAX_BYTES / (1024 * 1024)}MB`);
  }
  if (buf.length < 50) {
    throw new Error("Empty or invalid file");
  }

  const safeCode = code.replace(/[^A-Z0-9]/gi, "").slice(0, 12) || "CLASS";
  const key = `${safeCode}_${teacherId.slice(0, 12)}_${Date.now()}.${ext.replace(/[^a-z0-9]/gi, "") || "pdf"}`;

  // Always try remote first (production-safe)
  const remote = await uploadRemote(buf, key);
  if (remote) {
    // also keep local copy for same-instance GETs
    try {
      const dir = dataDir();
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, key), buf);
    } catch {
      // ignore local write failures on serverless
    }
    return { key, url: remote, durable: true };
  }

  // Local fallback (works in `next dev`, flaky on Vercel)
  const dir = dataDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, key), buf);

  // Last resort: data URL for small files (< 400KB) so student can still open
  if (buf.length <= 400_000) {
    const b64 = buf.toString("base64");
    const mime =
      ext === "pdf"
        ? "application/pdf"
        : ext === "png"
          ? "image/png"
          : ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : "application/octet-stream";
    return {
      key,
      url: `data:${mime};base64,${b64}`,
      durable: true,
    };
  }

  return {
    key,
    url: `/api/classroom/material?key=${encodeURIComponent(key)}`,
    durable: false,
  };
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
