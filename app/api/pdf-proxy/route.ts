import { NextRequest, NextResponse } from "next/server";
import {
  hostAllowed,
  resolvePdfBytes,
} from "@/lib/pdf-fetch";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

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
        detail:
          "Could not download PDF (expired link or blocked host). Re-upload or try another source.",
      },
      { status: 502 }
    );
  }

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="notes.pdf"',
      "Cache-Control": "public, max-age=600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
