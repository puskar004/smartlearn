/**
 * Public per-class materials pack (catbox JSON).
 * Students load this URL from teacher Clerk metadata — works across all servers.
 */
import type { TeacherMaterial } from "@/lib/classroom-types";
import { uploadBufferRemote } from "@/lib/remote-upload";

export const NOTES_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type ClassNotesPack = {
  code: string;
  teacherId: string;
  teacherName: string;
  className?: string;
  materials: TeacherMaterial[];
  updatedAt: number;
  ttlHours: number;
};

export function activeNotes(list: TeacherMaterial[] = []): TeacherMaterial[] {
  const now = Date.now();
  return list
    .filter((m) => {
      if (!m?.url) return false;
      // students need openable URLs (https, small data, or same-origin API)
      const u = m.url;
      const ok =
        u.startsWith("http://") ||
        u.startsWith("https://") ||
        u.startsWith("/api/") ||
        (u.startsWith("data:") && u.length < 200_000);
      if (!ok) return false;
      const exp = m.expiresAt || (m.createdAt || 0) + NOTES_TTL_MS;
      if (m.createdAt && exp < now) return false;
      return true;
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 30);
}

export async function uploadClassNotesPack(
  pack: ClassNotesPack
): Promise<string | null> {
  const body = {
    ...pack,
    materials: activeNotes(pack.materials),
    updatedAt: Date.now(),
    ttlHours: 48,
  };
  try {
    const url = await uploadBufferRemote(
      Buffer.from(JSON.stringify(body), "utf8"),
      `notes-${pack.code}-${Date.now()}.json`,
      "application/json"
    );
    return url;
  } catch {
    return null;
  }
}

export async function fetchClassNotesPack(
  url: string
): Promise<ClassNotesPack | null> {
  try {
    const res = await fetch(
      url + (url.includes("?") ? "&" : "?") + "_=" + Date.now(),
      {
        cache: "no-store",
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as ClassNotesPack;
    if (!j || !Array.isArray(j.materials)) return null;
    return {
      ...j,
      materials: activeNotes(j.materials),
    };
  } catch {
    return null;
  }
}
