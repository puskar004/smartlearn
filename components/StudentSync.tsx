"use client";

import { useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  getJoinedClass,
  pushStudentSnapshot,
} from "@/lib/teacher-store";
import { accuracy, loadProgress, weaknessMap } from "@/lib/user-store";

/** Periodically sync student progress to joined classroom for teacher view */
export default function StudentSync() {
  const { userId, isSignedIn } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    const code = getJoinedClass(userId);
    if (!code) return;

    const sync = () => {
      const p = loadProgress(userId);
      const weak = weaknessMap(p).map(([n]) => n);
      pushStudentSnapshot(code, {
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

    sync();
    const id = setInterval(sync, 20_000);
    return () => clearInterval(id);
  }, [isSignedIn, userId, user]);

  return null;
}
