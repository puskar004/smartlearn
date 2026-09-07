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
import {
  getCachedMeta,
  getCachedPublicMeta,
  isRateLimitError,
  markClerkWrite,
  peekMeta,
  setCachedMeta,
  shouldSkipClerkWrite,
} from "@/lib/clerk-meta-cache";
// TeacherRemark used via inline object shape in pushTeacherRemark

function metaOf(user: { publicMetadata?: Record<string, unknown> | null }): SmartlearnMeta {
  const m = (user.publicMetadata || {}) as Record<string, unknown>;
  return (m.smartlearn as SmartlearnMeta) || {};
}

/** Keep Clerk metadata small — never throw on bad data */
function lightClassroom(c: Classroom): Classroom {
  try {
    const mats = Array.isArray(c?.materials) ? c.materials : [];
    const students = Array.isArray(c?.students) ? c.students : [];
    const alerts = Array.isArray(c?.alerts) ? c.alerts : [];
    const attendanceLog = Array.isArray(c?.attendanceLog) ? c.attendanceLog : [];
    const sess = c?.liveSession;
    return {
      code: String(c?.code || "").toUpperCase(),
      name: String(c?.name || c?.code || "Class").slice(0, 80),
      teacherId: String(c?.teacherId || ""),
      teacherName: String(c?.teacherName || "Teacher").slice(0, 80),
      createdAt: Number(c?.createdAt) || Date.now(),
      materials: mats
        .filter((m) => m && m.url && !String(m.url).startsWith("data:"))
        .map((m) => ({
          id: String(m.id || `mat-${Date.now()}`),
          title: String(m.title || "Notes").slice(0, 120),
          type: (m.type === "video" || m.type === "link"
            ? m.type
            : "notes") as "notes" | "video" | "link",
          url: String(m.url).slice(0, 500),
          subject: String(m.subject || "General").slice(0, 60),
          createdAt: Number(m.createdAt) || Date.now(),
          teacherName: String(m.teacherName || "").slice(0, 80),
        }))
        .slice(0, 20),
      alerts: alerts.slice(0, 10),
      attendanceLog: attendanceLog.slice(0, 10).map((r) => ({
        ...r,
        attendees: Array.isArray(r.attendees) ? r.attendees.slice(0, 30) : [],
      })),
      students: students.slice(0, 60).map((s) => ({
        studentId: String(s.studentId || ""),
        name: String(s.name || "Student").slice(0, 80),
        email: s.email ? String(s.email).slice(0, 80) : undefined,
        grade: String(s.grade || "12").slice(0, 4),
        xp: Number(s.xp) || 0,
        streak: Number(s.streak) || 0,
        accuracy: s.accuracy ?? null,
        mistakes: Number(s.mistakes) || 0,
        weakSubjects: Array.isArray(s.weakSubjects)
          ? s.weakSubjects.slice(0, 5).map(String)
          : [],
        chaptersOpened: Number(s.chaptersOpened) || 0,
        lastActive: Number(s.lastActive) || Date.now(),
        recentMistakes: Array.isArray(s.recentMistakes)
          ? s.recentMistakes.slice(0, 2)
          : [],
      })),
      liveSession: sess
        ? {
            id: String(sess.id || ""),
            title: String(sess.title || "Live").slice(0, 120),
            subject: String(sess.subject || "").slice(0, 60),
            startedAt: Number(sess.startedAt) || Date.now(),
            endsAt: Number(sess.endsAt) || Date.now(),
            active: Boolean(sess.active),
            joinCode: String(sess.joinCode || "").slice(0, 12),
            meetUrl: sess.meetUrl
              ? String(sess.meetUrl).slice(0, 300)
              : undefined,
            scheduledAt: sess.scheduledAt,
            messages: Array.isArray(sess.messages)
              ? sess.messages.slice(-30)
              : [],
            attendees: Array.isArray(sess.attendees)
              ? sess.attendees.slice(0, 60)
              : [],
            kickedIds: Array.isArray(sess.kickedIds)
              ? sess.kickedIds.slice(0, 40)
              : [],
            kickReasons: sess.kickReasons || {},
          }
        : null,
    };
  } catch {
    return {
      code: String(c?.code || "X"),
      name: String(c?.name || "Class"),
      teacherId: String(c?.teacherId || ""),
      teacherName: "Teacher",
      createdAt: Date.now(),
      materials: [],
      students: [],
      alerts: [],
      attendanceLog: [],
      liveSession: null,
    };
  }
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
  const existing =
    peekMeta(userId) ||
    getCachedMeta(userId, 600_000) ||
    ({} as SmartlearnMeta);

  let liveExisting = existing;
  let publicMetadata: Record<string, unknown> =
    getCachedPublicMeta(userId) || {};

  // Only hit Clerk getUser if cache empty / stale
  if (!Object.keys(existing).length || !getCachedMeta(userId, 30_000)) {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      liveExisting = metaOf(user);
      publicMetadata = (user.publicMetadata || {}) as Record<string, unknown>;
      setCachedMeta(userId, liveExisting, publicMetadata);
    } catch (e) {
      if (!isRateLimitError(e) && !Object.keys(existing).length) throw e;
      // keep using cache on 429
    }
  }

  const mergedBank = {
    ...(liveExisting.materialBank || {}),
    ...(smartlearn.materialBank || {}),
  };
  const roomsRaw = smartlearn.classrooms ?? liveExisting.classrooms ?? [];
  const cleaned: SmartlearnMeta = {
    ...liveExisting,
    ...smartlearn,
    classrooms: roomsRaw.slice(0, 20).map((c) => lightClassroom(c)),
    materialBank: lightMaterialBank(mergedBank),
    teacherRemarks: (
      smartlearn.teacherRemarks ??
      liveExisting.teacherRemarks ??
      []
    ).slice(0, 20),
    joinedClassMap: {
      ...(liveExisting.joinedClassMap || {}),
      ...(smartlearn.joinedClassMap || {}),
    },
    joinedClassCodes:
      smartlearn.joinedClassCodes ?? liveExisting.joinedClassCodes,
    joinedClassCode:
      smartlearn.joinedClassCode !== undefined
        ? smartlearn.joinedClassCode
        : liveExisting.joinedClassCode,
  };

  let payload: SmartlearnMeta;
  try {
    payload = JSON.parse(JSON.stringify(cleaned)) as SmartlearnMeta;
  } catch {
    payload = {
      role: cleaned.role || "teacher",
      classrooms: (cleaned.classrooms || []).slice(0, 10).map((c) => ({
        code: c.code,
        name: c.name,
        teacherId: c.teacherId,
        teacherName: c.teacherName,
        createdAt: c.createdAt,
        students: [],
        materials: [],
        liveSession: null,
        alerts: [],
        attendanceLog: [],
      })),
      materialBank: {},
      activeClassCode: cleaned.activeClassCode || null,
    };
  }

  // Always update local cache so subsequent reads don't need Clerk
  setCachedMeta(userId, payload, { ...publicMetadata, smartlearn: payload });

  // Skip Clerk write during cooldown / rate limit — bank + cache still work
  if (shouldSkipClerkWrite(userId)) {
    return;
  }

  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...publicMetadata,
        smartlearn: payload,
      },
    });
    markClerkWrite(userId);
  } catch (e) {
    if (isRateLimitError(e)) {
      markClerkWrite(userId); // back off further
      return; // silent — UI keeps working from cache/bank
    }
    console.error("saveMeta", e);
  }
}

