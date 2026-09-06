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

function lightMaterialBank(
  bank: Record<string, TeacherMaterial[]> | undefined
): Record<string, TeacherMaterial[]> {
  const out: Record<string, TeacherMaterial[]> = {};
  for (const [code, list] of Object.entries(bank || {})) {
    out[code] = (list || [])
      .filter((m) => m?.url)
      .map((m) => {
        const url = String(m.url);
        // Allow small data URLs (inline PDF); cap huge ones
        const safeUrl =
          url.startsWith("data:") && url.length > 280_000
            ? ""
            : url.startsWith("data:")
              ? url
              : url.slice(0, 500);
        return {
          ...m,
          url: safeUrl,
          title: String(m.title || "").slice(0, 120),
          subject: String(m.subject || "General").slice(0, 60),
          teacherName: String(m.teacherName || "").slice(0, 80),
          type: m.type || "notes",
          id: m.id || `mat-${Date.now()}`,
          createdAt: m.createdAt || Date.now(),
        };
      })
      .filter((m) => m.url)
      .slice(0, 20);
  }
  return out;
}

async function saveMeta(userId: string, smartlearn: SmartlearnMeta) {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const existing = metaOf(user);
  // NEVER wipe materialBank if caller omitted it
  const mergedBank = {
    ...(existing.materialBank || {}),
    ...(smartlearn.materialBank || {}),
  };
  const cleaned: SmartlearnMeta = {
    ...existing,
    ...smartlearn,
    classrooms: (smartlearn.classrooms ?? existing.classrooms ?? [])
      .slice(0, 20)
      .map(lightClassroom),
    materialBank: lightMaterialBank(mergedBank),
    teacherRemarks: (smartlearn.teacherRemarks ?? existing.teacherRemarks ?? []).slice(
      0,
      20
    ),
    joinedClassMap: {
      ...(existing.joinedClassMap || {}),
      ...(smartlearn.joinedClassMap || {}),
    },
    joinedClassCodes:
      smartlearn.joinedClassCodes ?? existing.joinedClassCodes,
    joinedClassCode:
      smartlearn.joinedClassCode !== undefined
        ? smartlearn.joinedClassCode
        : existing.joinedClassCode,
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
  const rooms = meta.classrooms || [];
  let fileBank: Record<string, TeacherMaterial[]> = {};
  try {
    const { getMaterialsForTeacher } = await import(
      "@/lib/materials-bank-store"
    );
    fileBank = await getMaterialsForTeacher(teacherId);
  } catch {
    // ignore
  }
  return rooms.map((r) => {
    const merged = materialsForRoom(meta, r.code, r);
    const extra = fileBank[r.code] || [];
    const map = new Map<string, TeacherMaterial>();
    for (const m of [...extra, ...merged]) {
      if (!m?.url) continue;
      map.set(m.id || m.url, m);
    }
    return {
      ...r,
      materials: Array.from(map.values()).sort(
        (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
      ),
    };
  });
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
    if (!found) {
      try {
        found = await findClassroomByCode(code);
      } catch {
        found = null;
      }
    }

    // Always show joined code even if teacher lookup is slow/fails
    if (!found) {
      out.push({
        code,
        name: `Class ${code}`,
        teacherName: "Teacher",
        materials: [],
        liveSession: null,
        alerts: [],
      });
      continue;
    }

    if (!tid) {
      try {
        const fresh = await getTeacherMeta(userId);
        await saveMeta(userId, {
          ...fresh,
          joinedClassMap: {
            ...(fresh.joinedClassMap || {}),
            [code]: found.teacherId,
          },
        });
      } catch {
        // ignore
      }
    }

    const sess = found.classroom.liveSession;
    const kicked = Boolean(
      sess?.active && (sess.kickedIds || []).includes(userId)
    );
    // Pull materials: file bank + clerk bank + classroom
    let materials: TeacherMaterial[] = [];
    try {
      const tMeta = await getTeacherMeta(found.teacherId);
      materials = materialsForRoom(tMeta, code, found.classroom);
      try {
        const { getMaterialsFromBank } = await import(
          "@/lib/materials-bank-store"
        );
        const fileMats = await getMaterialsFromBank(found.teacherId, code);
        const map = new Map<string, TeacherMaterial>();
        for (const m of [...fileMats, ...materials]) {
          if (!m?.url) continue;
          map.set(m.id || m.url, m);
        }
        materials = Array.from(map.values()).sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
        );
      } catch {
        // ignore file bank
      }
    } catch {
      materials = (found.classroom.materials || []).filter(
        (m) => m && m.url && String(m.url).trim().length > 0
      );
    }
    out.push({
      code: found.classroom.code,
      name: found.classroom.name || `Class ${code}`,
      teacherName: found.classroom.teacherName || "Teacher",
      materials,
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
  let url = String(material.url || "").trim();
  // Never put huge data-URLs into Clerk
  if (url.startsWith("data:") && url.length > 120_000) {
    throw new Error(
      "PDF too large to embed. Use a smaller file or a Google Drive link."
    );
  }
  if (!url) {
    throw new Error("Missing file URL.");
  }
  if (
    !url.startsWith("http://") &&
    !url.startsWith("https://") &&
    !url.startsWith("/api/") &&
    !url.startsWith("data:")
  ) {
    throw new Error("Material link must be https://, /api/…, or uploaded file.");
  }

  const normalized = code.trim().toUpperCase();
  const m: TeacherMaterial = {
    ...material,
    url: url.startsWith("data:") ? url : url.slice(0, 500),
    title: String(material.title || "Notes").slice(0, 120),
    subject: String(material.subject || "General").slice(0, 60),
    id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
  };

  // 1) Class-code file/remote bank first (students read this)
  try {
    const { addMaterialToBank } = await import("@/lib/materials-bank-store");
    await addMaterialToBank(
      teacherId,
      normalized,
      m,
      material.teacherName || "Teacher"
    );
  } catch (e) {
    console.error("materials-bank-store", e);
  }

  // 2) Tiny Clerk write: materialBank only for THIS code (no classrooms rewrite)
  const client = await clerkClient();
  const user = await client.users.getUser(teacherId);
  const meta = metaOf(user);
  const bank = { ...(meta.materialBank || {}) };
  const prev = bank[normalized] || [];
  bank[normalized] = [m, ...prev]
    .filter((x) => x?.url && !String(x.url).startsWith("data:"))
    .slice(0, 15);
  // If only data url available, still keep one short entry pointing to /api key if possible
  if (!bank[normalized].length && m.url) {
    bank[normalized] = [
      {
        ...m,
        url: m.url.startsWith("data:")
          ? m.url.slice(0, 100) // won't open — prefer file store
          : m.url,
      },
    ];
    // Prefer not storing data in clerk at all
    if (m.url.startsWith("data:")) {
      bank[normalized] = [
        {
          ...m,
          url: m.url, // small data only if short
        },
      ].filter((x) => x.url.length < 100_000);
    }
  }

  try {
    // Deep-merge safe: replace smartlearn but keep classrooms reference from meta WITHOUT reserializing students
    const slimBank = lightMaterialBank(bank);
    await client.users.updateUserMetadata(teacherId, {
      publicMetadata: {
        ...user.publicMetadata,
        smartlearn: {
          role: meta.role || "teacher",
          activeClassCode: meta.activeClassCode || normalized,
          materialBank: slimBank,
          // keep classrooms as already stored — do not re-send fat payload
          classrooms: meta.classrooms || [],
          teacherRemarks: meta.teacherRemarks || [],
        },
      },
    });
  } catch (e) {
    console.error("clerk materialBank save", e);
    // File bank already has it — continue
  }

  // Build response room for teacher UI
  const rooms = meta.classrooms || [];
  const existing = rooms.find((c) => c.code === normalized);
  const fileMats = await (async () => {
    try {
      const { getMaterialsFromBank } = await import("@/lib/materials-bank-store");
      return await getMaterialsFromBank(teacherId, normalized);
    } catch {
      return [] as TeacherMaterial[];
    }
  })();
  const materials = [
    m,
    ...fileMats.filter((x) => x.id !== m.id),
    ...((existing?.materials || []) as TeacherMaterial[]),
  ]
    .filter((x, i, arr) => arr.findIndex((y) => y.id === x.id || y.url === x.url) === i)
    .slice(0, 40);

  return {
    code: normalized,
    name: existing?.name || normalized,
    teacherId,
    teacherName: existing?.teacherName || material.teacherName || "Teacher",
    createdAt: existing?.createdAt || Date.now(),
    students: existing?.students || [],
    materials,
    liveSession: existing?.liveSession || null,
    alerts: existing?.alerts || [],
    attendanceLog: existing?.attendanceLog || [],
  } as Classroom;
}

/** Materials for a class: bank first, then classroom.materials */
export function materialsForRoom(
  meta: SmartlearnMeta,
  code: string,
  room?: Classroom | null
): TeacherMaterial[] {
  const c = code.toUpperCase();
  const fromBank = meta.materialBank?.[c] || [];
  const fromRoom = room?.materials || [];
  const map = new Map<string, TeacherMaterial>();
  for (const m of [...fromBank, ...fromRoom]) {
    if (!m?.id && !m?.url) continue;
    const key = m.id || m.url;
    if (!map.has(key) && m.url) map.set(key, m);
  }
  return Array.from(map.values()).sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
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
