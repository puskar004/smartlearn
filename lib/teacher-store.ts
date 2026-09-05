/**
 * Teacher classroom store (local-first).
 * Students join with a class code; snapshots sync on this device.
 * Multi-device production would swap this for a real DB.
 */

export type StudentSnapshot = {
  studentId: string;
  name: string;
  email?: string;
  grade: string;
  xp: number;
  streak: number;
  accuracy: number | null;
  mistakes: number;
  weakSubjects: string[];
  chaptersOpened: number;
  lastActive: number;
  recentMistakes: {
    subjectName: string;
    chapterTitle: string;
    prompt: string;
    at: number;
  }[];
};

export type TeacherMaterial = {
  id: string;
  title: string;
  type: "notes" | "video" | "link";
  url: string;
  subject: string;
  createdAt: number;
  teacherName: string;
};

export type LiveSession = {
  id: string;
  title: string;
  subject: string;
  startedAt: number;
  endsAt: number;
  active: boolean;
  joinCode: string;
  messages: { id: string; author: string; text: string; at: number }[];
};

export type Classroom = {
  code: string;
  name: string;
  teacherId: string;
  teacherName: string;
  createdAt: number;
  students: StudentSnapshot[];
  materials: TeacherMaterial[];
  liveSession: LiveSession | null;
};

const CLASS_KEY = "sl_classrooms_v1";
const ROLE_KEY = "sl_role_v1_";
const JOIN_KEY = "sl_joined_class_v1_";

function loadAll(): Record<string, Classroom> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CLASS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveAll(map: Record<string, Classroom>) {
  localStorage.setItem(CLASS_KEY, JSON.stringify(map));
}

export function getRole(userId: string): "student" | "teacher" {
  if (typeof window === "undefined") return "student";
  const r = localStorage.getItem(ROLE_KEY + userId);
  return r === "teacher" ? "teacher" : "student";
}

export function setRole(userId: string, role: "student" | "teacher") {
  localStorage.setItem(ROLE_KEY + userId, role);
  try {
    // dynamic import avoid circular — call via window event from callers
    window.dispatchEvent(new Event("sl-role-changed"));
  } catch {
    // ignore
  }
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

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function createClassroom(
  teacherId: string,
  teacherName: string,
  name: string
): Classroom {
  const map = loadAll();
  let code = makeCode();
  while (map[code]) code = makeCode();
  const room: Classroom = {
    code,
    name: name || "My Class",
    teacherId,
    teacherName,
    createdAt: Date.now(),
    students: [],
    materials: [],
    liveSession: null,
  };
  map[code] = room;
  saveAll(map);
  return room;
}

export function getClassroom(code: string): Classroom | null {
  const map = loadAll();
  return map[code.toUpperCase()] || null;
}

export function listTeacherClasses(teacherId: string): Classroom[] {
  return Object.values(loadAll()).filter((c) => c.teacherId === teacherId);
}

export function joinClassroom(
  code: string,
  snapshot: StudentSnapshot
): { ok: boolean; error?: string; classroom?: Classroom } {
  const map = loadAll();
  const c = map[code.toUpperCase()];
  if (!c) return { ok: false, error: "Invalid class code" };
  const others = c.students.filter((s) => s.studentId !== snapshot.studentId);
  c.students = [snapshot, ...others].slice(0, 80);
  map[c.code] = c;
  saveAll(map);
  return { ok: true, classroom: c };
}

export function pushStudentSnapshot(code: string, snapshot: StudentSnapshot) {
  return joinClassroom(code, snapshot);
}

export function addMaterial(
  code: string,
  material: Omit<TeacherMaterial, "id" | "createdAt">
) {
  const map = loadAll();
  const c = map[code.toUpperCase()];
  if (!c) return null;
  const m: TeacherMaterial = {
    ...material,
    id: `mat-${Date.now()}`,
    createdAt: Date.now(),
  };
  c.materials = [m, ...c.materials].slice(0, 100);
  map[c.code] = c;
  saveAll(map);
  return c;
}

export function startLiveSession(
  code: string,
  title: string,
  subject: string,
  minutes: number
) {
  const map = loadAll();
  const c = map[code.toUpperCase()];
  if (!c) return null;
  const joinCode = makeCode().slice(0, 4);
  c.liveSession = {
    id: `live-${Date.now()}`,
    title,
    subject,
    startedAt: Date.now(),
    endsAt: Date.now() + minutes * 60_000,
    active: true,
    joinCode,
    messages: [],
  };
  map[c.code] = c;
  saveAll(map);
  return c;
}

export function endLiveSession(code: string) {
  const map = loadAll();
  const c = map[code.toUpperCase()];
  if (!c?.liveSession) return null;
  c.liveSession.active = false;
  map[c.code] = c;
  saveAll(map);
  return c;
}

export function postLiveMessage(
  code: string,
  author: string,
  text: string
) {
  const map = loadAll();
  const c = map[code.toUpperCase()];
  if (!c?.liveSession?.active) return null;
  c.liveSession.messages = [
    ...c.liveSession.messages,
    {
      id: `m-${Date.now()}`,
      author,
      text,
      at: Date.now(),
    },
  ].slice(-100);
  map[c.code] = c;
  saveAll(map);
  return c;
}

/** No sample students — only real joins via teacher private code. */
export function demoStudentsIfEmpty(room: Classroom): Classroom {
  return room;
}
