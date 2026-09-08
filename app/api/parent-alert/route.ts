import { NextResponse } from "next/server";

/** Parent WhatsApp alerts disabled by product decision. */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      error: "Parent alerts are disabled.",
    },
    { status: 410 }
  );
}
