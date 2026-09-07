import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  decodeDataUrl,
  hostAllowed,
  isPdfBytes,
  resolvePdfBytes,
} from "@/lib/pdf-fetch";
import { readMaterialFile } from "@/lib/material-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function pdfResponse(bytes: Uint8Array, name = "notes.pdf") {
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function bytesFromMaterialUrl(
  rawUrl: string,
  origin: string
): Promise<Uint8Array | null> {
  const url = String(rawUrl || "").trim();
  if (!url) return null;

  if (url.startsWith("data:")) {
    const b = decodeDataUrl(url);
    return b && isPdfBytes(b) ? b : null;
  }

  // Our own material key API
  if (url.includes("/api/classroom/material") && url.includes("key=")) {
    try {
      const u = new URL(url, origin);
      const key = u.searchParams.get("key") || "";
      if (key) {
        const hit = await readMaterialFile(key);
        if (hit?.buf && isPdfBytes(new Uint8Array(hit.buf))) {
          return new Uint8Array(hit.buf);
        }
      }
    } catch {
      // ignore
    }
  }

  if (url.startsWith("/api/classroom/material?key=")) {
    const key = decodeURIComponent(url.split("key=")[1] || "");
    const hit = await readMaterialFile(key);
    if (hit?.buf && isPdfBytes(new Uint8Array(hit.buf))) {
      return new Uint8Array(hit.buf);
    }
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const host = new URL(url).hostname;
      if (!hostAllowed(host)) return null;
    } catch {
      return null;
    }
    return resolvePdfBytes(url);
  }

  return null;
}

/**
 * Same-origin PDF open for students/teachers.
 * ?code=&id=  → look up material in class bank / teacher meta
 * ?url=       → fetch that URL (http or data handled server-side for short urls)
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const code = (sp.get("code") || "").trim().toUpperCase();
  const id = (sp.get("id") || "").trim();
  const directUrl = sp.get("url") || "";
  const origin = req.nextUrl.origin;

  try {
    // A) Direct URL path
    if (directUrl) {
      // data: may be huge — only if short enough for query (rare)
      const b = await bytesFromMaterialUrl(directUrl, origin);
      if (b) return pdfResponse(b);
      return NextResponse.json(
        {
          error: "Could not open PDF",
          detail: "Link expired or blocked. Ask teacher to re-upload.",
        },
        { status: 502 }
      );
    }

    if (!code) {
      return NextResponse.json({ error: "code required" }, { status: 400 });
    }

    // B) Resolve material list for class, then pick by id
    const candidates: { id?: string; url?: string; title?: string }[] = [];

    try {
      const { getMaterialsByCode } = await import(
        "@/lib/materials-bank-store"
      );
      const bank = await getMaterialsByCode(code);
      if (bank?.length) candidates.push(...bank);
    } catch {
      // ignore
    }

    try {
      const { lookupTeacherByCode } = await import("@/lib/class-code-index");
      const tid = await lookupTeacherByCode(code);
      if (tid) {
        const { getTeacherMeta, materialsForRoom, getClassroomForTeacher } =
          await import("@/lib/classroom-server");
        const meta = await getTeacherMeta(tid);
        const room = await getClassroomForTeacher(tid, code);
        candidates.push(...(materialsForRoom(meta, code, room) || []));
        candidates.push(...(meta.materialBank?.[code] || []));
      }
    } catch {
      // ignore
    }

    // Teacher viewing own class
    try {
      const { listTeacherClassrooms } = await import("@/lib/classroom-server");
      const mine = await listTeacherClassrooms(userId);
      const own = mine.find((r) => r.code === code);
      if (own?.materials) candidates.push(...own.materials);
    } catch {
      // ignore
    }

    const uniq = new Map<string, { id?: string; url?: string; title?: string }>();
    for (const m of candidates) {
      if (!m?.url) continue;
      const key = m.id || m.url;
      if (!uniq.has(key)) uniq.set(key, m);
    }
    const list = Array.from(uniq.values());
    const hit =
      (id && list.find((m) => m.id === id)) ||
      (id && list.find((m) => (m.url || "").includes(id))) ||
      list[0];

    if (!hit?.url) {
      return NextResponse.json(
        {
          error: "Material not found",
          detail: "Refresh materials, or ask teacher to re-upload the PDF.",
        },
        { status: 404 }
      );
    }

    const bytes = await bytesFromMaterialUrl(hit.url, origin);
    if (!bytes) {
      return NextResponse.json(
        {
          error: "Could not open PDF",
          detail:
            "File host expired or blocked. Teacher must re-upload this PDF.",
        },
        { status: 502 }
      );
    }
    return pdfResponse(
      bytes,
      `${(hit.title || "notes").replace(/[^\w.-]+/g, "_").slice(0, 40)}.pdf`
    );
  } catch (e) {
    console.error("classroom pdf", e);
    return NextResponse.json(
      {
        error: "PDF open failed",
        detail: e instanceof Error ? e.message : "Server error",
      },
      { status: 500 }
    );
  }
}
