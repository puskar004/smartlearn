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
/** Allow up to ~5.5MB multipart on Node runtime */
export const maxDuration = 60;

/** Serve stored PDF when local key still exists (same instance). Prefer durable https URLs. */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const key = req.nextUrl.searchParams.get("key") || "";
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }
  // If key is actually a full URL (legacy), redirect
  if (key.startsWith("http://") || key.startsWith("https://")) {
    return NextResponse.redirect(key);
  }
  const hit = await readMaterialFile(key);
  if (!hit) {
    return NextResponse.json(
      {
        error:
          "File not found on server (expired after deploy). Ask teacher to re-upload the PDF, or use a Google Drive link.",
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

/**
 * Multipart upload: code, title, subject, type, file (PDF up to 5MB)
 * Prefers durable remote URL so students can always open.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const code = String(form.get("code") || "").trim().toUpperCase();
    const title = String(form.get("title") || "").trim();
    const subject = String(form.get("subject") || "General").trim() || "General";
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
          error: `PDF too large (max ${Math.round(max / (1024 * 1024))}MB). Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`,
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

    const saved = await saveMaterialFile(userId, code, buf, ext);

    const user = await currentUser();
    const room = await addMaterialToClass(userId, code, {
      title: title || name.replace(/\.[^.]+$/, ""),
      url: saved.url,
      type,
      subject,
      teacherName: user?.fullName || user?.firstName || "Teacher",
    });

    if (!room) {
      return NextResponse.json(
        { ok: false, error: "Class not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      classroom: room,
      key: saved.key,
      url: saved.url,
      durable: saved.durable,
      size: buf.length,
      note: saved.durable
        ? undefined
        : "File stored temporarily — prefer Google Drive link if students cannot open later.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    console.error("material upload", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
