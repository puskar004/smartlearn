import { clerkClient } from "@clerk/nextjs/server";
import { promises as fs } from "fs";
import path from "path";

export type RoomMsg = {
  id: string;
  author: string;
  authorId: string;
  text: string;
  imageDataUrl?: string; // optional small image (data URL)
  at: number;
};

type Meta = {
  role?: string;
  wallPosts?: RoomMsg[];
  [k: string]: unknown;
};

function filePath() {
  const base = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), ".data");
  return path.join(base, "smartlearn-common-room.json");
}

async function readFileStore(): Promise<RoomMsg[]> {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    const j = JSON.parse(raw) as { messages?: RoomMsg[] };
    return j.messages || [];
  } catch {
    return [];
  }
}

async function writeFileStore(messages: RoomMsg[]) {
  const fp = filePath();
  try {
    await fs.mkdir(path.dirname(fp), { recursive: true });
  } catch {
    // ignore
  }
  await fs.writeFile(fp, JSON.stringify({ messages }), "utf8");
}

function metaOf(user: { publicMetadata?: Record<string, unknown> | null }): Meta {
  const m = (user.publicMetadata || {}) as Record<string, unknown>;
  return (m.smartlearn as Meta) || {};
}

/** Collect wall posts from Clerk users + local file cache */
export async function loadAllMessages(): Promise<RoomMsg[]> {
  const map = new Map<string, RoomMsg>();

  for (const m of await readFileStore()) {
    map.set(m.id, m);
  }

  try {
    const client = await clerkClient();
    let offset = 0;
    for (let page = 0; page < 15; page++) {
      const res = await client.users.getUserList({ limit: 100, offset });
      for (const u of res.data) {
        const posts = metaOf(u).wallPosts || [];
        for (const p of posts) {
          if (p?.id) map.set(p.id, p);
        }
      }
      offset += 100;
      if (offset >= (res.totalCount || 0) || res.data.length === 0) break;
    }
  } catch (e) {
    console.error("loadAllMessages clerk", e);
  }

  return Array.from(map.values()).sort((a, b) => b.at - a.at).slice(0, 300);
}

export async function addMessage(msg: RoomMsg): Promise<RoomMsg[]> {
  // 1) file cache
  const fileMsgs = await readFileStore();
  const nextFile = [msg, ...fileMsgs.filter((m) => m.id !== msg.id)].slice(0, 300);
  await writeFileStore(nextFile);

  // 2) durable on author Clerk metadata
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(msg.authorId);
    const sm = metaOf(user);
    const wallPosts = [msg, ...(sm.wallPosts || [])]
      .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
      .slice(0, 50);
    await client.users.updateUserMetadata(msg.authorId, {
      publicMetadata: {
        ...user.publicMetadata,
        smartlearn: {
          ...sm,
          wallPosts,
        },
      },
    });
  } catch (e) {
    console.error("addMessage metadata", e);
  }

  return loadAllMessages();
}
