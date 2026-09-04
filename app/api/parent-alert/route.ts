import { NextRequest, NextResponse } from "next/server";
import { buildParentTabSwitchMessage } from "@/lib/whatsapp";

/** Logs alert + returns WhatsApp deep link (Twilio can be wired later). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = String(body.phone || "").replace(/\D/g, "");
  const studentName = String(body.studentName || "Student");
  const reason = String(body.reason || "tab_switch");

  const message =
    reason === "weekly_summary"
      ? `Hello Parent,\n\nWeekly SmartLearn summary for ${studentName}:\n• Stay consistent with daily chapter quizzes\n• Review weak topics marked by Gemini tutor\n• Focus lock is active during study sessions\n\n— SmartLearn Parent Portal`
      : buildParentTabSwitchMessage(studentName);

  const withCountry =
    phone.length === 10 ? `91${phone}` : phone.length >= 10 ? phone : "";

  const waLink = withCountry
    ? `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`
    : null;

  return NextResponse.json({
    ok: true,
    message,
    waLink,
    stored: false,
    hint: "Client opens waLink. For automatic server-side WhatsApp, connect Twilio WhatsApp API.",
  });
}