function teacherIdOr(c: Classroom, fallback: string) {
  return c.teacherId || fallback;
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

/** Resolve class by code — uses code index first (no full user scan). */
export async function findClassroomByCode(
  code: string
): Promise<{ teacherId: string; classroom: Classroom } | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  // 1) Fast index lookup
  try {
    const { lookupTeacherByCode, registerClassCode } = await import(
      "@/lib/class-code-index"
    );
    const tid = await lookupTeacherByCode(normalized);
    if (tid) {
      const room = await getClassroomForTeacher(tid, normalized);
      if (room) {
        return { teacherId: tid, classroom: { ...room, teacherId: tid } };
      }
    }
  } catch {
    // ignore
  }

  // 2) Limited fallback scan (max 2 pages) — only if index miss
  try {
    const client = await clerkClient();
    let offset = 0;
    const limit = 50;
    for (let page = 0; page < 2; page++) {
      const res = await client.users.getUserList({ limit, offset });
      for (const u of res.data) {
        const meta = metaOf(u);
        if (meta.role !== "teacher") continue;
        const room = (meta.classrooms || []).find(
          (c) => c.code === normalized
        );
        if (room) {
          try {
            const { registerClassCode } = await import(
              "@/lib/class-code-index"
            );
            await registerClassCode(normalized, u.id);
          } catch {
            // ignore
          }
          return {
            teacherId: u.id,
            classroom: { ...room, teacherId: u.id },
          };
        }
      }
      offset += limit;
      if (res.data.length < limit) break;
    }
  } catch (e) {
    console.error("findClassroomByCode fallback", e);
  }
  return null;
}

