import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Simple student notes list — journal + getNotes, no early empty.
 * GET /api/classroom/notes?code=XXXX
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const code = (req.nextUrl.searchParams.get("code") || "")
    .trim()
    .toUpperCase();
  if (!code) {
    return NextResponse.json(
      { ok: false, error: "code required", materials: [] },
      { status: 400 }
    );
  }

  const materials: {
    id: string;
    title: string;
    url: string;
    type: string;
    subject: string;
    createdAt: number;
    expiresAt?: number;
    teacherName?: string;
  }[] = [];
  const seen = new Set<string>();

  const push = (list: typeof materials) => {
    for (const m of list || []) {
      if (!m?.url) continue;
      const k = m.id || m.url;
      if (seen.has(k) || seen.has(m.url)) continue;
      seen.add(k);
      seen.add(m.url);
      materials.push(m);
    }
  };

  let name = `Class ${code}`;
  let teacherName = "Teacher";

  // 0) Supabase durable index + storage listing (works on Vercel)
  try {
    const { loadMaterialsIndex } = await import(
      "@/lib/supabase-materials-index"
    );
    const idx = await loadMaterialsIndex(code);
    push(idx.materials as typeof materials);
    if (idx.className) name = idx.className;
    if (idx.teacherName) teacherName = idx.teacherName;
  } catch (e) {
    console.error("notes supabase index", e);
  }

  // 1) Journal (local/mem + supabase merge)
  try {
    const { journalListMaterials } = await import(
      "@/lib/class-materials-journal"
    );
    const j = await journalListMaterials(code);
    push(j.materials as typeof materials);
    if (j.className) name = j.className;
    if (j.teacherName) teacherName = j.teacherName;
  } catch (e) {
    console.error("notes journal", e);
  }

  // 2) Full getNotes merge
  try {
    const { getNotesForClassCode } = await import("@/lib/classroom-server");
    const notes = await getNotesForClassCode(code);
    push(notes.materials as typeof materials);
    name = notes.name || name;
    teacherName = notes.teacherName || teacherName;
  } catch (e) {
    console.error("notes getNotes", e);
  }

  // 3) Class-code index direct
  try {
    const { getClassMaterials } = await import("@/lib/class-code-index");
    push((await getClassMaterials(code)) as typeof materials);
  } catch {
    // ignore
  }

  materials.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return NextResponse.json({
    ok: true,
    code,
    name,
    teacherName,
    materials,
    count: materials.length,
  });
}
