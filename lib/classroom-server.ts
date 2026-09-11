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
  clearClerkWriteCooldown,
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
        .filter((m) => {
          if (!m?.url) return false;
          const u = String(m.url);
          // Keep https + modest data: embeds (large data lives in shared index)
          if (u.startsWith("data:") && u.length > 100_000) return false;
          return true;
        })
        .map((m) => ({
          id: String(m.id || `mat-${Date.now()}`),
          title: String(m.title || "Notes").slice(0, 120),
          type: (m.type === "video" || m.type === "link"
            ? m.type
            : "notes") as "notes" | "video" | "link",
          url: String(m.url).slice(0, 120_000),
          subject: String(m.subject || "General").slice(0, 60),
          createdAt: Number(m.createdAt) || Date.now(),
          expiresAt: m.expiresAt ? Number(m.expiresAt) : undefined,
          teacherName: String(m.teacherName || "").slice(0, 80),
        }))
        .slice(0, 40),
      alerts: alerts.slice(0, 10),
      attendanceLog: attendanceLog.slice(0, 40).map((r) => ({
        id: String(r.id || ""),
        sessionId: String(r.sessionId || ""),
        sessionTitle: String(r.sessionTitle || "Session").slice(0, 120),
        subject: String(r.subject || "").slice(0, 60),
        startedAt: Number(r.startedAt) || Date.now(),
        endedAt: r.endedAt ? Number(r.endedAt) : undefined,
        attendees: Array.isArray(r.attendees)
          ? r.attendees.slice(0, 200).map((a) => ({
              studentId: String(a.studentId || ""),
              name: String(a.name || "Student").slice(0, 80),
              joinedAt: Number(a.joinedAt) || Date.now(),
              leftAt: a.leftAt ? Number(a.leftAt) : undefined,
            }))
          : [],
      })),
      students: students.slice(0, 80).map((s) => ({
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
        joinedAt: Number(s.joinedAt) || Number(s.lastActive) || Date.now(),
        recentMistakes: Array.isArray(s.recentMistakes)
          ? s.recentMistakes.slice(0, 2)
          : [],
      })),
      liveSession:
        sess && sess.active
          ? {
              id: String(sess.id || ""),
              title: String(sess.title || "Live").slice(0, 120),
              subject: String(sess.subject || "").slice(0, 60),
              startedAt: Number(sess.startedAt) || Date.now(),
              endsAt: Number(sess.endsAt) || Date.now(),
              joinUntil: sess.joinUntil
                ? Number(sess.joinUntil)
                : Number(sess.endsAt) || Date.now(),
              active: true,
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
  const ttl = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  for (const [code, list] of Object.entries(bank || {})) {
    out[code] = (list || [])
      .filter((m) => m?.url)
      .filter((m) => {
        const exp = m.expiresAt || (m.createdAt || 0) + ttl;
        return !m.createdAt || exp > now;
      })
      .map((m) => {
        const url = String(m.url);
        // Prefer https for cross-device students; keep small data URLs
        const safeUrl =
          url.startsWith("data:") && url.length > 100_000
            ? ""
            : url.startsWith("data:")
              ? url
              : url.startsWith("http")
                ? url.slice(0, 4000) // never chop blob URLs to 800 (broke 2nd PDF)
                : url.slice(0, 2000);
        return {
          ...m,
          url: safeUrl,
          title: String(m.title || "").slice(0, 120),
          subject: String(m.subject || "General").slice(0, 60),
          teacherName: String(m.teacherName || "").slice(0, 80),
          type: m.type || "notes",
          id: m.id || `mat-${Date.now()}`,
          createdAt: m.createdAt || Date.now(),
          expiresAt: m.expiresAt || (m.createdAt || Date.now()) + ttl,
        };
      })
      .filter((m) => m.url)
      .slice(0, 20);
  }
  return out;
}

