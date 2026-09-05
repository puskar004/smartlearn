import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export type RoomMsg = {
  id: string;
  author: string;
  authorId: string;
  text: string;
  at: number;
};

type Store = { messages: RoomMsg[] };

function filePath() {
  const base = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), ".data");
  return path.join(base, "smartlearn-common-room.json");
}

async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    return JSON.parse(raw) as Store;
  } catch {
    return { messages: [] };
  }
}

async function writeStore(store: Store) {
  const fp = filePath();
  try {
    await fs.mkdir(path.dirname(fp), { recursive: true });
  } catch {
    // ignore
  }
  await fs.writeFile(fp, JSON.stringify(store), "utf8");
}

export async function GET() {
  const store = await readStore();
  return NextResponse.json({
    ok: true,
    messages: store.messages.slice(0, 150),
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const user = await currentUser();
  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "").trim();

  if (text.length < 4) {
    return NextResponse.json(
      { error: "Write a clearer academic question (min 4 chars)." },
      { status: 400 }
    );
  }
  if (text.length > 500) {
    return NextResponse.json({ error: "Max 500 characters." }, { status: 400 });
  }

  const store = await readStore();
  const msg: RoomMsg = {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    author:
      user?.fullName ||
      user?.firstName ||
      user?.emailAddresses?.[0]?.emailAddress ||
      "Student",
    authorId: userId,
    text,
    at: Date.now(),
  };
  store.messages = [msg, ...store.messages].slice(0, 200);
  await writeStore(store);

  return NextResponse.json({ ok: true, message: msg, messages: store.messages });
}
