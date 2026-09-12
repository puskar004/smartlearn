import {
  getSupabaseAdmin,
  supabaseStorageBucket,
} from "@/lib/supabase-admin";

function safePathPart(s: string) {
  return String(s || "x")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80);
}

/**
 * Upload class PDF/image to Supabase Storage (free plan).
 * Fast path: no listBuckets/updateBucket on every request (bucket must exist).
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
    // One-shot create bucket if missing, then retry once
    if (/not found|does not exist/i.test(error.message)) {
      try {
        await sb.storage.createBucket(bucket, {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024,
          allowedMimeTypes: [
            "application/pdf",
            "application/json",
            "text/plain",
            "image/png",
            "image/jpeg",
            "image/webp",
          ],
        });
        const retry = await sb.storage.from(bucket).upload(path, buf, {
          contentType: opts.contentType || "application/pdf",
          upsert: false,
          cacheControl: "3600",
        });
        if (retry.error) {
          console.error("supabase upload retry", retry.error.message);
          return null;
        }
      } catch (e) {
        console.error("supabase create/retry", e);
        return null;
      }
    } else {
      console.error("supabase upload", error.message);
      return null;
    }
  }

  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  const url = data?.publicUrl;
  if (url && /^https?:\/\//i.test(url)) return url;
  return null;
}
