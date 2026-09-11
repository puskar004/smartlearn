/** Student-only material visibility: dismiss + 24h auto-hide */

import type { TeacherMaterial } from "@/lib/classroom-types";

export const STUDENT_MAT_TTL_MS = 24 * 60 * 60 * 1000;

function dismissKey(userId: string, code: string) {
  return `sl_dismissed_mats_${userId}_${code.toUpperCase()}`;
}

function matKey(m: TeacherMaterial) {
  return m.id || m.url || "";
}

export function readDismissedMats(userId: string, code: string): string[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(dismissKey(userId, code));
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function dismissMaterial(
  userId: string,
  code: string,
  m: TeacherMaterial
) {
  if (typeof window === "undefined" || !userId) return;
  const k = matKey(m);
  if (!k) return;
  const prev = readDismissedMats(userId, code);
  if (prev.includes(k)) return;
  try {
    localStorage.setItem(
      dismissKey(userId, code),
      JSON.stringify([k, ...prev].slice(0, 200))
    );
  } catch {
    // ignore
  }
}

export function isMaterialExpired(m: TeacherMaterial, now = Date.now()) {
  const created = Number(m.createdAt) || 0;
  if (!created) return false;
  const exp =
    m.expiresAt && m.expiresAt < created + STUDENT_MAT_TTL_MS
      ? m.expiresAt
      : created + STUDENT_MAT_TTL_MS;
  return exp < now;
}

/** Filter for student panel: hide dismissed + older than 24h */
export function filterStudentMaterials(
  userId: string | null | undefined,
  code: string,
  list: TeacherMaterial[]
): TeacherMaterial[] {
  const dismissed = userId ? new Set(readDismissedMats(userId, code)) : new Set();
  const now = Date.now();
  return (list || []).filter((m) => {
    if (!m?.url) return false;
    if (isMaterialExpired(m, now)) return false;
    const k = matKey(m);
    if (k && dismissed.has(k)) return false;
    return true;
  });
}

export function hoursLeft(m: TeacherMaterial, now = Date.now()) {
  const created = Number(m.createdAt) || now;
  const exp = created + STUDENT_MAT_TTL_MS;
  return Math.max(0, Math.ceil((exp - now) / 3_600_000));
}
