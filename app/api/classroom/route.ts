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
  kickFromLive,
  leaveAttendance,
  leaveClassroomAsStudent,
  listStudentClassrooms,
  listTeacherClassrooms,
  markAttendance,
  postMessage,
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
        const rooms = await listTeacherClassrooms(userId);
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
            url: String(m.url || "").slice(0, 400),
            subject: m.subject,
            createdAt: m.createdAt,
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
            recentMistakes: (s.recentMistakes || []).slice(0, 2),
          })),
          liveSession: r.liveSession
            ? {
                id: r.liveSession.id,
                title: r.liveSession.title,
                subject: r.liveSession.subject,
                startedAt: r.liveSession.startedAt,
                endsAt: r.liveSession.endsAt,
                active: r.liveSession.active,
                joinCode: r.liveSession.joinCode,
                meetUrl: r.liveSession.meetUrl,
                scheduledAt: r.liveSession.scheduledAt,
                messages: (r.liveSession.messages || []).slice(-20),
                attendees: (r.liveSession.attendees || []).slice(0, 40),
                kickedIds: (r.liveSession.kickedIds || []).slice(0, 30),
              }
            : null,
          alerts: (r.alerts || []).slice(0, 8),
          attendanceLog: (r.attendanceLog || []).slice(0, 8),
        }));
        return NextResponse.json({ ok: true, classrooms: safe });
      } catch (e) {
        console.error("mine", e);
        return NextResponse.json({
          ok: true,
          classrooms: [],
          error: e instanceof Error ? e.message : "Load failed",
        });
      }
    }

    if (action === "joined") {
      const classrooms = await listStudentClassrooms(userId);
      const joined = await getStudentJoinedCode(userId);
      const codes = classrooms.map((c) => c.code);
      if (!classrooms.length) {
        return NextResponse.json({
          ok: true,
          joined: null,
          codes: [],
          classrooms: [],
        });
      }
      const primary =
        classrooms.find((x) => x.code === joined) || classrooms[0] || null;
      return NextResponse.json({
        ok: true,
        joined: primary?.code || joined,
        codes,
        classroom: primary,
        classrooms,
        kicked: Boolean(primary?.kicked),
        kickReason: primary?.kickReason,
      });
    }

    if (action === "remarks") {
      const remarks = await getStudentRemarks(userId);
      return NextResponse.json({ ok: true, remarks });
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

    if (action === "materials" && code) {
      const c = code.toUpperCase();
      const map = new Map<string, { id?: string; url?: string; title?: string }>();

      const addAll = (list: unknown[]) => {
        for (const raw of list) {
          const m = raw as { id?: string; url?: string };
          if (!m?.url) continue;
          map.set(m.id || m.url, m);
        }
      };

      // A) Teacher own classes + their materialsIndexUrl
      try {
        const mine = await listTeacherClassrooms(userId);
        const own = mine.find((r) => r.code === c);
        if (own) addAll(own.materials || []);
      } catch {
        // ignore
      }

      // B) Resolve teacher via code index → seed remote materials JSON
      let seedUrl: string | null = null;
      let className = `Class ${c}`;
      try {
        const { lookupTeacherByCode } = await import("@/lib/class-code-index");
        const tid = await lookupTeacherByCode(c);
        if (tid) {
          const { getTeacherMeta, materialsForRoom, getClassroomForTeacher } =
            await import("@/lib/classroom-server");
          const tMeta = await getTeacherMeta(tid);
          seedUrl = tMeta.materialsIndexUrl || null;
          const room = await getClassroomForTeacher(tid, c);
          if (room?.name) className = room.name;
          addAll(materialsForRoom(tMeta, c, room));
          addAll(tMeta.materialBank?.[c] || []);
        }
      } catch {
        // ignore
      }

      // C) Durable materials bank (local + remote JSON)
      try {
        const { getMaterialsByCode } = await import(
          "@/lib/materials-bank-store"
        );
        addAll(await getMaterialsByCode(c, seedUrl));
      } catch {
        // ignore
      }

      // D) Student joined payload
      try {
        const studentRooms = await listStudentClassrooms(userId);
        const hit = studentRooms.find((r) => r.code === c);
        if (hit) {
          if (hit.name) className = hit.name;
          addAll(hit.materials || []);
        }
      } catch {
        // ignore
      }

      const materials = Array.from(map.values()).sort(
        (a, b) =>
          Number((b as { createdAt?: number }).createdAt || 0) -
          Number((a as { createdAt?: number }).createdAt || 0)
      );

      return NextResponse.json({
        ok: true,
        materials,
        code: c,
        name: className,
        count: materials.length,
      });
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
        return NextResponse.json(
          {
            ok: false,
            error:
              e instanceof Error ? e.message : "Could not create class",
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
        Number(body.minutes) || 40,
        body.meetUrl ? String(body.meetUrl) : undefined,
        scheduledAt
      );
      if (!room) {
        return NextResponse.json({ ok: false, error: "Class not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, classroom: room });
    }

    if (action === "endLive") {
      const room = await endLive(userId, String(body.code || ""));
      return NextResponse.json({ ok: true, classroom: room });
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

    if (action === "kickLive") {
      const code = String(body.code || "").trim().toUpperCase();
      const studentId = String(body.studentId || "");
      const reason = body.reason ? String(body.reason).slice(0, 200) : undefined;
      if (!code || !studentId) {
        return NextResponse.json(
          { ok: false, error: "Code and student required" },
          { status: 400 }
        );
      }
      const room = await kickFromLive(userId, code, studentId, reason);
      if (!room) {
        return NextResponse.json(
          { ok: false, error: "Class not found or no live session" },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, classroom: room });
    }

    if (action === "message") {
      const code = String(body.code || "").trim().toUpperCase();
      const text = String(body.text || "").trim();
      if (!text) {
        return NextResponse.json({ ok: false, error: "Empty message" }, { status: 400 });
      }
      const found = await findClassroomByCode(code);
      if (!found) {
        return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 404 });
      }
      const author =
        String(body.author || "") ||
        user?.fullName ||
        user?.firstName ||
        "User";
      const room = await postMessage(found.teacherId, code, author, text);
      return NextResponse.json({ ok: true, classroom: room });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    console.error("classroom API", message);
    return NextResponse.json(
      {
        ok: false,
        error: /too many|429/i.test(message)
          ? "Server busy — try again in a few seconds."
          : message,
      },
      { status: 200 }
    );
  }
}
