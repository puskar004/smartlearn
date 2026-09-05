import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { addMessage, loadAllMessages } from "@/lib/common-room-server";

export async function GET() {
  try {
    const messages = await loadAllMessages();
    return NextResponse.json({ ok: true, messages });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const user = await currentUser();
  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  const imageDataUrl =
    typeof body.imageDataUrl === "string" ? body.imageDataUrl : undefined;
  const replyToId =
    typeof body.replyToId === "string" ? body.replyToId : undefined;
  const replyToAuthor =
    typeof body.replyToAuthor === "string"
      ? body.replyToAuthor.slice(0, 80)
      : undefined;
  const replyToText =
    typeof body.replyToText === "string"
      ? body.replyToText.slice(0, 120)
      : undefined;

  if (text.length < 1 && !imageDataUrl) {
    return NextResponse.json(
      { error: "Write a message or attach a photo." },
      { status: 400 }
    );
  }
  if (text.length > 200) {
    return NextResponse.json(
      { error: "Max 200 characters per message." },
      { status: 400 }
    );
  }
  if (imageDataUrl && imageDataUrl.length > 450_000) {
    return NextResponse.json(
      { error: "Image too large. Use a smaller photo." },
      { status: 400 }
    );
  }

  const author =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
    "Student";

  const msg = {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    author,
    authorId: userId,
    text: text || (imageDataUrl ? "📷 Photo" : ""),
    imageDataUrl,
    replyToId,
    replyToAuthor,
    replyToText,
    at: Date.now(),
  };

  try {
    const messages = await addMessage(msg);
    return NextResponse.json({ ok: true, message: msg, messages });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to post";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
