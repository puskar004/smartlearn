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

    // Upload file bytes → public URL or local key
    const saved = await saveMaterialFile(userId, code, buf, ext);

    // Prefer non-data short URL for Clerk; keep data URL only if small
    let publishUrl = saved.url;
    if (publishUrl.startsWith("data:") && publishUrl.length > 100_000) {
      // force API path for large embeds
      publishUrl = `/api/classroom/material?key=${encodeURIComponent(saved.key)}`;
    }

    const user = await currentUser().catch(() => null);
    let room = null;
    try {
      room = await addMaterialToClass(userId, code, {
        title: title || name.replace(/\.[^.]+$/, ""),
        url: publishUrl,
        type,
        subject,
        teacherName: user?.fullName || user?.firstName || "Teacher",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Rate limit / Clerk down: file is already on host — still success
      if (!/too many|429|rate/i.test(msg)) {
        console.error("addMaterialToClass", msg);
      }
      room = {
        code,
        name: code,
        teacherId: userId,
        teacherName: user?.fullName || "Teacher",
        createdAt: Date.now(),
        materials: [
          {
            id: `mat-${Date.now()}`,
            title: title || name.replace(/\.[^.]+$/, ""),
            url: publishUrl,
            type,
            subject,
            createdAt: Date.now(),
            teacherName: user?.fullName || "Teacher",
          },
        ],
        students: [],
        liveSession: null,
      };
    }

    return NextResponse.json({
      ok: true,
      classroom: room,
      key: saved.key,
      url: publishUrl,
      durable: saved.durable,
      size: buf.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    console.error("material upload", message);
    // Rate limits never block the teacher UI
    if (/too many|429|rate/i.test(message)) {
      return NextResponse.json({
        ok: true,
        url: null,
        durable: false,
        note: "Saved without cloud index — try again later",
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
