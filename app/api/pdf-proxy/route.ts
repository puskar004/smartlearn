import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const ALLOW = [
  "ncert.nic.in",
  "www.ncert.nic.in",
  "cbseacademic.nic.in",
  "www.cbseacademic.nic.in",
  "www.cbse.gov.in",
  "cbse.gov.in",
  "cdn.cbse.gov.in",
  "web.archive.org",
  "tmpfiles.org",
  "www.tmpfiles.org",
  "catbox.moe",
  "files.catbox.moe",
  "litter.catbox.moe",
  "0x0.st",
  "drive.google.com",
  "docs.google.com",
  "www.googleapis.com",
  "blob.vercel-storage.com",
  "public.blob.vercel-storage.com",
];

function hostAllowed(host: string) {
  if (ALLOW.some((h) => host === h || host.endsWith(`.${h}`))) return true;
  if (host.includes("blob.vercel-storage.com")) return true;
  if (host.includes("tmpfiles.org")) return true;
  if (host.includes("catbox.moe")) return true;
  if (host.includes("google")) return true;
  return false;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function isPdfBytes(buf: Uint8Array) {
  if (buf.byteLength < 5) return false;
  return (
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  ); // %PDF
}

/** tmpfiles page → real /dl/{token}/...pdf link */
function extractTmpfilesDl(html: string, base: string): string | null {
  const m =
    html.match(
      /https?:\/\/(?:www\.)?tmpfiles\.org\/dl\/[^\s"'<>]+/i
    ) ||
    html.match(/href="(\/dl\/[^"]+)"/i);
  if (!m) return null;
  const raw = m[1] || m[0];
  try {
    return new URL(raw, base).href;
  } catch {
    return null;
  }
}

function candidates(url: string): string[] {
  const list = [url];
  try {
    const u = new URL(url);
    // tmpfiles: try both page and simple /dl/ forms
    if (u.hostname.includes("tmpfiles.org")) {
      const path = u.pathname.replace(/\/+$/, "");
      if (!path.includes("/dl/")) {
        list.push(`https://tmpfiles.org/dl${path}`);
        list.push(`https://tmpfiles.org${path}`);
      } else {
        // strip /dl/ for page scrape
        const pagePath = path.replace(/^\/dl\/[^/]+/, "") || path;
        list.push(`https://tmpfiles.org${pagePath.startsWith("/") ? pagePath : `/${pagePath}`}`);
      }
    }
    if (u.hostname === "ncert.nic.in") {
      list.push(url.replace("://ncert.nic.in", "://www.ncert.nic.in"));
    }
    if (u.hostname === "www.ncert.nic.in") {
      list.push(url.replace("://www.ncert.nic.in", "://ncert.nic.in"));
    }
    if (u.protocol === "https:") {
      list.push(url.replace(/^https:/, "http:"));
    }
    if (u.hostname.includes("ncert") || u.hostname.includes("cbse")) {
      list.push(`https://web.archive.org/web/0id_/${url}`);
      list.push(`https://web.archive.org/web/2024id_/${url}`);
    }
  } catch {
    // ignore
  }
  return Array.from(new Set(list));
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 45000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/pdf,application/octet-stream,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength ? buf : null;
  } catch {
    return null;
  }
}

async function resolvePdfBytes(url: string): Promise<Uint8Array | null> {
  for (const candidate of candidates(url)) {
    const buf = await fetchBytes(candidate);
    if (!buf) continue;
    if (isPdfBytes(buf)) return buf;

    // HTML landing page (tmpfiles) — scrape real download URL
    const head = new TextDecoder().decode(buf.slice(0, Math.min(buf.length, 8000)));
    if (/<!DOCTYPE|<html/i.test(head) && /tmpfiles/i.test(candidate + head)) {
      const dl = extractTmpfilesDl(head, candidate);
      if (dl) {
        const pdf = await fetchBytes(dl);
        if (pdf && isPdfBytes(pdf)) return pdf;
      }
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return NextResponse.json({ error: "Bad url" }, { status: 400 });
  }

  if (!hostAllowed(host)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  const bytes = await resolvePdfBytes(url);
  if (!bytes) {
    return NextResponse.json(
      {
        error: "fetch failed",
        detail: "Could not download PDF (host returned HTML or blocked)",
      },
      { status: 502 }
    );
  }

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="notes.pdf"',
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
