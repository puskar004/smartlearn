"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import {
  bindUser,
  getActiveUserId,
  setActiveUserId,
} from "@/lib/user-store";

/**
 * Ensures each signed-in Clerk user gets an isolated fresh data namespace.
 * Switching accounts on the same browser never leaks progress.
 */
export default function UserBootstrap() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();
  const booted = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      setActiveUserId(null);
      booted.current = null;
      return;
    }
    if (booted.current === userId) return;
    booted.current = userId;

    const prev = getActiveUserId();
    const progress = bindUser(userId);

    // Brand-new account file (just created empty) — optional welcome flag
    if (prev && prev !== userId) {
      // switched users: previous data stays under their key, current is clean/own
      console.info("[SmartLearn] Switched learner profile", {
        from: prev,
        to: userId,
      });
    }

    // Sync display grade from Clerk metadata if present
    const metaGrade = user?.publicMetadata?.grade as string | undefined;
    if (metaGrade && ["10", "11", "12"].includes(metaGrade)) {
      progress.grade = metaGrade as "10" | "11" | "12";
    }
  }, [isSignedIn, userId, user]);

  return null;
}
