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

/** Keep Clerk metadata small — no data: URLs, trim fat fields */
function lightClassroom(c: Classroom): Classroom {
  return {
    ...c,
    materials: (c.materials || [])
      .filter((m) => m.url && !m.url.startsWith("data:"))
      .map((m) => ({
        ...m,
        url: String(m.url).slice(0, 500),
        title: String(m.title || "").slice(0, 120),
        subject: String(m.subject || "").slice(0, 60),
      }))
      .slice(0, 40),
    alerts: (c.alerts || []).slice(0, 12),
    attendanceLog: (c.attendanceLog || []).slice(0, 20).map((r) => ({
      ...r,
      attendees: (r.attendees || []).slice(0, 40),
    })),
    students: (c.students || []).slice(0, 80).map((s) => ({
      ...s,
      recentMistakes: (s.recentMistakes || []).slice(0, 3),
      weakSubjects: (s.weakSubjects || []).slice(0, 5),
      email: s.email ? String(s.email).slice(0, 80) : undefined,
    })),
    liveSession: c.liveSession
      ? {
          ...c.liveSession,
          messages: (c.liveSession.messages || []).slice(-40),
          attendees: (c.liveSession.attendees || []).slice(0, 80),
          meetUrl: c.liveSession.meetUrl
            ? String(c.liveSession.meetUrl).slice(0, 300)
            : undefined,
        }
      : null,
  };
}