async function saveMeta(
  userId: string,
  smartlearn: SmartlearnMeta,
  opts?: { force?: boolean }
) {
  const existing =
    peekMeta(userId) ||
    getCachedMeta(userId, 600_000) ||
    ({} as SmartlearnMeta);

  let liveExisting = existing;
  let publicMetadata: Record<string, unknown> =
    getCachedPublicMeta(userId) || {};

  // Always refresh from Clerk on force (materials must merge with live data)
  if (
    opts?.force ||
    !Object.keys(existing).length ||
    !getCachedMeta(userId, 30_000)
  ) {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      liveExisting = metaOf(user);
      publicMetadata = (user.publicMetadata || {}) as Record<string, unknown>;
      setCachedMeta(userId, liveExisting, publicMetadata);
    } catch (e) {
      if (!isRateLimitError(e) && !Object.keys(existing).length) throw e;
    }
  }

  const mergedBank: Record<string, TeacherMaterial[]> = {
    ...(liveExisting.materialBank || {}),
  };
  // Per-code replace when caller sends bank entries (don't drop other codes)
  for (const [k, list] of Object.entries(smartlearn.materialBank || {})) {
    mergedBank[k] = list;
  }

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
    materialsIndexUrl:
      smartlearn.materialsIndexUrl !== undefined
        ? smartlearn.materialsIndexUrl
        : liveExisting.materialsIndexUrl,
    classMaterialPacks: {
      ...(liveExisting.classMaterialPacks || {}),
      ...(smartlearn.classMaterialPacks || {}),
    },
  };

  let payload: SmartlearnMeta;
  try {
    payload = JSON.parse(JSON.stringify(cleaned)) as SmartlearnMeta;
  } catch {
    payload = {
      role: cleaned.role || liveExisting.role || "student",
      classrooms: (cleaned.classrooms || []).slice(0, 10).map((c) => ({
        code: c.code,
        name: c.name,
        teacherId: c.teacherId,
        teacherName: c.teacherName,
        createdAt: c.createdAt,
        students: [],
        materials: (c.materials || []).slice(0, 15),
        liveSession: null,
        alerts: [],
        attendanceLog: [],
      })),
      materialBank: lightMaterialBank(mergedBank),
      activeClassCode: cleaned.activeClassCode || null,
      materialsIndexUrl: cleaned.materialsIndexUrl || null,
      // CRITICAL: never drop student remarks on serialize failure
      teacherRemarks: cleaned.teacherRemarks || liveExisting.teacherRemarks || [],
    };
  }

  setCachedMeta(userId, payload, { ...publicMetadata, smartlearn: payload });

  if (!opts?.force && shouldSkipClerkWrite(userId)) {
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
      markClerkWrite(userId);
      return;
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

/** Prefer active live from cache when Clerk lag/rate-limit dropped it */
function mergeLiveFromCache(
  clerkMeta: SmartlearnMeta,
  cached: SmartlearnMeta | null
): SmartlearnMeta {
  if (!cached?.classrooms?.length) return clerkMeta;
  const cacheByCode = new Map(
    (cached.classrooms || []).map((r) => [r.code.toUpperCase(), r])
  );
  const pickLog = (a?: AttendanceRecord[], b?: AttendanceRecord[]) => {
    const aa = a || [];
    const bb = b || [];
    if (aa.length >= bb.length) return aa.length ? aa : bb;
    return bb;
  };
  const rooms = (clerkMeta.classrooms || []).map((room) => {
    const code = room.code.toUpperCase();
    const prev = cacheByCode.get(code);
    if (room.liveSession?.active) {
      return {
        ...room,
        attendanceLog: pickLog(room.attendanceLog, prev?.attendanceLog),
        students:
          (room.students?.length || 0) >= (prev?.students?.length || 0)
            ? room.students
            : prev?.students || room.students,
      };
    }
    // Never resurrect LIVE after End: if log closed that session, or start not recent
    if (prev?.liveSession?.active) {
      const sid = prev.liveSession.id;
      const closed =
        (room.attendanceLog || []).some(
          (r) => r.sessionId === sid && r.endedAt
        ) ||
        (prev.attendanceLog || []).some(
          (r) => r.sessionId === sid && r.endedAt
        );
      const recentStart =
        Date.now() - (prev.liveSession.startedAt || 0) < 45_000;
      if (!closed && recentStart) {
        return {
          ...room,
          liveSession: prev.liveSession,
          attendanceLog: pickLog(room.attendanceLog, prev.attendanceLog),
          students:
            (room.students?.length || 0) >= (prev.students?.length || 0)
              ? room.students
              : prev.students || room.students,
        };
      }
      return {
        ...room,
        liveSession: null,
        attendanceLog: pickLog(room.attendanceLog, prev.attendanceLog),
        students:
          (room.students?.length || 0) >= (prev.students?.length || 0)
            ? room.students
            : prev.students || room.students,
      };
    }
    if (prev) {
      return {
        ...room,
        liveSession: null,
        attendanceLog: pickLog(room.attendanceLog, prev.attendanceLog),
        students:
          (room.students?.length || 0) >= (prev.students?.length || 0)
            ? room.students
            : prev.students || room.students,
      };
    }
    return room;
  });
  // Include cache-only rooms that clerk omitted (shouldn't happen often)
  for (const [code, prev] of cacheByCode) {
    if (
      !rooms.some((r) => r.code.toUpperCase() === code) &&
      prev.liveSession?.active &&
      Date.now() - (prev.liveSession.startedAt || 0) < 45_000
    ) {
      rooms.push(prev);
    }
  }
  return { ...clerkMeta, classrooms: rooms };
}

export async function getTeacherMeta(
  userId: string,
  opts?: { fresh?: boolean }
): Promise<SmartlearnMeta> {
  if (!opts?.fresh) {
    const hit = getCachedMeta(userId);
    if (hit) return hit;
  }

  const cached = peekMeta(userId) || getCachedMeta(userId, 30 * 60_000);

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    let meta = metaOf(user);
    // Never let a lagging Clerk read wipe an active live session from memory
    meta = mergeLiveFromCache(meta, cached);
    setCachedMeta(
      userId,
      meta,
      (user.publicMetadata || {}) as Record<string, unknown>
    );
    return meta;
  } catch (e) {
    if (cached) return cached;
    if (isRateLimitError(e)) {
      return { classrooms: [], materialBank: {}, role: "teacher" };
    }
    throw e;
  }
}

