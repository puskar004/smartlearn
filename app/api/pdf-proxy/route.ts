import { NextRequest, NextResponse } from "next/server";

const ALLOW = [
  "ncert.nic.in",
  "www.ncert.nic.in",
  "cbseacademic.nic.in",
  "www.cbseacademic.nic.in",
  "www.cbse.gov.in",
  "cbse.gov.in",
  "cdn.cbse.gov.in",
];

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

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SmartLearn/1.0; +https://smartlearn-xi.vercel.app)",
        Accept: "application/pdf,*/*",
      },
      // cache PDFs a bit on the edge
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream ${res.status}` },
        { status: 502 }
      );
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=ncert.pdf",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
