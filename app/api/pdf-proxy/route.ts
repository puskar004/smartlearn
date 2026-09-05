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
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function candidates(url: string): string[] {
  const list = [url];
  try {
    const u = new URL(url);
    if (u.hostname === "ncert.nic.in") {
      list.push(url.replace("://ncert.nic.in", "://www.ncert.nic.in"));
    }
    if (u.hostname === "www.ncert.nic.in") {
      list.push(url.replace("://www.ncert.nic.in", "://ncert.nic.in"));
    }
    if (u.protocol === "https:") {
      list.push(url.replace(/^https:/, "http:"));
    }
    // Wayback machine identity capture (when NCERT blocks cloud IPs)
    if (u.hostname.includes("ncert") || u.hostname.includes("cbse")) {
      list.push(`https://web.archive.org/web/0id_/${url}`);
      list.push(`https://web.archive.org/web/2024id_/${url}`);
    }
  } catch {
    // ignore
  }
  return Array.from(new Set(list));
}

async function fetchPdf(url: string): Promise<Response | null> {
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
        Referer: "https://ncert.nic.in/textbook.php",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    // accept pdf or octet-stream
    if (
      ct.includes("pdf") ||
      ct.includes("octet-stream") ||
      ct.includes("binary") ||
      !ct
    ) {
      return res;
    }
    // sometimes wrong content-type but body is pdf
    return res;
  } catch {
    return null;
  }
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

  if (!ALLOW.some((h) => host === h || host.endsWith(`.${h}`))) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  const tried: string[] = [];
  for (const candidate of candidates(url)) {
    tried.push(candidate);
    const res = await fetchPdf(candidate);
    if (!res || !res.body) continue;

    // Stream body — avoids loading entire multi-MB PDF into memory twice
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="ncert.pdf"',
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return NextResponse.json(
    {
      error: "fetch failed",
      detail: "Could not download PDF from NCERT/CBSE servers",
      tried,
    },
    { status: 502 }
  );
}
