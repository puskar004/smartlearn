/**
 * In-memory Smartlearn meta cache — cuts Clerk getUser/update spam (429s).
 * Per serverless instance; still massively reduces bursts from one session.
 */
import type { SmartlearnMeta } from "@/lib/classroom-types";

type Entry = { meta: SmartlearnMeta; at: number; publicMetadata?: Record<string, unknown> };

const store = new Map<string, Entry>();
const TTL_MS = 90_000; // 90s — balance rate limits vs fresh roster
const WRITE_COOLDOWN_MS = 6_000;
const lastWrite = new Map<string, number>();

export function peekMeta(userId: string): SmartlearnMeta | null {
  const e = store.get(userId);
  if (!e) return null;
  return e.meta;
}

export function getCachedMeta(
  userId: string,
  maxAge = TTL_MS
): SmartlearnMeta | null {
  const e = store.get(userId);
  if (!e) return null;
  if (Date.now() - e.at > maxAge) return null;
  return e.meta;
}

export function setCachedMeta(
  userId: string,
  meta: SmartlearnMeta,
  publicMetadata?: Record<string, unknown>
) {
  store.set(userId, {
    meta: JSON.parse(JSON.stringify(meta)) as SmartlearnMeta,
    at: Date.now(),
    publicMetadata,
  });
}

export function getCachedPublicMeta(
  userId: string
): Record<string, unknown> | null {
  return store.get(userId)?.publicMetadata || null;
}

/** True if we should skip another Clerk write (cooldown). */
export function shouldSkipClerkWrite(userId: string): boolean {
  const t = lastWrite.get(userId) || 0;
  return Date.now() - t < WRITE_COOLDOWN_MS;
}

export function markClerkWrite(userId: string) {
  lastWrite.set(userId, Date.now());
}

/** Clear cooldown so critical writes (materials) always attempt Clerk */
export function clearClerkWriteCooldown(userId: string) {
  lastWrite.delete(userId);
}

export function isRateLimitError(e: unknown): boolean {
  const msg =
    e instanceof Error
      ? e.message
      : typeof e === "string"
        ? e
        : JSON.stringify(e);
  return /too many requests|429|rate.?limit|resource_exhausted/i.test(msg);
}
