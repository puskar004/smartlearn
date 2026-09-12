/**
 * Append-only per-class materials journal.
 * Guarantees every teacher upload is readable for students even when
 * Clerk/remote index lags or drops entries.
 */
import { promises as fs } from "fs";
import path from "path";
import type { TeacherMaterial } from "@/lib/classroom-types";
import { uploadBufferRemote } from "@/lib/remote-upload";

type Journal = {
  code: string;
  teacherId?: string;
  teacherName?: string;
  className?: string;
  materials: TeacherMaterial[];
  updatedAt: number;
  remoteUrl?: string;
};

const mem = new Map<string, Journal>();

function dir() {
  return process.env.VERCEL
    ? "/tmp/smartlearn-mat-journal"
    : path.join(process.cwd(), ".data", "mat-journal");
}

function localPath(code: string) {
  return path.join(dir(), `${code.toUpperCase()}.json`);
}

function pointerPath(code: string) {
  return localPath(code) + ".remote";
}

async function readLocal(code: string): Promise<Journal | null> {
  try {
    const raw = await fs.readFile(localPath(code), "utf8");
    const j = JSON.parse(raw) as Journal;
    if (j && Array.isArray(j.materials)) return j;
  } catch {
    // ignore
  }
  return null;
}

async function readRemote(url: string): Promise<Journal | null> {
  try {
    const res = await fetch(
      url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(),
      {
        cache: "no-store",
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as Journal;
    if (j && Array.isArray(j.materials)) return j;
  } catch {
    // ignore
  }
  return null;
}

function mergeMats(...lists: (TeacherMaterial[] | undefined)[]) {
  const byId = new Map<string, TeacherMaterial>();
  const byUrl = new Map<string, TeacherMaterial>();
  for (const list of lists) {
    for (const m of list || []) {
      if (!m?.url) continue;
      if (m.id) {
        const p = byId.get(m.id);
        if (!p || (m.createdAt || 0) >= (p.createdAt || 0)) byId.set(m.id, m);
      }
      const pu = byUrl.get(m.url);
      if (!pu || (m.createdAt || 0) >= (pu.createdAt || 0)) byUrl.set(m.url, m);
    }
  }
  const out: TeacherMaterial[] = [];
  const seen = new Set<string>();
  for (const m of byId.values()) {
    out.push(m);
    seen.add(m.url);
  }
  for (const m of byUrl.values()) {
    if (seen.has(m.url)) continue;
    out.push(m);
  }
  return out
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 80);
}

async function loadJournal(code: string): Promise<Journal> {
  const c = code.toUpperCase();
  const memJ = mem.get(c) || null;
  const local = (await readLocal(c)) || null;

  // Always merge Supabase durable index (shared localhost ↔ Vercel)
  let sbIdx: {
    materials?: TeacherMaterial[];
    teacherId?: string;
    teacherName?: string;
    className?: string;
    updatedAt?: number;
  } | null = null;
  try {
    const { loadMaterialsIndex } = await import(
      "@/lib/supabase-materials-index"
    );
    sbIdx = await loadMaterialsIndex(c);
  } catch (e) {
    console.error("loadJournal supabase", e);
  }

  const baseMats = mergeMats(
    memJ?.materials,
    local?.materials,
    sbIdx?.materials
  );

  // Free-host journal only if still empty
  let remote: Journal | null = null;
  if (baseMats.length === 0) {
    try {
      const ptr = (await fs.readFile(pointerPath(c), "utf8")).trim();
      if (ptr.startsWith("http")) remote = await readRemote(ptr);
    } catch {
      // ignore
    }
    if (!remote && memJ?.remoteUrl) {
      remote = await readRemote(memJ.remoteUrl);
    }
  }

  const materials = mergeMats(baseMats, remote?.materials);
  const j: Journal = {
    code: c,
    teacherId:
      memJ?.teacherId || local?.teacherId || sbIdx?.teacherId || remote?.teacherId,
    teacherName:
      memJ?.teacherName ||
      local?.teacherName ||
      sbIdx?.teacherName ||
      remote?.teacherName,
    className:
      memJ?.className ||
      local?.className ||
      sbIdx?.className ||
      remote?.className,
    materials,
    updatedAt: Math.max(
      memJ?.updatedAt || 0,
      local?.updatedAt || 0,
      sbIdx?.updatedAt || 0,
      remote?.updatedAt || 0,
      Date.now()
    ),
    remoteUrl: remote?.remoteUrl || local?.remoteUrl || memJ?.remoteUrl,
  };
  mem.set(c, j);
  return j;
}

async function mirrorJournalRemote(j: Journal) {
  const c = j.code.toUpperCase();
  try {
    const slim: Journal = {
      ...j,
      materials: j.materials
        .map((m) => {
          const u = m.url || "";
          if (u.startsWith("data:") && u.length > 400_000) {
            return { ...m, url: "" };
          }
          return m;
        })
        .filter((m) => m.url),
    };
    const fullJson = JSON.stringify(j);
    const payload = fullJson.length < 4_500_000 ? j : slim;
    const remote = await Promise.race([
      uploadBufferRemote(
        Buffer.from(JSON.stringify(payload), "utf8"),
        `journal-${c}-${Date.now()}.json`,
        "application/json"
      ),
      new Promise<null>((r) => setTimeout(() => r(null), 8000)),
    ]);
    if (remote) {
      j.remoteUrl = remote;
      mem.set(c, j);
      try {
        await fs.writeFile(pointerPath(c), remote, "utf8");
        await fs.writeFile(localPath(c), JSON.stringify(j), "utf8");
      } catch {
        // ignore
      }
    }
  } catch (e) {
    console.error("journal remote", e);
  }
}

async function persistJournal(j: Journal, opts?: { awaitRemote?: boolean }) {
  const c = j.code.toUpperCase();
  j.code = c;
  j.updatedAt = Date.now();
  j.materials = mergeMats(j.materials);
  mem.set(c, j);

  try {
    await fs.mkdir(dir(), { recursive: true });
    await fs.writeFile(localPath(c), JSON.stringify(j), "utf8");
  } catch (e) {
    console.error("journal local write", e);
  }

  // Durable catalog on Supabase (await — this is what Vercel students read)
  try {
    const { writeMaterialsIndex, readMaterialsIndex } = await import(
      "@/lib/supabase-materials-index"
    );
    const prev = await readMaterialsIndex(c);
    await writeMaterialsIndex({
      code: c,
      teacherId: j.teacherId || prev?.teacherId,
      teacherName: j.teacherName || prev?.teacherName,
      className: j.className || prev?.className,
      materials: mergeMats(j.materials, prev?.materials),
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error("persistJournal supabase index", e);
  }

  // Free-host mirror optional background
  if (opts?.awaitRemote) {
    await mirrorJournalRemote(j);
  } else {
    void mirrorJournalRemote(j);
  }

  return j;
}

/** Teacher upload — append material; never replace whole list */
export async function journalAppendMaterial(
  code: string,
  material: TeacherMaterial,
  meta?: { teacherId?: string; teacherName?: string; className?: string }
) {
  const c = code.toUpperCase();
  const prev = await loadJournal(c);
  const mat: TeacherMaterial = {
    ...material,
    id:
      material.id ||
      `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: material.createdAt || Date.now(),
    expiresAt:
      material.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  const materials = mergeMats([mat], prev.materials);
  const j: Journal = {
    ...prev,
    code: c,
    teacherId: meta?.teacherId || prev.teacherId,
    teacherName: meta?.teacherName || prev.teacherName,
    className: meta?.className || prev.className,
    materials,
    updatedAt: Date.now(),
  };
  await persistJournal(j);
  return j.materials;
}

/** Student/teacher read — full history for class code */
export async function journalListMaterials(code: string): Promise<{
  materials: TeacherMaterial[];
  teacherName?: string;
  className?: string;
}> {
  const c = code.toUpperCase();
  let j = await loadJournal(c);

  // Seed from class-code index if journal empty (first read after deploy)
  if (!j.materials?.length) {
    try {
      const { getClassMaterials } = await import("@/lib/class-code-index");
      const shared = await getClassMaterials(c);
      if (shared.length) {
        j = {
          ...j,
          materials: mergeMats(shared, j.materials),
          updatedAt: Date.now(),
        };
        mem.set(c, j);
        try {
          await fs.mkdir(dir(), { recursive: true });
          await fs.writeFile(localPath(c), JSON.stringify(j), "utf8");
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    materials: j.materials || [],
    teacherName: j.teacherName,
    className: j.className,
  };
}
