/**
 * Durable per-class materials catalog in Supabase Storage.
 * Path: meta/{CODE}.json — shared across localhost + all Vercel instances.
 */
import type { TeacherMaterial } from "@/lib/classroom-types";
import {
  getSupabaseAdmin,
  supabaseStorageBucket,
} from "@/lib/supabase-admin";

export type MaterialsIndex = {
  code: string;
  teacherId?: string;
  teacherName?: string;
  className?: string;
  materials: TeacherMaterial[];
  updatedAt: number;
};

function safeCode(code: string) {
  return String(code || "x")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12) || "CLASS";
}

function metaPath(code: string) {
  return `meta/${safeCode(code)}.json`;
}

function publicBase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()?.replace(/\/$/, "");
  const bucket = supabaseStorageBucket();
  if (!url) return null;
  return `${url}/storage/v1/object/public/${bucket}`;
}

function mergeMats(...lists: (TeacherMaterial[] | undefined)[]) {
  const byUrl = new Map<string, TeacherMaterial>();
  for (const list of lists) {
    for (const m of list || []) {
      if (!m?.url) continue;
      const prev = byUrl.get(m.url);
      if (!prev || (m.createdAt || 0) >= (prev.createdAt || 0)) {
        byUrl.set(m.url, m);
      }
    }
  }
  return Array.from(byUrl.values())
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 80);
}

/** Read materials index JSON from Supabase. */
export async function readMaterialsIndex(
  code: string
): Promise<MaterialsIndex | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const bucket = supabaseStorageBucket();
  const path = metaPath(code);
  try {
    const { data, error } = await sb.storage.from(bucket).download(path);
    if (error || !data) return null;
    const text = await data.text();
    const j = JSON.parse(text) as MaterialsIndex;
    if (!j || !Array.isArray(j.materials)) return null;
    j.code = safeCode(code);
    j.materials = mergeMats(j.materials);
    return j;
  } catch (e) {
    console.error("readMaterialsIndex", e);
    return null;
  }
}

/** Upsert full materials catalog for a class code. */
export async function writeMaterialsIndex(
  index: MaterialsIndex
): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  const bucket = supabaseStorageBucket();
  const c = safeCode(index.code);
  const payload: MaterialsIndex = {
    code: c,
    teacherId: index.teacherId,
    teacherName: index.teacherName,
    className: index.className,
    materials: mergeMats(index.materials),
    updatedAt: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const path = metaPath(c);
  try {
    const { error } = await sb.storage.from(bucket).upload(path, body, {
      contentType: "application/json",
      upsert: true,
      cacheControl: "60",
    });
    if (error) {
      console.error("writeMaterialsIndex", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("writeMaterialsIndex", e);
    return false;
  }
}

/**
 * Discover PDFs already in storage under {CODE}/… when meta JSON is missing.
 * Recovers lists after deploy without re-upload.
 */
export async function listMaterialsFromStorage(
  code: string
): Promise<TeacherMaterial[]> {
  const sb = getSupabaseAdmin();
  const base = publicBase();
  if (!sb || !base) return [];
  const bucket = supabaseStorageBucket();
  const c = safeCode(code);
  const out: TeacherMaterial[] = [];

  try {
    const { data: level1, error } = await sb.storage.from(bucket).list(c, {
      limit: 100,
    });
    if (error || !level1?.length) return [];

    for (const entry of level1) {
      const name = entry.name;
      if (!name || name === ".emptyFolderPlaceholder") continue;
      // Teacher folder: CODE/tid/file.pdf
      const { data: files } = await sb.storage
        .from(bucket)
        .list(`${c}/${name}`, { limit: 100 });
      if (files?.length) {
        for (const f of files) {
          if (!f.name || !/\.pdf$/i.test(f.name)) continue;
          const objectPath = `${c}/${name}/${f.name}`;
          const url = `${base}/${objectPath}`;
          const size = (f.metadata as { size?: number } | null)?.size || 0;
          const mtime = f.created_at
            ? Date.parse(f.created_at)
            : Date.now();
          const title =
            f.name
              .replace(/^\d+_\d+_/, "")
              .replace(/\.pdf$/i, "")
              .replace(/_/g, " ") || "Class notes";
          out.push({
            id: `sb-${objectPath}`,
            title,
            url,
            type: "notes",
            subject: "General",
            teacherName: "Teacher",
            createdAt: mtime || Date.now(),
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          });
          void size;
        }
      } else if (/\.pdf$/i.test(name)) {
        const objectPath = `${c}/${name}`;
        const url = `${base}/${objectPath}`;
        out.push({
          id: `sb-${objectPath}`,
          title: name.replace(/\.pdf$/i, ""),
          url,
          type: "notes",
          subject: "General",
          teacherName: "Teacher",
          createdAt: entry.created_at
            ? Date.parse(entry.created_at)
            : Date.now(),
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        });
      }
    }
  } catch (e) {
    console.error("listMaterialsFromStorage", e);
  }

  return mergeMats(out);
}

/** Load index: meta JSON, else storage listing (and backfill meta). */
export async function loadMaterialsIndex(
  code: string
): Promise<MaterialsIndex> {
  const c = safeCode(code);
  const existing = await readMaterialsIndex(c);
  if (existing?.materials?.length) return existing;

  const discovered = await listMaterialsFromStorage(c);
  const idx: MaterialsIndex = {
    code: c,
    materials: discovered,
    updatedAt: Date.now(),
    className: `Class ${c}`,
  };
  if (discovered.length) {
    void writeMaterialsIndex(idx);
  }
  return idx;
}
