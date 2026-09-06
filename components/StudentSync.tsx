"use client";

import { useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { apiSyncStudent, getJoinedClass, setJoinedClass } from "@/lib/teacher-store";
import { accuracy, loadProgress, weaknessMap } from "@/lib/user-store";
import { pushNotification } from "@/lib/notifications";
import type { ClassAlert } from "@/lib/classroom-types";

const SEEN_ALERTS_KEY = "sl_seen_class_alerts_v1_";

/** Sync student progress to teacher classroom (server / any device). */
export default function StudentSync() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (!isSignedIn || !userId) return;

    const sync = () => {
      const code = getJoinedClass(userId);
      if (!code) return;
      const p = loadProgress(userId);
      const weak = weaknessMap(p).map(([n]) => n);
      void apiSyncStudent(code, {
        studentId: userId,
        name: user?.fullName || user?.firstName || "Student",
        email: user?.primaryEmailAddress?.emailAddress,
        grade: p.grade,
        xp: p.xp,
        streak: p.streak,
        accuracy: accuracy(p),
        mistakes: p.mistakes.length,
        weakSubjects: weak,
        chaptersOpened: p.chaptersOpened.length,
        lastActive: Date.now(),
        recentMistakes: p.mistakes.slice(0, 5).map((m) => ({
          subjectName: m.subjectName,
          chapterTitle: m.chapterTitle,
          prompt: m.prompt,
          at: m.at,
        })),
      });
    };

    const pullServerAlerts = async () => {
      try {
        const res = await fetch("/api/classroom?action=joined");
        const data = await res.json();
        if (data.joined) {
          setJoinedClass(userId, data.joined);
        }
        const alerts = (data.classroom?.alerts || []) as ClassAlert[];
        if (!alerts.length) return;
        const seenRaw = localStorage.getItem(SEEN_ALERTS_KEY + userId);
        const seen = new Set<string>(
          seenRaw ? (JSON.parse(seenRaw) as string[]) : []
        );
        const fresh = alerts
          .filter((a) => a?.id && !seen.has(a.id))
          .filter((a) => Date.now() - (a.at || 0) < 7 * 86_400_000)
          .slice(0, 15);
        for (const a of fresh.reverse()) {
          pushNotification(userId, {
            title: a.title,
            body: a.body,
            href: a.href || (a.kind === "material" ? "/join-class" : "/live-class"),
          });
          seen.add(a.id);
        }
        const keep = [...seen].slice(-80);
        localStorage.setItem(SEEN_ALERTS_KEY + userId, JSON.stringify(keep));
      } catch {
        // ignore
      }
    };

    // Class code / live alerts from teacher (same browser or storage event)
    const pullLocalAlerts = () => {
      try {
        const raw = localStorage.getItem(`sl_notify_student_${userId}`);
        if (raw) {
          const n = JSON.parse(raw) as {
            title: string;
            body: string;
            href?: string;
            at: number;
          };
          localStorage.removeItem(`sl_notify_student_${userId}`);
          if (n?.title && Date.now() - (n.at || 0) < 86_400_000) {
            pushNotification(userId, {
              title: n.title,
              body: n.body,
              href: n.href || "/join-class",
            });
          }
        }
        const live = localStorage.getItem(
          `sl_live_alert_${getJoinedClass(userId) || ""}`
        );
        if (live) {
          const L = JSON.parse(live) as {
            title: string;
            meetUrl?: string;
            at: number;
            scheduledAt?: number;
          };
          if (L?.title && Date.now() - (L.at || 0) < 3_600_000) {
            pushNotification(userId, {
              title: L.scheduledAt ? "Live class scheduled" : "Live class started",
              body: L.title + (L.meetUrl ? " · Meet ready" : ""),
              href: "/live-class",
            });
            localStorage.removeItem(
              `sl_live_alert_${getJoinedClass(userId) || ""}`
            );
          }
        }
      } catch {
        // ignore
      }
    };

    const tick = () => {
      sync();
      pullLocalAlerts();
      void pullServerAlerts();
    };

    tick();
    const id = setInterval(tick, 12_000);
    window.addEventListener("storage", pullLocalAlerts);
    return () => {
      clearInterval(id);
      window.removeEventListener("storage", pullLocalAlerts);
    };
  }, [isSignedIn, userId, user]);

  return null;
}