/** Student-facing notes for a class code (fresh Clerk + public pack) */
export async function getNotesForClassCode(code: string): Promise<{
  code: string;
  name: string;
  teacherName: string;
  materials: TeacherMaterial[];
}> {
  const c = code.trim().toUpperCase();
  let name = `Class ${c}`;
  let teacherName = "Teacher";
  if (!c) {
    return { code: c, name, teacherName: "", materials: [] };
  }

  // NEVER early-return empty — journal/index may still have PDFs
  const found = await findClassroomByCode(c).catch(() => null);
  if (found?.classroom) {
    name = found.classroom.name || name;
    teacherName = found.classroom.teacherName || teacherName;
  }

  const byId = new Map<string, TeacherMaterial>();
  const byUrl = new Map<string, TeacherMaterial>();
  const add = (list: TeacherMaterial[] = []) => {
    for (const m of list) {
      if (!m?.url) continue;
      const exp =
        m.expiresAt || (m.createdAt || 0) + 30 * 24 * 60 * 60 * 1000;
      if (exp < Date.now()) continue;
      if (
        !m.url.startsWith("http") &&
        !m.url.startsWith("data:") &&
        !m.url.startsWith("/api/")
      )
        continue;
      const id = String(m.id || "").trim();
      if (id) {
        const prev = byId.get(id);
        if (!prev || (m.createdAt || 0) >= (prev.createdAt || 0)) {
          byId.set(id, m);
        }
      }
      const prevU = byUrl.get(m.url);
      if (!prevU || (m.createdAt || 0) >= (prevU.createdAt || 0)) {
        byUrl.set(m.url, m);
      }
    }
  };

  if (found?.classroom?.materials) add(found.classroom.materials);

  // Journal — works even when findClassroomByCode fails
  try {
    const { journalListMaterials } = await import(
      "@/lib/class-materials-journal"
    );
    const j = await journalListMaterials(c);
    add(j.materials);
    if (j.className) name = j.className || name;
    if (j.teacherName) teacherName = j.teacherName || teacherName;
  } catch (e) {
    console.error("journalListMaterials", e);
  }

  try {
    const { getClassMaterials } = await import("@/lib/class-code-index");
    add(await getClassMaterials(c));
  } catch {
    // ignore
  }

  try {
    const { getMaterialsByCode } = await import("@/lib/materials-bank-store");
    add(await getMaterialsByCode(c, null));
  } catch {
    // ignore
  }

  if (found?.teacherId) {
    try {
      const meta = await getTeacherMeta(found.teacherId, { fresh: true });
      add(meta.materialBank?.[c] || []);
      add(materialsForRoom(meta, c, found.classroom));
      const row = (meta.classrooms || []).find(
        (r) => r.code.toUpperCase() === c
      );
      if (row?.materials?.length) add(row.materials);

      const packUrls = new Set<string>();
      const latest =
        meta.classMaterialPacks?.[c] || meta.materialsIndexUrl || null;
      if (latest?.startsWith("http")) packUrls.add(latest);
      if (meta.classMaterialPacks) {
        for (const [k, u] of Object.entries(meta.classMaterialPacks)) {
          if (k.toUpperCase() === c && u?.startsWith("http")) packUrls.add(u);
        }
      }
      const { fetchClassNotesPack } = await import(
        "@/lib/class-materials-public"
      );
      for (const packUrl of packUrls) {
        try {
          const pack = await fetchClassNotesPack(packUrl);
          if (pack?.materials?.length) {
            add(pack.materials);
            if (pack.className) name = pack.className || name;
            if (pack.teacherName) teacherName = pack.teacherName || teacherName;
          }
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.error("getNotesForClassCode teacher meta", e);
    }
  }

  const seenUrl = new Set<string>();
  const materials: TeacherMaterial[] = [];
  for (const m of byId.values()) {
    materials.push(m);
    seenUrl.add(m.url);
  }
  for (const m of byUrl.values()) {
    if (seenUrl.has(m.url)) continue;
    materials.push(m);
  }
  materials.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return {
    code: c,
    name: name || `Class ${c}`,
    teacherName: teacherName || "Teacher",
    materials,
  };
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
  clearClerkWriteCooldown(teacherId);
  try {
    await saveMeta(
      teacherId,
      {
        ...meta,
        role: "teacher",
        classrooms,
        activeClassCode: code,
      },
      { force: true }
    );
  } catch (e) {
    // Still return room so teacher UI works; cache already holds it via setCachedMeta
    if (!isRateLimitError(e)) console.error("createClassroom saveMeta", e);
  }

  try {
    const { registerClassCode } = await import("@/lib/class-code-index");
    await registerClassCode(code, teacherId);
  } catch {
    // ignore
  }

  return room;
}

export async function listTeacherClassrooms(
  teacherId: string,
  opts?: { fresh?: boolean }
): Promise<Classroom[]> {
  try {
    const meta = await getTeacherMeta(teacherId, {
      fresh: Boolean(opts?.fresh),
    });
    const rooms = Array.isArray(meta.classrooms) ? meta.classrooms : [];
    const mapped = rooms
      .filter((r) => r && r.code)
      .map((r) => {
        try {
          return {
            ...r,
            code: String(r.code).toUpperCase(),
            teacherId: r.teacherId || teacherId,
            students: Array.isArray(r.students) ? r.students : [],
            materials: materialsForRoom(meta, r.code, r),
            liveSession: r.liveSession?.active ? r.liveSession : r.liveSession,
          } as Classroom;
        } catch {
          return {
            ...r,
            code: String(r.code || "").toUpperCase(),
            materials: [] as TeacherMaterial[],
            students: Array.isArray(r.students) ? r.students : [],
          } as Classroom;
        }
      });

    // Overlay shared live index so teacher panel matches what students see
    try {
      const { getClassLive } = await import("@/lib/class-code-index");
      return await Promise.all(
        mapped.map(async (room) => {
          const shared = await getClassLive(room.code);
          if (shared?.active) {
            return {
              ...room,
              liveSession: {
                id: shared.id,
                title: shared.title,
                subject: shared.subject,
                meetUrl: shared.meetUrl || room.liveSession?.meetUrl,
                joinCode: shared.joinCode || room.liveSession?.joinCode || "",
                active: true,
                startedAt: shared.startedAt,
                endsAt: shared.endsAt,
                joinUntil: shared.joinUntil || shared.endsAt,
                scheduledAt: shared.scheduledAt,
                messages: room.liveSession?.messages || [],
                attendees: room.liveSession?.attendees || [],
                kickedIds: room.liveSession?.kickedIds,
                kickReasons: room.liveSession?.kickReasons,
              },
            };
          }
          // Shared says no live — only clear if Clerk also has no active live
          if (!shared && room.liveSession?.active) {
            // Keep Clerk/cache active live (shared read miss should not kill teacher UI)
            return room;
          }
          if (shared === null && !room.liveSession?.active) {
            return { ...room, liveSession: null };
          }
          return room;
        })
      );
    } catch {
      return mapped;
    }
  } catch (e) {
    console.error("listTeacherClassrooms", e);
    const stale = peekMeta(teacherId);
    if (stale?.classrooms?.length) {
      return stale.classrooms.filter((r) => r && r.code);
    }
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
  // Always force fresh meta for live/roster writes (stale cache was dropping students)
  clearClerkWriteCooldown(teacherId);
  let meta = await getTeacherMeta(teacherId, { fresh: true });
  const rooms = [...(meta.classrooms || [])];
  const idx = rooms.findIndex((c) => c.code === code.toUpperCase());
  if (idx < 0) return null;
  const next = updater({ ...rooms[idx], teacherId });
  rooms[idx] = next;
  await saveMeta(
    teacherId,
    { ...meta, role: "teacher", classrooms: rooms },
    { force: true }
  );
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
    const { unregisterClassCode, markClassDeleted, publishClassLive } =
      await import("@/lib/class-code-index");
    await publishClassLive(normalized, teacherId, null);
    await markClassDeleted(normalized);
    await unregisterClassCode(normalized);
  } catch {
    // ignore
  }

  // Remove class from every joined student's Clerk meta + map
  for (const s of room.students || []) {
    try {
      clearClerkWriteCooldown(s.studentId);
      const st = await client.users.getUser(s.studentId);
      const sm = metaOf(st);
      const next = codesOf(sm).filter((c) => c !== normalized);
      const map = { ...(sm.joinedClassMap || {}) };
      delete map[normalized];
      await saveMeta(
        s.studentId,
        {
          ...sm,
          joinedClassCode: next[0] || null,
          joinedClassCodes: next,
          joinedClassMap: map,
        },
        { force: true }
      );
    } catch {
      // non-fatal — student client also drops via deleted-codes list
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

  const nowJoin = Date.now();
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
    lastActive: nowJoin,
    joinedAt: snapshot.joinedAt || nowJoin,
    recentMistakes: (snapshot.recentMistakes || []).slice(0, 3),
  };

  let updated: Classroom | null = null;
  try {
    updated = await updateClassroom(
      found.teacherId,
      found.classroom.code,
      (c) => {
        const prev = (c.students || []).find(
          (s) => s.studentId === lightSnap.studentId
        );
        const others = (c.students || []).filter(
          (s) => s.studentId !== lightSnap.studentId
        );
        // Preserve first join time forever
        const row: StudentSnapshot = {
          ...lightSnap,
          joinedAt: prev?.joinedAt || lightSnap.joinedAt || nowJoin,
          lastActive: nowJoin,
        };
        return {
          ...c,
          students: [row, ...others].slice(0, 80),
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

    // Clerk room live + shared live index (ended only clears)
    let sess = found.classroom.liveSession?.active
      ? found.classroom.liveSession
      : found.classroom.liveSession?.scheduledAt &&
          found.classroom.liveSession.scheduledAt > Date.now()
        ? found.classroom.liveSession
        : null;
    try {
      const { lookupClassLive } = await import("@/lib/class-code-index");
      const looked = await lookupClassLive(code);
      if (looked.status === "active") {
        const shared = looked.live;
        sess = {
          id: shared.id,
          title: shared.title,
          subject: shared.subject,
          meetUrl: shared.meetUrl,
          joinCode: shared.joinCode,
          active: true,
          startedAt: shared.startedAt,
          endsAt: shared.endsAt,
          joinUntil: shared.joinUntil || shared.endsAt,
          scheduledAt: shared.scheduledAt,
          messages: found.classroom.liveSession?.messages || [],
          attendees: found.classroom.liveSession?.attendees || [],
        };
      } else if (looked.status === "ended") {
        sess = null;
      }
      // status "none" → keep Clerk sess (do NOT clear active live)
    } catch {
      // keep clerk sess
    }
    const kicked = Boolean(
      sess?.active && (sess.kickedIds || []).includes(userId)
    );
    // Pull materials + fresh teacher room (live + attendees)
    let materials: TeacherMaterial[] = [];
    try {
      const tMeta = await getTeacherMeta(found.teacherId, { fresh: true });
      const roomFresh =
        (tMeta.classrooms || []).find(
          (r) => r.code === code.toUpperCase()
        ) || found.classroom;
      if (roomFresh.liveSession?.active && !sess?.active) {
        sess = roomFresh.liveSession;
      }
      if (sess?.active && roomFresh.liveSession?.attendees?.length) {
        sess = {
          ...sess,
          attendees: roomFresh.liveSession.attendees,
          meetUrl: sess.meetUrl || roomFresh.liveSession.meetUrl,
        };
      }
      materials = materialsForRoom(tMeta, code, roomFresh);
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
      liveSession:
        sess?.active || (sess?.scheduledAt && sess.scheduledAt > Date.now())
          ? {
              ...sess,
              kickedIds: undefined,
              kickReasons: undefined,
              meetUrl: kicked || !sess.active ? undefined : sess.meetUrl,
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
  // Clerk metadata size limit — huge data URLs go only to shared index
  const clerkSafeData =
    url.startsWith("data:") && url.length > 100_000
      ? false
      : true;
  if (url.startsWith("data:") && url.length > 900_000) {
    throw new Error(
      "PDF too large to embed. Use a smaller file (~500KB) or a Google Drive link."
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
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
  };

  // Fresh meta from Clerk when possible
  clearClerkWriteCooldown(teacherId);
  const meta = await getTeacherMeta(teacherId);

  // 1) Shared banks (best-effort)
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

  // 2) Clerk is source of truth for students (same path as join finds class)
  //    Only store https (or small data) so metadata stays small
  const clerkMat: TeacherMaterial = {
    ...m,
    url:
      m.url.startsWith("https://") || m.url.startsWith("http://")
        ? m.url.slice(0, 4000)
        : m.url.startsWith("data:") && clerkSafeData && m.url.length < 100_000
          ? m.url
          : m.url.startsWith("/api/")
            ? m.url
            : m.url.startsWith("data:")
              ? "" // big data only in shared index / pack
              : m.url.slice(0, 800),
  };
  // Always keep full URL (incl. large data:) for bank + student pack
  const fullMat: TeacherMaterial = { ...m };

  // Append-only journal so students always see every upload
  try {
    const { journalAppendMaterial } = await import(
      "@/lib/class-materials-journal"
    );
    await journalAppendMaterial(normalized, fullMat, {
      teacherId,
      teacherName: material.teacherName || "Teacher",
      className: normalized,
    });
  } catch (e) {
    console.error("journalAppendMaterial", e);
  }

  const bank = { ...(meta.materialBank || {}) };
  const prevBank = bank[normalized] || [];
  bank[normalized] = [
    fullMat,
    ...prevBank.filter((x) => x.id !== fullMat.id && x.url !== fullMat.url),
  ]
    .filter((x) => x?.url)
    .slice(0, 40);

  const rooms = [...(meta.classrooms || [])];
  const idx = rooms.findIndex((c) => c.code === normalized);
  const existing = idx >= 0 ? rooms[idx] : null;
  const roomMats = [
    clerkMat.url ? clerkMat : fullMat,
    ...((existing?.materials || []).filter(
      (x) => x.id !== fullMat.id && x.url !== fullMat.url
    ) || []),
  ]
    .filter((x) => x?.url)
    .slice(0, 40);

  if (idx >= 0) {
    rooms[idx] = { ...rooms[idx], materials: roomMats };
  } else {
    rooms.unshift({
      code: normalized,
      name: normalized,
      teacherId,
      teacherName: material.teacherName || "Teacher",
      createdAt: now,
      students: [],
      materials: roomMats,
      liveSession: null,
      alerts: [],
      attendanceLog: [],
    });
  }

  // Public notes pack (catbox JSON) — students fetch without shared /tmp
  let packUrl: string | null = null;
  try {
    const { uploadClassNotesPack, activeNotes } = await import(
      "@/lib/class-materials-public"
    );
    const allForPack = activeNotes([
      fullMat,
      clerkMat,
      ...(bank[normalized] || []),
      ...roomMats,
    ]);
    packUrl = await uploadClassNotesPack({
      code: normalized,
      teacherId,
      teacherName: existing?.teacherName || material.teacherName || "Teacher",
      className: existing?.name || normalized,
      materials: allForPack,
      updatedAt: now,
      ttlHours: 30 * 24,
    });
    if (packUrl) remoteUrl = packUrl;
  } catch (e) {
    console.error("uploadClassNotesPack", e);
  }

  const packs = { ...(meta.classMaterialPacks || {}) };
  if (packUrl) packs[normalized] = packUrl;

  try {
    await saveMeta(
      teacherId,
      {
        ...meta,
        role: "teacher",
        activeClassCode: meta.activeClassCode || normalized,
        materialBank: bank,
        materialsIndexUrl: remoteUrl || meta.materialsIndexUrl || null,
        classMaterialPacks: packs,
        classrooms: rooms,
      },
      { force: true }
    );
  } catch (e) {
    console.error("clerk material save", e);
  }

  // Ensure code maps to this teacher for student lookup
  try {
    const { registerClassCode, publishClassMaterials } = await import(
      "@/lib/class-code-index"
    );
    await registerClassCode(normalized, teacherId);
    await publishClassMaterials(
      normalized,
      teacherId,
      [fullMat, ...(clerkMat.url ? [clerkMat] : [])],
      material.teacherName || "Teacher"
    );
  } catch {
    // ignore
  }

  // Prefer bank (includes fullMat / data URLs) so new PDF always listed
  const materials = (() => {
    const map = new Map<string, TeacherMaterial>();
    for (const x of [
      fullMat,
      ...fileMats,
      ...(bank[normalized] || []),
      ...roomMats,
    ]) {
      if (!x?.url) continue;
      const prev = map.get(x.url);
      if (!prev || (x.createdAt || 0) >= (prev.createdAt || 0)) map.set(x.url, x);
    }
    return Array.from(map.values()).sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
  })();

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
  const ttl = 30 * 24 * 60 * 60 * 1000;
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

/** Soft safety only if teacher never clicks End (12h). Not a planned class length. */
export const LIVE_SOFT_MAX_MS = 12 * 60 * 60 * 1000;

export async function startLive(
  teacherId: string,
  code: string,
  title: string,
  subject: string,
  _minutes: number,
  meetUrl?: string,
  scheduledAt?: number
) {
  return updateClassroom(teacherId, code, (c) => {
    const now = Date.now();
    const start = scheduledAt && scheduledAt > now ? scheduledAt : now;
    const isScheduled = !!(scheduledAt && scheduledAt > now);
    // Session runs until teacher Ends (soft 12h cap). Join window = 15 min.
    const endsAt = start + LIVE_SOFT_MAX_MS;
    const joinUntil = start + 15 * 60_000;
    const live: LiveSession = {
      id: `live-${now}`,
      title,
      subject,
      startedAt: start,
      endsAt,
      joinUntil,
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
  }).then(async (room) => {
    // Share live so students on other servers see it immediately
    if (room) {
      try {
        const { publishClassLive, registerClassCode } = await import(
          "@/lib/class-code-index"
        );
        await registerClassCode(code, teacherId);
        const sess = room.liveSession;
        if (sess) {
          await publishClassLive(code, teacherId, {
            id: sess.id,
            title: sess.title,
            subject: sess.subject,
            meetUrl: sess.meetUrl,
            joinCode: sess.joinCode,
            active: sess.active,
            startedAt: sess.startedAt,
            endsAt: sess.endsAt,
            joinUntil:
              sess.joinUntil ||
              (sess.startedAt || Date.now()) + 15 * 60_000,
            scheduledAt: sess.scheduledAt,
            teacherName: room.teacherName,
            className: room.name,
          });
        }
      } catch (e) {
        console.error("publishClassLive", e);
      }
    }
    return room;
  });
}

function mergeAttendees(
  ...lists: (AttendanceAttendee[] | undefined)[]
): AttendanceAttendee[] {
  const map = new Map<string, AttendanceAttendee>();
  for (const list of lists) {
    for (const a of list || []) {
      if (!a?.studentId) continue;
      const id = String(a.studentId);
      const prev = map.get(id);
      if (!prev) {
        map.set(id, {
          studentId: id,
          name: String(a.name || "Student").slice(0, 80),
          joinedAt: Number(a.joinedAt) || Date.now(),
          leftAt: a.leftAt ? Number(a.leftAt) : undefined,
        });
      } else {
        const name =
          a.name && a.name !== "Student" ? String(a.name) : prev.name;
        map.set(id, {
          studentId: id,
          name: name.slice(0, 80),
          joinedAt: Math.min(
            Number(prev.joinedAt) || Date.now(),
            Number(a.joinedAt) || Date.now()
          ),
          leftAt: a.leftAt || prev.leftAt,
        });
      }
    }
  }
  return Array.from(map.values()).slice(0, 200);
}

export async function endLive(teacherId: string, code: string) {
  const normalized = code.trim().toUpperCase();
  // Clear shared live FIRST so students stop seeing Meet immediately
  try {
    const { publishClassLive } = await import("@/lib/class-code-index");
    await publishClassLive(normalized, teacherId, null);
  } catch (e) {
    console.error("endLive clear shared", e);
  }

  const room = await updateClassroom(teacherId, normalized, (c) => {
    if (!c.liveSession) return c;
    const sess = c.liveSession;
    const now = Date.now();
    const stampLeft = (list: AttendanceAttendee[]) =>
      list.map((a) => (a.leftAt ? a : { ...a, leftAt: now }));
    // NEVER drop people: merge live attendees + open log + any prior closed same session
    const fromLogs = (c.attendanceLog || [])
      .filter((r) => r.sessionId === sess.id)
      .flatMap((r) => r.attendees || []);
    const attendees = stampLeft(
      mergeAttendees(sess.attendees, fromLogs)
    );
    let attendanceLog = (c.attendanceLog || []).map((r) => {
      if (r.sessionId === sess.id) {
        return {
          ...r,
          endedAt: now,
          attendees: stampLeft(
            mergeAttendees(attendees, r.attendees)
          ),
        };
      }
      return r;
    });
    // Ensure a closed log exists even if start didn't create one
    if (!attendanceLog.some((r) => r.sessionId === sess.id)) {
      attendanceLog = [
        {
          id: `att-${sess.id}`,
          sessionId: sess.id,
          sessionTitle: sess.title,
          subject: sess.subject,
          startedAt: sess.startedAt,
          endedAt: now,
          attendees,
        },
        ...attendanceLog,
      ].slice(0, 80);
    }
    return {
      ...c,
      // null = fully ended (UI shows start form again, not stale Meet)
      liveSession: null,
      attendanceLog,
    };
  });

  // Clear again after Clerk write (race-safe)
  try {
    const { publishClassLive } = await import("@/lib/class-code-index");
    await publishClassLive(normalized, teacherId, null);
  } catch {
    // ignore
  }

  // Ensure returned room always has the closed attendance log (never drop it)
  if (room && (!room.attendanceLog || room.attendanceLog.length === 0)) {
    const peek = peekMeta(teacherId);
    const fromCache = peek?.classrooms?.find(
      (x) => x.code === normalized
    )?.attendanceLog;
    if (fromCache?.length) {
      return { ...room, attendanceLog: fromCache, liveSession: null };
    }
  }
  return room ? { ...room, liveSession: null } : room;
}

export async function markAttendance(
  code: string,
  studentId: string,
  name: string
): Promise<Classroom | null> {
  const found = await findClassroomByCode(code);
  if (!found) return null;

    let shared: {
      id: string;
      title: string;
      subject: string;
      meetUrl?: string;
      joinCode: string;
      startedAt: number;
      endsAt: number;
    } | null = null;
    try {
      const { getClassLive } = await import("@/lib/class-code-index");
      const s = await getClassLive(code);
      if (s?.active && s.id) {
        shared = {
          id: s.id,
          title: s.title,
          subject: s.subject,
          meetUrl: s.meetUrl,
          joinCode: s.joinCode,
          startedAt: s.startedAt,
          endsAt: s.endsAt,
        };
      }
    } catch {
      // ignore
    }

    return updateClassroom(found.teacherId, found.classroom.code, (c) => {
      let sess = c.liveSession;
      // If Clerk lost active flag but shared live is on, still mark attendance
      if ((!sess || !sess.active) && shared) {
        sess = {
          id: shared.id,
          title: shared.title || sess?.title || "Live class",
          subject: shared.subject || sess?.subject || "General",
          startedAt: shared.startedAt || sess?.startedAt || Date.now(),
          endsAt: shared.endsAt || sess?.endsAt || Date.now() + 12 * 60 * 60_000,
          active: true,
          joinCode: shared.joinCode || sess?.joinCode || "",
          meetUrl: shared.meetUrl || sess?.meetUrl,
          messages: sess?.messages || [],
          attendees: sess?.attendees || [],
        };
      }
      if (!sess?.active) return c;
    if ((sess.kickedIds || []).includes(studentId)) {
      return c;
    }
    const existing = sess.attendees || [];
    const already = existing.find(
      (a) => a.studentId === studentId && !a.leftAt
    );
    if (already) {
      // Already present — still ensure attendanceLog has them
      const hasInLog = (c.attendanceLog || []).some(
        (r) =>
          r.sessionId === sess!.id &&
          (r.attendees || []).some((x) => x.studentId === studentId)
      );
      if (hasInLog) return c;
    }
    const attendee: AttendanceAttendee = already || {
      studentId,
      name: name || "Student",
      joinedAt: Date.now(),
    };
    const attendees = mergeAttendees(
      already ? existing : [attendee, ...existing],
      existing
    );
    let attendanceLog = (c.attendanceLog || []).map((r) => {
      if (r.sessionId !== sess!.id) return r;
      return {
        ...r,
        attendees: mergeAttendees(r.attendees, [attendee], attendees),
      };
    });
    const hasLog = attendanceLog.some((r) => r.sessionId === sess!.id);
    if (!hasLog) {
      attendanceLog = [
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
    }
    return {
      ...c,
      liveSession: { ...sess, attendees },
      attendanceLog,
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
        // Kick must NEVER end the live session for teacher/others
        active: true,
        meetUrl: sess.meetUrl,
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
  clearClerkWriteCooldown(studentId);
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

  // 1) File backup first (always works even if Clerk lags)
  try {
    const { appendStudentRemark } = await import("@/lib/remarks-store");
    await appendStudentRemark(studentId, remark);
  } catch (e) {
    console.error("remarks file", e);
  }

  // 2) Force write onto STUDENT Clerk metadata
  try {
    await saveMeta(
      studentId,
      { ...sm, role: sm.role || "student", teacherRemarks },
      { force: true }
    );
  } catch (e) {
    console.error("remark saveMeta", e);
  }

  // 3) Direct Clerk patch (belt + suspenders)
  try {
    const again = await client.users.getUser(studentId);
    const prev = metaOf(again);
    const merged = [
      remark,
      ...(prev.teacherRemarks || []).filter((r) => r.id !== remark.id),
    ].slice(0, 40);
    await client.users.updateUserMetadata(studentId, {
      publicMetadata: {
        ...again.publicMetadata,
        smartlearn: {
          ...prev,
          role: prev.role || "student",
          teacherRemarks: merged,
        },
      },
    });
    setCachedMeta(studentId, {
      ...prev,
      role: prev.role || "student",
      teacherRemarks: merged,
    });
  } catch (e) {
    console.error("remark clerk direct", e);
  }

  if (classCode) {
    try {
      await updateClassroom(teacherId, classCode, (c) => ({
        ...c,
        alerts: pushAlert(c, {
          kind: "remark",
          title: "New teacher remark",
          body: clean.slice(0, 120),
          href: "/remarks",
        }),
      }));
    } catch {
      // non-fatal
    }
  }
  return remark;
}

export async function getStudentRemarks(userId: string) {
  clearClerkWriteCooldown(userId);
  const map = new Map<string, import("@/lib/classroom-types").TeacherRemark>();
  try {
    const { listStudentRemarksFile } = await import("@/lib/remarks-store");
    for (const r of await listStudentRemarksFile(userId)) {
      if (r?.id) map.set(r.id, r);
    }
  } catch {
    // ignore
  }
  try {
    const meta = await getTeacherMeta(userId, { fresh: true });
    for (const r of meta.teacherRemarks || []) {
      if (r?.id) map.set(r.id, r);
    }
  } catch {
    // ignore
  }
  return Array.from(map.values()).sort((a, b) => (b.at || 0) - (a.at || 0));
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
