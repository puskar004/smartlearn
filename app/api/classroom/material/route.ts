import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { addMaterialToClass } from "@/lib/classroom-server";
import {
  materialMaxBytes,
  readMaterialFile,
  saveMaterialFile,
} from "@/lib/material-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Serve stored PDF by key (signed-in students/teachers) */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const key = req.nextUrl.searchParams.get("key") || "";
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }
  // If someone stored a full URL as key, proxy-fetch PDF bytes
  if (key.startsWith("http://") || key.startsWith("https://")) {
    try {
      const origin = req.nextUrl.origin;
      const proxy = `${origin}/api/pdf-proxy?url=${encodeURIComponent(key)}`;
      const res = await fetch(proxy, { cache: "no-store" });
      if (res.ok) {
        return new NextResponse(res.body, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'inline; filename="notes.pdf"',
            "Cache-Control": "private, max-age=600",
          },
        });
      }
    } catch {
      // fall through
    }
    return NextResponse.json({ error: "Could not load remote PDF" }, { status: 502 });
  }
  const hit = await readMaterialFile(key);
  if (!hit) {
    return NextResponse.json(
      {
        error:
          "File not found. Ask teacher to re-upload, or use a Google Drive link.",
      },
      { status: 404 }
    );
  }
  return new NextResponse(new Uint8Array(hit.buf), {
    headers: {
      "Content-Type": hit.contentType,
      "Content-Disposition": `inline; filename="${key.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

/** Multipart PDF upload */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const code = String(form.get("code") || "").trim().toUpperCase();
    const title = String(form.get("title") || "").trim();
    const subject =
      String(form.get("subject") || "General").trim() || "General";
    const typeRaw = String(form.get("type") || "notes");
    const type =
      typeRaw === "video" || typeRaw === "link" ? typeRaw : "notes";
    const file = form.get("file");

    if (!code || !title) {
      return NextResponse.json(
        { ok: false, error: "Class code and title required" },
        { status: 400 }
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "PDF file required" },
        { status: 400 }
      );
    }

    const max = materialMaxBytes();
    if (file.size > max) {
      return NextResponse.json(
        {
          ok: false,
          error: `PDF too large (max ${Math.round(max / (1024 * 1024))}MB).`,
        },
        { status: 413 }
      );
    }

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    const name = file.name || "notes.pdf";
    const ext = name.split(".").pop()?.toLowerCase() || "pdf";
    if (!["pdf", "png", "jpg", "jpeg", "webp"].includes(ext)) {
      return NextResponse.json(
        { ok: false, error: "Only PDF or image notes allowed" },
        { status: 400 }
      );
    }

    // Durable public URL only (Blob / free host / tiny data:) — no same-server fake success
    const saved = await saveMaterialFile(userId, code, buf, ext);
    const publishUrl = saved.url;

    if (!publishUrl || !saved.durable) {
      return NextResponse.json(
        {
          ok: false,
          durable: false,
          error:
            "Upload failed. Check SUPABASE_SERVICE_ROLE_KEY + public bucket class-materials, or paste a Google Drive link. Student: Refresh materials.",
        },
        { status: 200 }
      );
    }

    const user = await currentUser().catch(() => null);
    const teacherName = user?.fullName || user?.firstName || "Teacher";
    const now = Date.now();
    const mat = {
      id: `mat-${now}-${Math.random().toString(36).slice(2, 6)}`,
      title: title || name.replace(/\.[^.]+$/, ""),
      url: publishUrl,
      type: type as "notes" | "video" | "link",
      subject,
      createdAt: now,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
      teacherName,
    };

    // Dedupe: same title+url within last 60s = double-click
    // (handled after publish merge below)

    // 0) JOURNAL FIRST (local+mem fast; remote mirror async inside journal)
    let journalMats: typeof mat[] = [mat];
    try {
      const { journalAppendMaterial } = await import(
        "@/lib/class-materials-journal"
      );
      journalMats = (await journalAppendMaterial(code, mat, {
        teacherId: userId,
        teacherName,
        className: code,
      })) as typeof mat[];
    } catch (e) {
      console.error("journalAppendMaterial", e);
    }

    // 1+2) Clerk + class-code index — background (do not block teacher response)
    void (async () => {
      try {
        await addMaterialToClass(userId, code, {
          title: mat.title,
          url: publishUrl,
          type: mat.type,
          subject,
          teacherName,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/too many|429|rate/i.test(msg)) {
          console.error("addMaterialToClass", msg);
        }
      }
      try {
        const { publishClassMaterials, registerClassCode } = await import(
          "@/lib/class-code-index"
        );
        await registerClassCode(code, userId);
        await publishClassMaterials(
          code,
          userId,
          journalMats.length ? journalMats : [mat],
          teacherName
        );
      } catch (e) {
        console.error("publishClassMaterials bg", e);
      }
    })();

    const allMats = journalMats.length ? journalMats : [mat];
    const room = {
      code,
      name: code,
      teacherId: userId,
      teacherName,
      createdAt: now,
      materials: allMats,
      students: [] as never[],
      liveSession: null,
      alerts: [] as never[],
      attendanceLog: [] as never[],
    };

    return NextResponse.json({
      ok: true,
      classroom: room,
      key: saved.key,
      url: publishUrl,
      durable: saved.durable,
      storage: saved.storage || null,
      size: buf.length,
      studentVisible: allMats.length,
      ttlHours: 30 * 24,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    console.error("material upload", message);
    if (/too many|429|rate/i.test(message)) {
      return NextResponse.json({
        ok: false,
        durable: false,
        error: "Server busy — wait a few seconds and upload again.",
      });
    }
    return NextResponse.json(
      {
        ok: false,
        error: message.includes("Unprocessable")
          ? "Could not save. Try a smaller PDF or Drive link."
          : message,
      },
      { status: 200 }
    );
  }
}
