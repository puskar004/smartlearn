import {
  getSupabaseAdmin,
  supabaseStorageBucket,
} from "@/lib/supabase-admin";

const ensured = new Set<string>();

async function ensurePublicBucket(bucket: string) {
  if (ensured.has(bucket)) return;
  const sb = getSupabaseAdmin();
  if (!sb) return;
  try {
    const { data: list } = await sb.storage.listBuckets();
    const exists = (list || []).some((b) => b.name === bucket);
    if (!exists) {
      const { error } = await sb.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: [
          "application/pdf",
          "image/png",
          "image/jpeg",
          "image/webp",
        ],
      });
      if (error && !/already exists|duplicate/i.test(error.message)) {
        console.error("createBucket", error.message);
        return;
      }
    } else {
      // Best-effort public
      await sb.storage.updateBucket(bucket, {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
      });
    }
    ensured.add(bucket);
  } catch (e) {
    console.error("ensurePublicBucket", e);
  }
}

function safePathPart(s: string) {
  return String(s || "x")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80);
}

/**
 * Upload class PDF/image to Supabase Storage (free plan).
 * Returns public https URL or null.
 */
export async function uploadToSupabaseStorage(
  buf: Buffer,
  opts: {
    code: string;
    teacherId: string;
    filename: string;
    contentType: string;
  }
): Promise<string | null> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    console.warn("supabase: missing URL or SERVICE_ROLE_KEY");
    return null;
  }
  const bucket = supabaseStorageBucket();
  await ensurePublicBucket(bucket);

  const code = safePathPart(opts.code.toUpperCase());
  const tid = safePathPart(opts.teacherId).slice(0, 24);
  const fname = safePathPart(opts.filename || "notes.pdf");
  const path = `${code}/${tid}/${Date.now()}_${buf.length}_${fname}`;

  const { error } = await sb.storage.from(bucket).upload(path, buf, {
    contentType: opts.contentType || "application/pdf",
    upsert: false,
    cacheControl: "3600",
  });

  if (error) {
    console.error("supabase upload", error.message);
    return null;
  }

  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  const url = data?.publicUrl;
  if (url && /^https?:\/\//i.test(url)) return url;
  return null;
}