async function saveMeta(userId: string, smartlearn: SmartlearnMeta) {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const cleaned: SmartlearnMeta = {
    ...smartlearn,
    classrooms: (smartlearn.classrooms || [])
      .slice(0, 20)
      .map(lightClassroom),
    teacherRemarks: (smartlearn.teacherRemarks || []).slice(0, 20),
  };
  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...user.publicMetadata,
      smartlearn: cleaned,
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

/** Fast path: load room by known teacher id (no user-list scan) */
export async function getClassroomByTeacher(
  teacherId: string,
  code: string
): Promise<{ teacherId: string; classroom: Classroom } | null> {
  try {
    const room = await getClassroomForTeacher(teacherId, code);
    if (!room) return null;
    return { teacherId, classroom: { ...room, teacherId } };
  } catch {
    return null;
  }
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

  const map = { ...(sm.joinedClassMap || {}) };

  if (!target) {
    await saveMeta(userId, {
      ...sm,
      joinedClassCode: null,
      joinedClassCodes: [],
      joinedClassMap: {},
    });
    return { ok: true, codes: [] };
  }

  const teacherIdHint = map[target];
  let found = teacherIdHint
    ? await getClassroomByTeacher(teacherIdHint, target)
    : null;
  if (!found) found = await findClassroomByCode(target);
  if (found) {
    await updateClassroom(found.teacherId, found.classroom.code, (c) => ({
      ...c,
      students: (c.students || []).filter((s) => s.studentId !== userId),
    }));
  }

  const next = current.filter((c) => c !== target);
  delete map[target];
  await saveMeta(userId, {
    ...sm,
    joinedClassCode: next[0] || null,
    joinedClassCodes: next,
    joinedClassMap: map,
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
    const map = { ...(sm.joinedClassMap || {}) };
    map[updated.code] = found.teacherId;
    await saveMeta(snapshot.studentId, {
      ...sm,
      role: sm.role === "teacher" ? "teacher" : "student",
      joinedClassCode: updated.code,
      joinedClassCodes: codes.slice(0, 12),
      joinedClassMap: map,
    });
  } catch {
    // non-fatal
  }

  return { ok: true, classroom: updated };
}

/** Load all classrooms a student joined — uses teacherId map when possible */
export async function listStudentClassrooms(userId: string): Promise<
  {
    code: string;
    name: string;
    teacherName: string;
    materials: TeacherMaterial[];
    liveSession: Classroom["liveSession"];
    alerts: ClassAlert[];
    kicked?: boolean;
    kickReason?: string;
  }[]
> {
  const meta = await getTeacherMeta(userId);
  const codes = codesOf(meta);
  const map = meta.joinedClassMap || {};
  const out: {
    code: string;
    name: string;
    teacherName: string;
    materials: TeacherMaterial[];
    liveSession: Classroom["liveSession"];
    alerts: ClassAlert[];
    kicked?: boolean;
    kickReason?: string;
  }[] = [];

  for (const code of codes) {
    let found: { teacherId: string; classroom: Classroom } | null = null;
    const tid = map[code];
    if (tid) found = await getClassroomByTeacher(tid, code);
    if (!found) found = await findClassroomByCode(code);
    if (!found) continue;

    // backfill map if missing
    if (!tid) {
      try {
        await saveMeta(userId, {
          ...meta,
          joinedClassMap: { ...map, [code]: found.teacherId },
        });
      } catch {
        // ignore
      }
    }

    const sess = found.classroom.liveSession;
    const kicked = Boolean(
      sess?.active && (sess.kickedIds || []).includes(userId)
    );
    out.push({
      code: found.classroom.code,
      name: found.classroom.name,
      teacherName: found.classroom.teacherName,
      materials: (found.classroom.materials || []).filter(
        (m) => m.url && !String(m.url).startsWith("data:")
      ),
      liveSession: sess
        ? {
            ...sess,
            kickedIds: undefined,
            kickReasons: undefined,
            meetUrl: kicked ? undefined : sess.meetUrl,
          }
        : null,
      alerts: found.classroom.alerts || [],
      kicked,
      kickReason:
        kicked && userId
          ? sess?.kickReasons?.[userId] || "Removed by teacher"
          : undefined,
    });
  }
  return out;
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
  const url = String(material.url || "").trim();
  if (!url || url.startsWith("data:")) {
    throw new Error(
      "Invalid file URL. Use Publish after selecting PDF, or paste a Drive https link."
    );
  }
  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/api/")) {
    throw new Error("Material link must be https:// or uploaded file URL.");
  }
  return updateClassroom(teacherId, code, (c) => {
    const m: TeacherMaterial = {
      ...material,
      url: url.slice(0, 500),
      title: String(material.title || "Notes").slice(0, 120),
      subject: String(material.subject || "General").slice(0, 60),
      id: `mat-${Date.now()}`,
      createdAt: Date.now(),
    };
    const alerts = pushAlert(c, {
      kind: "material",
      title: `New ${m.subject} notes`,
      body: `${m.title} · ${m.subject}`,
      href: "/join-class",
    });
    return {
      ...c,
      materials: [m, ...(c.materials || [])].slice(0, 40),
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
    // Kicked students cannot rejoin this live session
    if ((sess.kickedIds || []).includes(studentId)) {
      return c;
    }
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
  studentId: string,
  reason?: string
): Promise<Classroom | null> {
  const room = await updateClassroom(teacherId, code, (c) => {
    const sess = c.liveSession;
    if (!sess?.active) return c;
    const now = Date.now();
    const why = (reason || "Removed by teacher").slice(0, 200);
    const stamp = (list: AttendanceAttendee[]) => {
      const has = list.some((a) => a.studentId === studentId);
      if (!has) {
        return [
          {
            studentId,
            name: "Student",
            joinedAt: now,
            leftAt: now,
          },
          ...list,
        ].slice(0, 120);
      }
      return list.map((a) =>
        a.studentId === studentId && !a.leftAt ? { ...a, leftAt: now } : a
      );
    };
    const kickedIds = Array.from(
      new Set([...(sess.kickedIds || []), studentId])
    ).slice(0, 80);
    const kickReasons = {
      ...(sess.kickReasons || {}),
      [studentId]: why,
    };
    const studentName =
      (c.students || []).find((s) => s.studentId === studentId)?.name ||
      (sess.attendees || []).find((a) => a.studentId === studentId)?.name ||
      "Student";
    return {
      ...c,
      liveSession: {
        ...sess,
        kickedIds,
        kickReasons,
        attendees: stamp(sess.attendees || []),
        messages: [
          ...(sess.messages || []),
          {
            id: `m-kick-${now}`,
            author: "System",
            text: `${studentName} was kicked from live class: ${why}`,
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
        title: "Kicked from live class",
        body: why,
        href: "/live-class",
      }),
    };
  });

  // Also push remark to student account so they see it on Remarks
  if (room) {
    try {
      const teacherName = room.teacherName || "Teacher";
      await pushTeacherRemark(
        teacherId,
        teacherName,
        studentId,
        `⚠️ KICKED from live class: ${reason || "Removed by teacher"}`,
        code,
        room.name
      );
    } catch {
      // non-fatal
    }
  }
  return room;
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
