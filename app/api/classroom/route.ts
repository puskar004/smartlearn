import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  addMaterialToClass,
  createClassroomForTeacher,
  deleteClassroom,
  endLive,
  findClassroomByCode,
  getStudentJoinedCode,
  getStudentRemarks,
  joinClassroomAsStudent,
  leaveAttendance,
  leaveClassroomAsStudent,
  listStudentClassrooms,
  listTeacherClassrooms,
  markAttendance,
  pushStudentToClass,
  pushTeacherRemark,
  renameClassroom,
  setUserRole,
  startLive,
} from "@/lib/classroom-server";
import type { StudentSnapshot } from "@/lib/classroom-types";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Sign in required" },
        { status: 401 }
      );
    }

    const sp = req.nextUrl.searchParams;
    const action = sp.get("action") || "list";
    const code = sp.get("code") || "";

    if (action === "lookup" && code) {
      try {
        const found = await findClassroomByCode(code);
        if (!found) {
          return NextResponse.json({
            ok: false,
            error: "Invalid class code",
          });
        }
        return NextResponse.json({
          ok: true,
          classroom: {
            code: found.classroom.code,
            name: found.classroom.name,
            teacherName: found.classroom.teacherName,
          },
        });
      } catch (e) {
        return NextResponse.json({
          ok: false,
          error: e instanceof Error ? e.message : "Lookup failed",
        });
      }
    }

    if (action === "mine") {
      try {
        const fresh = sp.get("fresh") === "1" || sp.get("fresh") === "true";
        const rooms = await listTeacherClassrooms(userId, { fresh });
        // Slim payload — avoid huge student/log blobs crashing the response
        const safe = (rooms || []).map((r) => ({
          code: r.code,
          name: r.name,
          teacherId: r.teacherId,
          teacherName: r.teacherName,
          createdAt: r.createdAt,
          materials: (r.materials || []).slice(0, 30).map((m) => ({
            id: m.id,
            title: m.title,
            type: m.type,
            // Keep full URL so Open/PDF proxy works (was truncating → 404)
            url: String(m.url || "").slice(0, 4000),
            subject: m.subject,
            createdAt: m.createdAt,
            expiresAt: m.expiresAt,
            teacherName: m.teacherName,
          })),
          students: (r.students || []).slice(0, 50).map((s) => ({
            studentId: s.studentId,
            name: s.name,
            email: s.email,
            grade: s.grade,
            xp: s.xp,
            streak: s.streak,
            accuracy: s.accuracy,
            mistakes: s.mistakes,
            weakSubjects: (s.weakSubjects || []).slice(0, 5),
            chaptersOpened: s.chaptersOpened,
            lastActive: s.lastActive,
            joinedAt: s.joinedAt || s.lastActive,
            recentMistakes: (s.recentMistakes || []).slice(0, 2),
          })),
          liveSession: r.liveSession
            ? {
                id: r.liveSession.id,
                title: r.liveSession.title,
                subject: r.liveSession.subject,
                startedAt: r.liveSession.startedAt,
                endsAt: r.liveSession.endsAt,
                joinUntil:
                  r.liveSession.joinUntil || r.liveSession.endsAt,
                active: r.liveSession.active,
                joinCode: r.liveSession.joinCode,
                meetUrl: r.liveSession.meetUrl,
                scheduledAt: r.liveSession.scheduledAt,
                messages: (r.liveSession.messages || []).slice(-20),
                attendees: (r.liveSession.attendees || []).slice(0, 80),
                kickedIds: (r.liveSession.kickedIds || []).slice(0, 40),
                kickReasons: r.liveSession.kickReasons || {},
              }
            : null,
          alerts: (r.alerts || []).slice(0, 8),
          attendanceLog: (r.attendanceLog || []).slice(0, 20).map((rec) => ({
            ...rec,
            attendees: (rec.attendees || []).slice(0, 80),
          })),
        }));
        return NextResponse.json({ ok: true, classrooms: safe });
      } catch (e) {
        console.error("mine", e);
        const msg = e instanceof Error ? e.message : "Load failed";
        const rate = /too many|429|rate/i.test(msg);
        // Never push rate-limit text to UI — empty list + ok keeps client cache
        return NextResponse.json({
          ok: true,
          classrooms: [],
          rateLimited: rate,
        });
      }
    }

    // Lightweight live check by class codes (student banner / live page)
    if (action === "liveStatus") {
      const codes = (sp.get("codes") || "")
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 12);
      const { lookupClassLive } = await import("@/lib/class-code-index");
      const sessions: {
        code: string;
        active: boolean;
        title?: string;
        subject?: string;
        meetUrl?: string;
        className?: string;
        teacherName?: string;
        startedAt?: number;
        endsAt?: number;
        joinUntil?: number;
      }[] = [];
      for (const c of codes) {
        const looked = await lookupClassLive(c);
        if (looked.status === "active") {
          sessions.push({
            code: c,
            active: true,
            title: looked.live.title,
            subject: looked.live.subject,
            meetUrl: looked.live.meetUrl,
            className: looked.live.className,
            teacherName: looked.live.teacherName,
            startedAt: looked.live.startedAt,
            endsAt: looked.live.endsAt,
            joinUntil:
              looked.live.joinUntil ||
              (looked.live.startedAt || Date.now()) + 15 * 60_000,
          });
          continue;
        }
        // Fallback: teacher Clerk room by code index
        try {
          const found = await findClassroomByCode(c);
          if (!found) continue;
          const sess = found.classroom.liveSession;
          if (sess?.active) {
            sessions.push({
              code: c,
              active: true,
              title: sess.title,
              subject: sess.subject,
              meetUrl: sess.meetUrl,
              className: found.classroom.name,
              teacherName: found.classroom.teacherName,
              startedAt: sess.startedAt,
              joinUntil:
                sess.joinUntil ||
                (sess.startedAt || Date.now()) + 15 * 60_000,
              endsAt: sess.endsAt,
            });
          }
        } catch {
          // ignore
        }
      }
      return NextResponse.json({
        ok: true,
        sessions,
        live: sessions[0] || null,
      });
    }

    if (action === "joined") {
      // Client may pass localStorage codes so live works even if Clerk join meta lagged
      const extraCodes = (sp.get("codes") || "")
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 12);

      let classrooms = await listStudentClassrooms(userId);
      const joined = await getStudentJoinedCode(userId);

      // Merge any extra codes not already listed (from browser join cache)
      const have = new Set(classrooms.map((c) => c.code));
      for (const c of extraCodes) {
        if (have.has(c)) continue;
        try {
          const found = await findClassroomByCode(c);
          if (!found) {
            const { lookupClassLive } = await import("@/lib/class-code-index");
            const looked = await lookupClassLive(c);
            if (looked.status === "active") {
              const live = looked.live;
              classrooms.push({
                code: c,
                name: live.className || `Class ${c}`,
                teacherName: live.teacherName || "Teacher",
                materials: [],
                liveSession: {
                  id: live.id,
                  title: live.title,
                  subject: live.subject,
                  meetUrl: live.meetUrl,
                  joinCode: live.joinCode,
                  active: true,
                  startedAt: live.startedAt,
                  endsAt: live.endsAt,
                  joinUntil: live.joinUntil || live.endsAt,
                  scheduledAt: live.scheduledAt,
                  messages: [],
                  attendees: [],
                },
                alerts: [],
              });
              have.add(c);
            }
            continue;
          }
          const { lookupClassLive } = await import("@/lib/class-code-index");
          const looked = await lookupClassLive(c);
          let sess = found.classroom.liveSession?.active
            ? found.classroom.liveSession
            : found.classroom.liveSession;
          if (looked.status === "active") {
            const live = looked.live;
            sess = {
              id: live.id,
              title: live.title,
              subject: live.subject,
              meetUrl: live.meetUrl,
              joinCode: live.joinCode,
              active: true,
              startedAt: live.startedAt,
              endsAt: live.endsAt,
              joinUntil: live.joinUntil || live.endsAt,
              scheduledAt: live.scheduledAt,
              messages: found.classroom.liveSession?.messages || [],
              attendees: found.classroom.liveSession?.attendees || [],
            };
          } else if (looked.status === "ended") {
            sess = null;
          }
          classrooms.push({
            code: found.classroom.code,
            name: found.classroom.name || `Class ${c}`,
            teacherName: found.classroom.teacherName || "Teacher",
            materials: found.classroom.materials || [],
            liveSession: sess,
            alerts: found.classroom.alerts || [],
          });
          have.add(c);
        } catch {
          // ignore one code
        }
      }

      // Overlay shared live — ONLY clear on explicit "ended", never on miss
      try {
        const { lookupClassLive } = await import("@/lib/class-code-index");
        classrooms = await Promise.all(
          classrooms.map(async (room) => {
            const looked = await lookupClassLive(room.code);
            if (looked.status === "ended") {
              return { ...room, liveSession: null };
            }
            if (looked.status === "active") {
              const live = looked.live;
              return {
                ...room,
                name: live.className || room.name,
                teacherName: live.teacherName || room.teacherName,
                liveSession: {
                  id: live.id,
                  title: live.title,
                  subject: live.subject,
                  meetUrl: live.meetUrl,
                  joinCode: live.joinCode,
                  active: true,
                  startedAt: live.startedAt,
                  endsAt: live.endsAt,
                  joinUntil: live.joinUntil || live.endsAt,
                  scheduledAt: live.scheduledAt,
                  messages: room.liveSession?.messages || [],
                  attendees: room.liveSession?.attendees || [],
                },
              };
            }
            // none — keep Clerk/room liveSession as-is
            return room;
          })
        );
      } catch {
        // ignore
      }

      // Drop teacher-deleted classes from response
      let deleted: string[] = [];
      try {
        const { getDeletedCodes } = await import("@/lib/class-code-index");
        const check = [
          ...classrooms.map((c) => c.code),
          ...extraCodes,
          ...(joined ? [joined] : []),
        ];
        deleted = await getDeletedCodes(check);
        if (deleted.length) {
          const del = new Set(deleted);
          classrooms = classrooms.filter((c) => !del.has(c.code));
        }
      } catch {
        // ignore
      }

      const codes = classrooms.map((c) => c.code);
      if (!classrooms.length) {
        return NextResponse.json({
          ok: true,
          joined: null,
          codes: [],
          classrooms: [],
          deleted,
        });
      }
      const primary =
        classrooms.find((x) => x.liveSession?.active) ||
        classrooms.find((x) => x.code === joined) ||
        classrooms.find((x) => extraCodes.includes(x.code)) ||
        classrooms[0] ||
        null;
      return NextResponse.json({
        ok: true,
        joined: primary?.code || joined || extraCodes[0] || null,
        codes,
        classroom: primary,
        classrooms,
        kicked: Boolean(primary?.kicked),
        kickReason: primary?.kickReason,
        deleted,
      });
    }

    if (action === "remarks") {
      try {
        const remarks = await getStudentRemarks(userId);
        return NextResponse.json({
          ok: true,
          remarks,
          count: remarks.length,
        });
      } catch (e) {
        console.error("remarks get", e);
        return NextResponse.json({ ok: true, remarks: [], count: 0 });
      }
    }

    if (action === "room" && code) {
      const rooms = await listTeacherClassrooms(userId);
      const room = rooms.find((r) => r.code === code.toUpperCase());
      if (!room) {
        const found = await findClassroomByCode(code);
        if (!found || found.teacherId !== userId) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json({ ok: true, classroom: found.classroom });
      }
      return NextResponse.json({ ok: true, classroom: room });
    }

    if (
      (action === "materials" || action === "notes") &&
      code
    ) {
      const c = code.toUpperCase();
      try {
        const { getNotesForClassCode } = await import(
          "@/lib/classroom-server"
        );
        const notes = await getNotesForClassCode(c);

        // Always union journal (append-only uploads) so 2nd/3rd PDF never missing
        try {
          const { journalListMaterials } = await import(
            "@/lib/class-materials-journal"
          );
          const j = await journalListMaterials(c);
          if (j.materials?.length) {
            const map = new Map<string, (typeof notes.materials)[0]>();
            for (const m of [...j.materials, ...notes.materials]) {
              if (!m?.url) continue;
              const k = m.id || m.url;
              const p = map.get(k);
              if (!p || (m.createdAt || 0) >= (p.createdAt || 0)) map.set(k, m);
            }
            notes.materials = Array.from(map.values()).sort(
              (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
            );
            if (j.className) notes.name = j.className || notes.name;
            if (j.teacherName)
              notes.teacherName = j.teacherName || notes.teacherName;
          }
        } catch {
          // ignore
        }

        // Teacher own view fallback
        if (!notes.materials.length) {
          try {
            const mine = await listTeacherClassrooms(userId);
            const own = mine.find((r) => r.code === c);
            if (own?.materials?.length) {
              notes.materials = own.materials;
              notes.name = own.name || notes.name;
              notes.teacherName = own.teacherName || notes.teacherName;
            }
          } catch {
            // ignore
          }
        }

        return NextResponse.json({
          ok: true,
          materials: notes.materials,
          code: notes.code,
          name: notes.name,
          teacherName: notes.teacherName,
          count: notes.materials.length,
          ttlHours: 24,
        });
      } catch (e) {
        console.error("materials", e);
        return NextResponse.json({
          ok: true,
          materials: [],
          code: c,
          name: `Class ${c}`,
          count: 0,
          ttlHours: 48,
        });
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Sign in required" },
        { status: 401 }
      );
    }

    const user = await currentUser();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    if (action === "setRole") {
      const role = body.role === "teacher" ? "teacher" : "student";
      await setUserRole(userId, role);
      return NextResponse.json({ ok: true, role });
    }

    if (action === "create") {
      try {
        const room = await createClassroomForTeacher(
          userId,
          user?.fullName || user?.firstName || "Teacher",
          String(body.name || "My Class")
        );
        return NextResponse.json({ ok: true, classroom: room });
      } catch (e) {
        console.error("create classroom", e);
        const msg = e instanceof Error ? e.message : "Could not create class";
        const rate = /too many|429|rate/i.test(msg);
        return NextResponse.json(
          {
            ok: false,
            error: rate
              ? "Server busy — wait 30s and try Create again. Your other data is safe."
              : msg,
            rateLimited: rate,
          },
          { status: 200 }
        );
      }
    }

    if (action === "rename") {
      const code = String(body.code || "");
      const name = String(body.name || "").trim();
      if (!code || !name) {
        return NextResponse.json(
          { ok: false, error: "Code and name required" },
          { status: 400 }
        );
      }
      const room = await renameClassroom(userId, code, name);
      if (!room) {
        return NextResponse.json(
          { ok: false, error: "Class not found or empty name" },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, classroom: room });
    }

    if (action === "delete") {
      const code = String(body.code || "");
      if (!code) {
        return NextResponse.json(
          { ok: false, error: "Code required" },
          { status: 400 }
        );
      }
      const res = await deleteClassroom(userId, code);
      return NextResponse.json(res, { status: res.ok ? 200 : 404 });
    }

    if (action === "leave") {
      const code = body.code ? String(body.code) : undefined;
      const res = await leaveClassroomAsStudent(userId, code);
      return NextResponse.json(res);
    }

    if (action === "remark") {
      const studentId = String(body.studentId || "");
      const text = String(body.text || "");
      if (!studentId || !text.trim()) {
        return NextResponse.json(
          { ok: false, error: "Student and feedback required" },
          { status: 400 }
        );
      }
      const remark = await pushTeacherRemark(
        userId,
        user?.fullName || user?.firstName || "Teacher",
        studentId,
        text,
        body.classCode ? String(body.classCode) : undefined,
        body.className ? String(body.className) : undefined
      );
      return NextResponse.json({ ok: true, remark });
    }

    if (action === "join") {
      const code = String(body.code || "").trim().toUpperCase();
      const snapshot = body.snapshot as StudentSnapshot | undefined;
      if (!code || !snapshot) {
        return NextResponse.json(
          { ok: false, error: "Code and student snapshot required" },
          { status: 200 }
        );
      }
      try {
        const res = await joinClassroomAsStudent(code, {
          ...snapshot,
          studentId: userId,
          name:
            snapshot.name ||
            user?.fullName ||
            user?.firstName ||
            "Student",
          email:
            snapshot.email ||
            user?.emailAddresses?.[0]?.emailAddress ||
            undefined,
        });
        return NextResponse.json(res, { status: 200 });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Join failed";
        return NextResponse.json(
          { ok: false, error: message },
          { status: 200 }
        );
      }
    }

    if (action === "sync") {
      const code = String(body.code || "").trim().toUpperCase();
      const snapshot = body.snapshot as StudentSnapshot;
      if (!code || !snapshot) {
        return NextResponse.json({ ok: false, error: "Missing data" }, { status: 400 });
      }
      const res = await pushStudentToClass(code, {
        ...snapshot,
        studentId: userId,
      });
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
    }

    if (action === "addMaterial") {
      const code = String(body.code || "");
      const material = body.material;
      const room = await addMaterialToClass(userId, code, material);
      if (!room) {
        return NextResponse.json({ ok: false, error: "Class not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, classroom: room });
    }

    if (action === "startLive") {
      const scheduledAt = body.scheduledAt
        ? Number(body.scheduledAt)
        : undefined;
      const room = await startLive(
        userId,
        String(body.code || ""),
        String(body.title || "Live session"),
        String(body.subject || "General"),
        0,
        body.meetUrl ? String(body.meetUrl) : undefined,
        scheduledAt
      );
      if (!room) {
        return NextResponse.json({ ok: false, error: "Class not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, classroom: room });
    }

    if (action === "endLive") {
      const code = String(body.code || "").trim().toUpperCase();
      const room = await endLive(userId, code);
      if (!room) {
        // Still clear shared live so students stop seeing Meet
        try {
          const { publishClassLive } = await import("@/lib/class-code-index");
          await publishClassLive(code, userId, null);
        } catch {
          // ignore
        }
        return NextResponse.json({
          ok: true,
          classroom: null,
          ended: true,
        });
      }
      return NextResponse.json({
        ok: true,
        classroom: { ...room, liveSession: null },
        ended: true,
      });
    }

    if (action === "attend") {
      const code = String(body.code || "").trim().toUpperCase();
      if (!code) {
        return NextResponse.json({ ok: false, error: "Code required" }, { status: 400 });
      }
      const name =
        String(body.name || "") ||
        user?.fullName ||
        user?.firstName ||
        "Student";
      const room = await markAttendance(code, userId, name);
      if (!room) {
        return NextResponse.json({ ok: false, error: "Class not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, classroom: room });
    }

    if (action === "leaveAttend") {
      const code = String(body.code || "").trim().toUpperCase();
      if (!code) {
        return NextResponse.json({ ok: false, error: "Code required" }, { status: 400 });
      }
      const room = await leaveAttendance(code, userId);
      return NextResponse.json({ ok: true, classroom: room });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("classroom API", message);
    // Never return 429-looking errors to UI — soft fail
    return NextResponse.json(
      {
        ok: false,
        error: /too many|429|rate/i.test(message)
          ? "Temporarily delayed — your data is kept locally. Retry in a moment."
          : message,
        rateLimited: /too many|429|rate/i.test(message),
      },
      { status: 200 }
    );
  }
}
