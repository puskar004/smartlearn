import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

type Ticket = {
  id: string;
  userId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  at: number;
};

function filePath() {
  const base = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), ".data");
  return path.join(base, "smartlearn-support.json");
}

async function readTickets(): Promise<Ticket[]> {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    return JSON.parse(raw) as Ticket[];
  } catch {
    return [];
  }
}

async function writeTickets(list: Ticket[]) {
  const fp = filePath();
  try {
    await fs.mkdir(path.dirname(fp), { recursive: true });
  } catch {
    // ignore
  }
  await fs.writeFile(fp, JSON.stringify(list), "utf8");
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const user = await currentUser();
  const body = await req.json().catch(() => ({}));
  const subject = String(body.subject || "Support").trim().slice(0, 120);
  const message = String(body.message || "").trim();

  if (message.length < 10) {
    return NextResponse.json(
      { error: "Please describe your issue (at least 10 characters)." },
      { status: 400 }
    );
  }

  const ticket: Ticket = {
    id: `t-${Date.now()}`,
    userId,
    name: user?.fullName || user?.firstName || "User",
    email: user?.emailAddresses?.[0]?.emailAddress || "",
    subject,
    message: message.slice(0, 2000),
    at: Date.now(),
  };

  const list = await readTickets();
  list.unshift(ticket);
  await writeTickets(list.slice(0, 500));

  // Optional email to site handler if SUPPORT_EMAIL + RESEND/FETCH configured later
  const supportTo = process.env.SUPPORT_EMAIL || process.env.SITE_HANDLER_EMAIL;
  if (supportTo && process.env.RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.SUPPORT_FROM || "SmartLearn <onboarding@resend.dev>",
          to: [supportTo],
          subject: `[SmartLearn Support] ${subject}`,
          text: `From: ${ticket.name} <${ticket.email}>\nUser: ${userId}\n\n${message}`,
        }),
      });
    } catch {
      // stored even if email fails
    }
  }

  return NextResponse.json({
    ok: true,
    id: ticket.id,
    message:
      "Message sent to SmartLearn support. Our team will review it shortly.",
  });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Only return count for privacy; full list for handlers via env later
  const list = await readTickets();
  const mine = list.filter((t) => t.userId === userId).slice(0, 20);
  return NextResponse.json({ ok: true, tickets: mine });
}
