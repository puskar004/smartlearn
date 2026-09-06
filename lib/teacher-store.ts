/**
 * Client helpers for classroom system.
 * Roles still cached in localStorage for instant UI; server (Clerk metadata) is source of truth for codes/joins.
 */

import type {
  Classroom,
  StudentSnapshot,
  TeacherMaterial,
} from "@/lib/classroom-types";

export type {
  Classroom,
  StudentSnapshot,
  TeacherMaterial,
  LiveSession,
} from "@/lib/classroom-types";

const ROLE_KEY = "sl_role_v1_";
const JOIN_KEY = "sl_joined_class_v1_";

export function getRole(userId: string): "student" | "teacher" {
  if (typeof window === "undefined") return "student";
  const r = localStorage.getItem(ROLE_KEY + userId);
  return r === "teacher" ? "teacher" : "student";
}

export function setRole(userId: string, role: "student" | "teacher") {
  localStorage.setItem(ROLE_KEY + userId, role);
  try {
    window.dispatchEvent(new Event("sl-role-changed"));
  } catch {
    // ignore
  }
  // fire-and-forget server sync
  void fetch("/api/classroom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "setRole", role }),
  }).catch(() => null);
}

export function getJoinedClass(userId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(JOIN_KEY + userId);
}

export function setJoinedClass(userId: string, code: string | null) {
  if (code) localStorage.setItem(JOIN_KEY + userId, code.toUpperCase());
  else localStorage.removeItem(JOIN_KEY + userId);
  try {
    window.dispatchEvent(new Event("sl-role-changed"));
  } catch {
    // ignore
  }
}

/** @deprecated use API create */
export function createClassroom(
  _teacherId: string,
  _teacherName: string,
  _name: string
): Classroom {
  throw new Error("Use apiCreateClassroom()");
}

export async function apiCreateClassroom(name: string): Promise<Classroom> {
  const res = await fetch("/api/classroom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", name }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Could not create class");
  }
  return data.classroom as Classroom;
}

export async function apiListMyClasses(): Promise<Classroom[]> {
  const res = await fetch("/api/classroom?action=mine");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load classes");
  return (data.classrooms || []) as Classroom[];
}

export async function apiGetRoom(code: string): Promise<Classroom | null> {
  const res = await fetch(
    `/api/classroom?action=room&code=${encodeURIComponent(code)}`
  );
  const data = await res.json();
  if (!res.ok) return null;
  return (data.classroom as Classroom) || null;
}

export async function apiJoinClassroom(
  code: string,
  snapshot: StudentSnapshot
): Promise<{ ok: boolean; error?: string; classroom?: Classroom }> {
  const res = await fetch("/api/classroom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "join", code, snapshot }),
  });
  const data = await res.json();
  return data;
}

export async function apiSyncStudent(
  code: string,
  snapshot: StudentSnapshot
) {
  return fetch("/api/classroom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sync", code, snapshot }),
  }).then((r) => r.json());
}

export async function apiAddMaterial(
  code: string,
  material: Omit<TeacherMaterial, "id" | "createdAt">
) {
  const res = await fetch("/api/classroom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addMaterial", code, material }),
  });
  return res.json();
}

export async function apiStartLive(
  code: string,
  title: string,
  subject: string,
  minutes: number,
  meetUrl?: string,
  scheduledAt?: number
) {
  const res = await fetch("/api/classroom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "startLive",
      code,
      title,
      subject,
      minutes,
      meetUrl,
      scheduledAt,
    }),
  });
  return res.json();
}

export async function apiEndLive(code: string) {
  const res = await fetch("/api/classroom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "endLive", code }),
  });
  return res.json();
}

export async function apiPostMessage(
  code: string,
  author: string,
  text: string
) {
  const res = await fetch("/api/classroom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "message", code, author, text }),
  });
  return res.json();
}

// legacy no-ops kept so old imports don't crash if any remain
export function getClassroom(_code: string): Classroom | null {
  return null;
}
export function listTeacherClasses(_teacherId: string): Classroom[] {
  return [];
}
export function joinClassroom(
  _code: string,
  _snapshot: StudentSnapshot
): { ok: boolean; error?: string; classroom?: Classroom } {
  return { ok: false, error: "Use apiJoinClassroom" };
}
export function pushStudentSnapshot(
  code: string,
  snapshot: StudentSnapshot
) {
  return apiSyncStudent(code, snapshot);
}
export function addMaterial(
  _code: string,
  _material: Omit<TeacherMaterial, "id" | "createdAt">
) {
  return null;
}
export function startLiveSession(
  _code: string,
  _title: string,
  _subject: string,
  _minutes: number
) {
  return null;
}
export function endLiveSession(_code: string) {
  return null;
}
export function postLiveMessage(
  _code: string,
  _author: string,
  _text: string
) {
  return null;
}
export function demoStudentsIfEmpty(room: Classroom): Classroom {
  return room;
}
