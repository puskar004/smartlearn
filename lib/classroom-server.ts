import { clerkClient } from "@clerk/nextjs/server";
import type {
  AttendanceAttendee,
  AttendanceRecord,
  ClassAlert,
  Classroom,
  LiveSession,
  SmartlearnMeta,
  StudentSnapshot,
  TeacherMaterial,
} from "@/lib/classroom-types";
// TeacherRemark used via inline object shape in pushTeacherRemark

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

function pushAlert(
  c: Classroom,
  alert: Omit<ClassAlert, "id" | "at"> & { at?: number }
): ClassAlert[] {
  const next: ClassAlert = {
    id: `al-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: alert.at || Date.now(),
    kind: alert.kind,
    title: alert.title,
    body: alert.body,
    href: alert.href,
  };
  return [next, ...(c.alerts || [])].slice(0, 40);
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
    alerts: [],
    attendanceLog: [],
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

export async function renameClassroom(
  teacherId: string,
  code: string,
  name: string
): Promise<Classroom | null> {
  const clean = name.trim().slice(0, 80);
  if (!clean) return null;
  return updateClassroom(teacherId, code, (c) => ({ ...c, name: clean }));
}

export async function deleteClassroom(
  teacherId: string,
  code: string
): Promise<{ ok: true; classrooms: Classroom[] } | { ok: false; error: string }> {
  const client = await clerkClient();
  const user = await client.users.getUser(teacherId);
  const meta = metaOf(user);
  const rooms = meta.classrooms || [];
  const normalized = code.toUpperCase();
  const room = rooms.find((c) => c.code === normalized);
  if (!room) return { ok: false, error: "Class not found" };

  const classrooms = rooms.filter((c) => c.code !== normalized);
  const activeClassCode =
    meta.activeClassCode === normalized
      ? classrooms[0]?.code || null
      : meta.activeClassCode;

  await saveMeta(teacherId, {
    ...meta,
    role: "teacher",
    classrooms,
    activeClassCode,
  });

  for (const s of room.students || []) {
    try {
      const st = await client.users.getUser(s.studentId);
      const sm = metaOf(st);
      const next = codesOf(sm).filter((c) => c !== normalized);
      if (
        sm.joinedClassCode === normalized ||
        (sm.joinedClassCodes || []).includes(normalized)
      ) {
        await saveMeta(s.studentId, {
          ...sm,
          joinedClassCode: next[0] || null,
          joinedClassCodes: next,
        });
      }
    } catch {
      // non-fatal
    }
  }

  return { ok: true, classrooms };
}

function codesOf(sm: SmartlearnMeta): string[] {
  const set = new Set<string>();
  for (const c of sm.joinedClassCodes || []) {
    if (c) set.add(c.toUpperCase());
  }
  if (sm.joinedClassCode) set.add(sm.joinedClassCode.toUpperCase());
  return [...set];
}

export async function leaveClassroomAsStudent(
  userId: string,
  code?: string
): Promise<{ ok: true; codes: string[] } | { ok: false; error: string }> {
  const client = await clerkClient();
  const student = await client.users.getUser(userId);
  const sm = metaOf(student);
  const current = codesOf(sm);
  const target = (code || sm.joinedClassCode || current[0] || "")
    .trim()
    .toUpperCase();

  if (!target) {
    await saveMeta(userId, {
      ...sm,
      joinedClassCode: null,
      joinedClassCodes: [],
    });
    return { ok: true, codes: [] };
  }

  const found = await findClassroomByCode(target);
  if (found) {
    await updateClassroom(found.teacherId, found.classroom.code, (c) => ({
      ...c,
      students: (c.students || []).filter((s) => s.studentId !== userId),
    }));
  }

  const next = current.filter((c) => c !== target);
  await saveMeta(userId, {
    ...sm,
    joinedClassCode: next[0] || null,
    joinedClassCodes: next,
  });
  return { ok: true, codes: next };
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

  try {
    const client = await clerkClient();
    const student = await client.users.getUser(snapshot.studentId);
    const sm = metaOf(student);
    const codes = codesOf(sm);
    if (!codes.includes(updated.code)) codes.unshift(updated.code);
    await saveMeta(snapshot.studentId, {
      ...sm,
      role: sm.role === "teacher" ? "teacher" : "student",
      joinedClassCode: updated.code,
      joinedClassCodes: codes.slice(0, 12),
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
    const alerts = pushAlert(c, {
      kind: "material",
      title: `New ${m.subject} notes`,
      body: `${m.title} · ${m.subject} · ${m.type}`,
      href: "/join-class",
    });
    return {
      ...c,
      materials: [m, ...(c.materials || [])].slice(0, 100),
      alerts,
    };
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
    const isScheduled = !!(scheduledAt && scheduledAt > now);
    const live: LiveSession = {
      id: `live-${now}`,
      title,
      subject,
      startedAt: start,
      endsAt: start + minutes * 60_000,
      active: !isScheduled,
      joinCode: makeCode(4),
      meetUrl: meetUrl?.trim() || undefined,
      scheduledAt: isScheduled ? scheduledAt : undefined,
      messages: c.liveSession?.messages || [],
      attendees: [],
    };
    const alerts = pushAlert(c, {
      kind: isScheduled ? "schedule" : "live",
      title: isScheduled ? "Live class scheduled" : "Live class started",
      body: `${title} · ${subject}${isScheduled ? ` · ${new Date(start).toLocaleString()}` : ""}`,
      href: "/live-class",
    });
    let attendanceLog = c.attendanceLog || [];
    if (!isScheduled) {
      const rec: AttendanceRecord = {
        id: `att-${live.id}`,
        sessionId: live.id,
        sessionTitle: title,
        subject,
        startedAt: start,
        attendees: [],
      };
      attendanceLog = [rec, ...attendanceLog].slice(0, 80);
    }
    return { ...c, liveSession: live, alerts, attendanceLog };
  });
}

export async function endLive(teacherId: string, code: string) {
  return updateClassroom(teacherId, code, (c) => {
    if (!c.liveSession) return c;
    const sess = c.liveSession;
    const now = Date.now();
    const stampLeft = (list: AttendanceAttendee[]) =>
      list.map((a) => (a.leftAt ? a : { ...a, leftAt: now }));
    const attendees = stampLeft(sess.attendees || []);
    const attendanceLog = (c.attendanceLog || []).map((r) => {
      if (r.sessionId === sess.id && !r.endedAt) {
        return {
          ...r,
          endedAt: now,
          attendees: stampLeft(
            attendees.length ? attendees : r.attendees || []
          ),
        };
      }
      return r;
    });
    return {
      ...c,
      liveSession: { ...sess, active: false, attendees },
      attendanceLog,
    };
  });
}

export async function markAttendance(
  code: string,
  studentId: string,
  name: string
): Promise<Classroom | null> {
  const found = await findClassroomByCode(code);
  if (!found) return null;
  return updateClassroom(found.teacherId, found.classroom.code, (c) => {
    const sess = c.liveSession;
    if (!sess?.active) return c;
    const existing = sess.attendees || [];
    const already = existing.find(
      (a) => a.studentId === studentId && !a.leftAt
    );
    if (already) return c;
    const attendee: AttendanceAttendee = {
      studentId,
      name: name || "Student",
      joinedAt: Date.now(),
    };
    // allow re-join after leave as new segment
    const attendees = [attendee, ...existing].slice(0, 120);
    const attendanceLog = (c.attendanceLog || []).map((r) => {
      if (r.sessionId !== sess.id) return r;
      const open = r.attendees.find(
        (a) => a.studentId === studentId && !a.leftAt
      );
      if (open) return r;
      return { ...r, attendees: [attendee, ...r.attendees].slice(0, 120) };
    });
    const hasLog = attendanceLog.some((r) => r.sessionId === sess.id);
    const nextLog = hasLog
      ? attendanceLog
      : [
          {
            id: `att-${sess.id}`,
            sessionId: sess.id,
            sessionTitle: sess.title,
            subject: sess.subject,
            startedAt: sess.startedAt,
            attendees,
          } as AttendanceRecord,
          ...attendanceLog,
        ].slice(0, 80);
    return {
      ...c,
      liveSession: { ...sess, attendees },
      attendanceLog: nextLog,
    };
  });
}

export async function kickFromLive(
  teacherId: string,
  code: string,
  studentId: string
): Promise<Classroom | null> {
  return updateClassroom(teacherId, code, (c) => {
    const sess = c.liveSession;
    if (!sess?.active) return c;
    const now = Date.now();
    const stamp = (list: AttendanceAttendee[]) =>
      list.map((a) =>
        a.studentId === studentId && !a.leftAt
          ? { ...a, leftAt: now }
          : a
      );
    return {
      ...c,
      liveSession: {
        ...sess,
        attendees: stamp(sess.attendees || []),
        messages: [
          ...(sess.messages || []),
          {
            id: `m-kick-${now}`,
            author: "System",
            text: `Student removed from live attendance (${studentId.slice(0, 8)}…)`,
            at: now,
          },
        ].slice(-100),
      },
      attendanceLog: (c.attendanceLog || []).map((r) =>
        r.sessionId === sess.id
          ? { ...r, attendees: stamp(r.attendees || []) }
          : r
      ),
      alerts: pushAlert(c, {
        kind: "remark",
        title: "Removed from live class",
        body: "Teacher applied a penalty / kick from the session.",
        href: "/remarks",
      }),
    };
  });
}

export async function leaveAttendance(
  code: string,
  studentId: string
): Promise<Classroom | null> {
  const found = await findClassroomByCode(code);
  if (!found) return null;
  const now = Date.now();
  return updateClassroom(found.teacherId, found.classroom.code, (c) => {
    const sess = c.liveSession;
    if (!sess) return c;
    const stamp = (list: AttendanceAttendee[]) =>
      list.map((a) =>
        a.studentId === studentId && !a.leftAt ? { ...a, leftAt: now } : a
      );
    const attendees = stamp(sess.attendees || []);
    const attendanceLog = (c.attendanceLog || []).map((r) => {
      if (r.sessionId !== sess.id) return r;
      return { ...r, attendees: stamp(r.attendees || []) };
    });
    return {
      ...c,
      liveSession: { ...sess, attendees },
      attendanceLog,
    };
  });
}

export async function pushTeacherRemark(
  teacherId: string,
  teacherName: string,
  studentId: string,
  text: string,
  classCode?: string,
  className?: string
) {
  const clean = text.trim().slice(0, 800);
  if (!clean) throw new Error("Empty feedback");
  const client = await clerkClient();
  const student = await client.users.getUser(studentId);
  const sm = metaOf(student);
  const remark = {
    id: `rm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: clean,
    from: teacherName || "Teacher",
    teacherId,
    classCode,
    className,
    at: Date.now(),
    read: false,
  };
  const teacherRemarks = [remark, ...(sm.teacherRemarks || [])].slice(0, 40);
  await saveMeta(studentId, { ...sm, teacherRemarks });

  // also class alert for StudentSync
  if (classCode) {
    await updateClassroom(teacherId, classCode, (c) => ({
      ...c,
      alerts: pushAlert(c, {
        kind: "remark",
        title: "New teacher remark",
        body: clean.slice(0, 120),
        href: "/remarks",
      }),
    }));
  }
  return remark;
}

export async function getStudentRemarks(userId: string) {
  const meta = await getTeacherMeta(userId);
  return meta.teacherRemarks || [];
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
  return meta.joinedClassCode || codesOf(meta)[0] || null;
}

export async function getStudentJoinedCodes(userId: string): Promise<string[]> {
  const meta = await getTeacherMeta(userId);
  return codesOf(meta);
}
