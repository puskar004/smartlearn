import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  addMaterialToClass,
  createClassroomForTeacher,
  endLive,
  findClassroomByCode,
  getStudentJoinedCode,
  joinClassroomAsStudent,
  listTeacherClassrooms,
  postMessage,
  pushStudentToClass,
  setUserRole,
  startLive,
} from "@/lib/classroom-server";
import type { StudentSnapshot } from "@/lib/classroom-types";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const action = sp.get("action") || "list";
  const code = sp.get("code") || "";

  try {
    if (action === "lookup" && code) {
      const found = await findClassroomByCode(code);
      if (!found) {
        return NextResponse.json({
          ok: false,
          error: "Invalid class code",
        });
      }
      // don't leak full student list on public lookup — only name/code
      return NextResponse.json({
        ok: true,
        classroom: {
          code: found.classroom.code,
          name: found.classroom.name,
          teacherName: found.classroom.teacherName,
        },
      });
    }

    if (action === "mine") {
      const rooms = await listTeacherClassrooms(userId);
      return NextResponse.json({ ok: true, classrooms: rooms });
    }

    if (action === "joined") {
      const joined = await getStudentJoinedCode(userId);
      if (!joined) return NextResponse.json({ ok: true, joined: null });
      const found = await findClassroomByCode(joined);
      return NextResponse.json({
        ok: true,
        joined,
        classroom: found
          ? {
              code: found.classroom.code,
              name: found.classroom.name,
              teacherName: found.classroom.teacherName,
              materials: found.classroom.materials || [],
              liveSession: found.classroom.liveSession,
            }
          : null,
      });
    }

    if (action === "room" && code) {
      const rooms = await listTeacherClassrooms(userId);
      const room = rooms.find((r) => r.code === code.toUpperCase());
      if (!room) {
        // allow teacher who owns it only
        const found = await findClassroomByCode(code);
        if (!found || found.teacherId !== userId) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json({ ok: true, classroom: found.classroom });
      }
      return NextResponse.json({ ok: true, classroom: room });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const user = await currentUser();
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  try {
    if (action === "setRole") {
      const role = body.role === "teacher" ? "teacher" : "student";
      await setUserRole(userId, role);
      return NextResponse.json({ ok: true, role });
    }

    if (action === "create") {
      await setUserRole(userId, "teacher");
      const room = await createClassroomForTeacher(
        userId,
        user?.fullName || user?.firstName || "Teacher",
        String(body.name || "My Class")
      );
      return NextResponse.json({ ok: true, classroom: room });
    }

    if (action === "join") {
      const code = String(body.code || "").trim().toUpperCase();
      const snapshot = body.snapshot as StudentSnapshot | undefined;
      if (!code || !snapshot) {
        return NextResponse.json(
          { ok: false, error: "Code and student snapshot required" },
          { status: 400 }
        );
      }
      // force student id from auth
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
      return NextResponse.json(res, { status: res.ok ? 200 : 400 });
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
      const room = await startLive(
        userId,
        String(body.code || ""),
        String(body.title || "Live session"),
        String(body.subject || "General"),
        Number(body.minutes) || 40
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

    if (action === "message") {
      // teacher posts as owner; students post via finding class
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
