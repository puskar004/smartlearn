import { clerkClient } from "@clerk/nextjs/server";
import type {
  Classroom,
  SmartlearnMeta,
  StudentSnapshot,
  TeacherMaterial,
  LiveSession,
} from "@/lib/classroom-types";

function metaOf(user: { publicMetadata?: Record<string, unknown> | null }): SmartlearnMeta {
  const m = (user.publicMetadata || {}) as Record<string, unknown>;
  return (m.smartlearn as SmartlearnMeta) || {};
}

async function saveMeta(userId: string, smartlearn: SmartlearnMeta) {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...user.publicMetadata,
      smartlearn,
    },
  });
}

function makeCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

/** Scan teachers for a class code (works across devices). */
export async function findClassroomByCode(
  code: string
): Promise<{ teacherId: string; classroom: Classroom } | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const client = await clerkClient();
  let offset = 0;
  const limit = 100;

  // Paginate users — fine for school-scale apps
  for (let page = 0; page < 20; page++) {
    const res = await client.users.getUserList({ limit, offset });
    for (const u of res.data) {
      const meta = metaOf(u);
      if (meta.role !== "teacher") continue;
      const rooms = meta.classrooms || [];
      const room = rooms.find((c) => c.code === normalized);
      if (room) {
        return {
          teacherId: u.id,
          classroom: { ...room, teacherId: u.id },
        };
      }
    }
    offset += limit;
    if (offset >= (res.totalCount || 0)) break;
    if (res.data.length === 0) break;
  }
  return null;
}

export async function getTeacherMeta(userId: string): Promise<SmartlearnMeta> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return metaOf(user);
}

export async function setUserRole(
  userId: string,
  role: "student" | "teacher"
) {
  const meta = await getTeacherMeta(userId);
  await saveMeta(userId, { ...meta, role });
  return role;
}

export async function createClassroomForTeacher(
  teacherId: string,
  teacherName: string,
  name: string
): Promise<Classroom> {
  const client = await clerkClient();
  const user = await client.users.getUser(teacherId);
  const meta = metaOf(user);
  const existing = meta.classrooms || [];

  let code = makeCode(6);
  // ensure unique globally
  for (let i = 0; i < 12; i++) {
    const hit = await findClassroomByCode(code);
    if (!hit) break;
    code = makeCode(6);
  }

  const room: Classroom = {
    code,
    name: name || "My Class",
    teacherId,
    teacherName: teacherName || "Teacher",
    createdAt: Date.now(),
    students: [],
    materials: [],
    liveSession: null,
  };

  const classrooms = [room, ...existing].slice(0, 20);
  await saveMeta(teacherId, {
    ...meta,
    role: "teacher",
    classrooms,
    activeClassCode: code,
  });

  return room;
}

export async function listTeacherClassrooms(
  teacherId: string
): Promise<Classroom[]> {
  const meta = await getTeacherMeta(teacherId);
  return meta.classrooms || [];
}

export async function getClassroomForTeacher(
  teacherId: string,
  code: string
): Promise<Classroom | null> {
  const rooms = await listTeacherClassrooms(teacherId);
  return rooms.find((c) => c.code === code.toUpperCase()) || null;
}

async function updateClassroom(
  teacherId: string,
  code: string,
  updater: (c: Classroom) => Classroom
): Promise<Classroom | null> {
  const client = await clerkClient();
  const user = await client.users.getUser(teacherId);
  const meta = metaOf(user);
  const rooms = meta.classrooms || [];
  const idx = rooms.findIndex((c) => c.code === code.toUpperCase());
  if (idx < 0) return null;
  const next = updater({ ...rooms[idx] });
  const classrooms = [...rooms];
  classrooms[idx] = next;
  await saveMeta(teacherId, { ...meta, role: "teacher", classrooms });
  return next;
}

export async function joinClassroomAsStudent(
  code: string,
  snapshot: StudentSnapshot
): Promise<{ ok: true; classroom: Classroom } | { ok: false; error: string }> {
  const found = await findClassroomByCode(code);
  if (!found) {
    return {
      ok: false,
      error:
        "Invalid class code. Ask your teacher to open Teacher Hub → Class code and share the latest code.",
    };
  }

  const updated = await updateClassroom(
    found.teacherId,
    found.classroom.code,
    (c) => {
      const others = (c.students || []).filter(
        (s) => s.studentId !== snapshot.studentId
      );
      return {
        ...c,
        students: [snapshot, ...others].slice(0, 100),
      };
    }
  );

  if (!updated) return { ok: false, error: "Could not update classroom" };

  // mark student joined code on their metadata
  try {
    const client = await clerkClient();
    const student = await client.users.getUser(snapshot.studentId);
    const sm = metaOf(student);
    await saveMeta(snapshot.studentId, {
      ...sm,
      role: sm.role === "teacher" ? "teacher" : "student",
      joinedClassCode: updated.code,
    });
  } catch {
    // non-fatal
  }

  return { ok: true, classroom: updated };
}

export async function pushStudentToClass(
  code: string,
  snapshot: StudentSnapshot
) {
  return joinClassroomAsStudent(code, snapshot);
}

export async function addMaterialToClass(
  teacherId: string,
  code: string,
  material: Omit<TeacherMaterial, "id" | "createdAt">
) {
  return updateClassroom(teacherId, code, (c) => {
    const m: TeacherMaterial = {
      ...material,
      id: `mat-${Date.now()}`,
      createdAt: Date.now(),
    };
    return { ...c, materials: [m, ...(c.materials || [])].slice(0, 100) };
  });
}

export async function startLive(
  teacherId: string,
  code: string,
  title: string,
  subject: string,
  minutes: number,
  meetUrl?: string,
  scheduledAt?: number
) {
  return updateClassroom(teacherId, code, (c) => {
    const now = Date.now();
    const start = scheduledAt && scheduledAt > now ? scheduledAt : now;
    const live: LiveSession = {
      id: `live-${now}`,
      title,
      subject,
      startedAt: start,
      endsAt: start + minutes * 60_000,
      active: !scheduledAt || scheduledAt <= now,
      joinCode: makeCode(4),
      meetUrl: meetUrl?.trim() || undefined,
      scheduledAt: scheduledAt && scheduledAt > now ? scheduledAt : undefined,
      messages: c.liveSession?.messages || [],
    };
    return { ...c, liveSession: live };
  });
}

export async function endLive(teacherId: string, code: string) {
  return updateClassroom(teacherId, code, (c) => {
    if (!c.liveSession) return c;
    return {
      ...c,
      liveSession: { ...c.liveSession, active: false },
    };
  });
}

export async function postMessage(
  teacherId: string,
  code: string,
  author: string,
  text: string
) {
  return updateClassroom(teacherId, code, (c) => {
    if (!c.liveSession?.active) return c;
    return {
      ...c,
      liveSession: {
        ...c.liveSession,
        messages: [
          ...(c.liveSession.messages || []),
          { id: `m-${Date.now()}`, author, text, at: Date.now() },
        ].slice(-100),
      },
    };
  });
}

export async function getStudentJoinedCode(
  userId: string
): Promise<string | null> {
  const meta = await getTeacherMeta(userId);
  return meta.joinedClassCode || null;
}