export async function getTeacherMeta(userId: string): Promise<SmartlearnMeta> {
  const hit = getCachedMeta(userId);
  if (hit) return hit;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const meta = metaOf(user);
    setCachedMeta(
      userId,
      meta,
      (user.publicMetadata || {}) as Record<string, unknown>
    );
    return meta;
  } catch (e) {
    const stale = peekMeta(userId) || getCachedMeta(userId, 30 * 60_000);
    if (stale) return stale;
    if (isRateLimitError(e)) {
      return { classrooms: [], materialBank: {}, role: "teacher" };
    }
    throw e;
  }
}

export async function setUserRole(
  userId: string,
  role: "student" | "teacher"
) {
  const meta = await getTeacherMeta(userId);
  if (meta.role === role) return role; // no Clerk write
  await saveMeta(userId, { ...meta, role });
  return role;
}

export async function createClassroomForTeacher(
  teacherId: string,
  teacherName: string,
  name: string
): Promise<Classroom> {
  const meta = await getTeacherMeta(teacherId);
  const existing = meta.classrooms || [];

  // Unique among this teacher's classes only (no network)
  const used = new Set(
    (existing || []).map((c) => String(c.code || "").toUpperCase())
  );
  let code = makeCode(6);
  for (let i = 0; i < 30; i++) {
    if (!used.has(code)) break;
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

  try {
    const { registerClassCode } = await import("@/lib/class-code-index");
    await registerClassCode(code, teacherId);
  } catch {
    // ignore
  }

  return room;
}

export async function listTeacherClassrooms(
  teacherId: string
): Promise<Classroom[]> {
  try {
    const meta = await getTeacherMeta(teacherId);
    const rooms = Array.isArray(meta.classrooms) ? meta.classrooms : [];
    return rooms
      .filter((r) => r && r.code)
      .map((r) => {
        try {
          return {
            ...r,
            code: String(r.code).toUpperCase(),
            materials: materialsForRoom(meta, r.code, r),
          };
        } catch {
          return { ...r, code: String(r.code || "").toUpperCase(), materials: [] };
        }
      });
  } catch (e) {
    console.error("listTeacherClassrooms", e);
    return [];
  }
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

  try {
    const { unregisterClassCode } = await import("@/lib/class-code-index");
    await unregisterClassCode(normalized);
  } catch {
    // ignore
  }

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

  // Light student row (avoid Clerk size blow-ups)
  const lightSnap: StudentSnapshot = {
    studentId: snapshot.studentId,
    name: String(snapshot.name || "Student").slice(0, 80),
    email: snapshot.email ? String(snapshot.email).slice(0, 80) : undefined,
    grade: String(snapshot.grade || "12").slice(0, 4),
    xp: Number(snapshot.xp) || 0,
    streak: Number(snapshot.streak) || 0,
    accuracy: snapshot.accuracy ?? null,
    mistakes: Number(snapshot.mistakes) || 0,
    weakSubjects: (snapshot.weakSubjects || []).slice(0, 5),
    chaptersOpened: Number(snapshot.chaptersOpened) || 0,
    lastActive: Date.now(),
    recentMistakes: (snapshot.recentMistakes || []).slice(0, 3),
  };

  let updated: Classroom | null = null;
  try {
    updated = await updateClassroom(
      found.teacherId,
      found.classroom.code,
      (c) => {
        const others = (c.students || []).filter(
          (s) => s.studentId !== lightSnap.studentId
        );
        return {
          ...c,
          students: [lightSnap, ...others].slice(0, 80),
        };
      }
    );
  } catch (e) {
    console.error("join updateClassroom", e);
    // still allow join via student meta even if teacher roster update fails
    updated = found.classroom;
  }

  if (!updated) updated = found.classroom;

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
  } catch (e) {
    console.error("join student meta", e);
  }

  // Attach materials so student UI has PDFs immediately (48h bank)
  let materials = updated.materials || [];
  try {
    const tMeta = await getTeacherMeta(found.teacherId);
    const { getMaterialsByCode, isMaterialActive } = await import(
      "@/lib/materials-bank-store"
    );
    const extra = await getMaterialsByCode(
      updated.code,
      tMeta.materialsIndexUrl
    );
    const fromMeta = materialsForRoom(tMeta, updated.code, updated);
    const matMap = new Map<string, TeacherMaterial>();
    for (const x of [...extra, ...fromMeta, ...materials]) {
      if (x?.url && isMaterialActive(x)) matMap.set(x.id || x.url, x);
    }
    materials = Array.from(matMap.values()).sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
  } catch {
    // ignore
  }

  return {
    ok: true,
    classroom: { ...updated, teacherId: found.teacherId, materials },
  };
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
    // Pull materials: remote index + clerk bank + classroom
    let materials: TeacherMaterial[] = [];
    try {
      const tMeta = await getTeacherMeta(found.teacherId);
      materials = materialsForRoom(tMeta, code, found.classroom);
      try {
        const { getMaterialsByCode } = await import(
          "@/lib/materials-bank-store"
        );
        const fileMats = await getMaterialsByCode(
          code,
          tMeta.materialsIndexUrl
        );
        const map = new Map<string, TeacherMaterial>();
        for (const m of [...fileMats, ...materials]) {
          if (!m?.url) continue;
          map.set(m.id || m.url, m);
        }
        materials = Array.from(map.values()).sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
        );
      } catch {
        // ignore
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
  const now = Date.now();
  const m: TeacherMaterial = {
    ...material,
    // Keep full data URLs / https for student bank (48h visibility)
    url: url.startsWith("data:") ? url : url.slice(0, 4000),
    title: String(material.title || "Notes").slice(0, 120),
    subject: String(material.subject || "General").slice(0, 60),
    id: `mat-${now}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
    expiresAt: now + 48 * 60 * 60 * 1000,
  };

  // Prefer cache — avoid Clerk getUser on every upload
  const meta = await getTeacherMeta(teacherId);

  // 1) Durable bank ONLY (students read this) — no Clerk required
  let remoteUrl: string | null = meta.materialsIndexUrl || null;
  let fileMats: TeacherMaterial[] = [m];
  try {
    const { addMaterialToBank } = await import("@/lib/materials-bank-store");
    const res = await addMaterialToBank(
      teacherId,
      normalized,
      m,
      material.teacherName || "Teacher",
      meta.materialsIndexUrl
    );
    fileMats = res.materials;
    if (res.remoteUrl) remoteUrl = res.remoteUrl;
  } catch (e) {
    console.error("materials-bank-store", e);
  }

  // 2) Soft Clerk pointer (skipped under rate limit / cooldown)
  const bank = { ...(meta.materialBank || {}) };
  const shortOnly = [m, ...(bank[normalized] || [])]
    .filter(
      (x) =>
        x?.url &&
        (x.url.startsWith("http://") ||
          x.url.startsWith("https://") ||
          x.url.startsWith("/api/") ||
          (x.url.startsWith("data:") && x.url.length < 80_000))
    )
    .slice(0, 12);
  bank[normalized] = shortOnly;

  try {
    await saveMeta(teacherId, {
      ...meta,
      role: "teacher",
      activeClassCode: meta.activeClassCode || normalized,
      materialBank: bank,
      materialsIndexUrl: remoteUrl || meta.materialsIndexUrl || null,
      classrooms: meta.classrooms || [],
    });
  } catch (e) {
    console.error("clerk material save soft", e);
  }

  const rooms = meta.classrooms || [];
  const existing = rooms.find((c) => c.code === normalized);
  const materials = fileMats.length
    ? fileMats
    : materialsForRoom({ ...meta, materialBank: bank }, normalized, existing);

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

/** Materials for a class: bank first, then classroom.materials (48h window) */
export function materialsForRoom(
  meta: SmartlearnMeta,
  code: string,
  room?: Classroom | null
): TeacherMaterial[] {
  const c = code.toUpperCase();
  const fromBank = meta.materialBank?.[c] || [];
  const fromRoom = room?.materials || [];
  const map = new Map<string, TeacherMaterial>();
  const ttl = 48 * 60 * 60 * 1000;
  const now = Date.now();
  for (const m of [...fromBank, ...fromRoom]) {
    if (!m?.url) continue;
    const exp = m.expiresAt || (m.createdAt || 0) + ttl;
    if (exp && exp < now) continue;
    const key = m.id || m.url;
    if (!map.has(key)) map.set(key, m);
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
