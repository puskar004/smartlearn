/**
 * Per-user isolated storage. New Clerk user = completely fresh progress.
 * Never mixes data between accounts on the same browser.
 */

export type MistakeItem = {
  id: string;
  chapterId: string;
  chapterTitle: string;
  subjectName: string;
  grade: string;
  prompt: string;
  yourAnswer: string;
  correctAnswer: string;
  explanation: string;
  at: number;
};

export type QuizResult = {
  chapterId: string;
  score: number;
  total: number;
  at: number;
};

export type UserProgress = {
  userId: string;
  createdAt: number;
  grade: "10" | "11" | "12";
  /** Student picked class 10/11/12 at login */
  gradeChosen: boolean;
  xp: number;
  streak: number;
  lastStudyDay: string | null;
  quizResults: QuizResult[];
  mistakes: MistakeItem[];
  feynmanScores: { topic: string; score: number; at: number }[];
  focusMinutes: number;
  tabSwitchCount: number;
  chaptersOpened: string[];
  boardExamDate: string | null;
  /** Chapters student selected for their personal syllabus / board plan */
  planChapterIds: string[];
  /** Chapter ids marked done in study plan */
  planDoneChapterIds: string[];
  /** Generated plan day keys (yyyy-mm-dd) marked complete */
  planDoneDays: string[];
};

const PREFIX = "sl_user_v2_";
const ACTIVE = "sl_active_user_id";

function key(userId: string) {
  return `${PREFIX}${userId}`;
}

export function emptyProgress(userId: string): UserProgress {
  return {
    userId,
    createdAt: Date.now(),
    grade: "12",
    gradeChosen: false,
    xp: 0,
    streak: 0,
    lastStudyDay: null,
    quizResults: [],
    mistakes: [],
    feynmanScores: [],
    focusMinutes: 0,
    tabSwitchCount: 0,
    chaptersOpened: [],
    boardExamDate: null,
    planChapterIds: [],
    planDoneChapterIds: [],
    planDoneDays: [],
  };
}

export function getActiveUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE);
}

export function setActiveUserId(userId: string | null) {
  if (typeof window === "undefined") return;
  if (userId) localStorage.setItem(ACTIVE, userId);
  else localStorage.removeItem(ACTIVE);
}

export function loadProgress(userId: string): UserProgress {
  if (typeof window === "undefined") return emptyProgress(userId);
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) {
      const fresh = emptyProgress(userId);
      localStorage.setItem(key(userId), JSON.stringify(fresh));
      return fresh;
    }
    return { ...emptyProgress(userId), ...JSON.parse(raw), userId };
  } catch {
    return emptyProgress(userId);
  }
}

export function saveProgress(p: UserProgress) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(p.userId), JSON.stringify(p));
}

/** Call on sign-in: bind this browser slot to user, ensure fresh file exists */
export function bindUser(userId: string): UserProgress {
  setActiveUserId(userId);
  return loadProgress(userId);
}

export function resetUserProgress(userId: string): UserProgress {
  const fresh = emptyProgress(userId);
  // keep grade preference if any
  try {
    const old = loadProgress(userId);
    fresh.grade = old.grade;
    fresh.boardExamDate = old.boardExamDate;
  } catch {
    // ignore
  }
  // Actually user asked fresh start for NEW login - full wipe for reset
  const wiped = emptyProgress(userId);
  saveProgress(wiped);
  return wiped;
}

export function hardResetUser(userId: string): UserProgress {
  const wiped = emptyProgress(userId);
  saveProgress(wiped);
  return wiped;
}

export function addXp(userId: string, amount: number) {
  const p = loadProgress(userId);
  p.xp += amount;
  const today = new Date().toISOString().slice(0, 10);
  if (p.lastStudyDay !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    p.streak = p.lastStudyDay === yesterday ? p.streak + 1 : 1;
    p.lastStudyDay = today;
  }
  saveProgress(p);
  return p;
}

export function recordQuiz(
  userId: string,
  result: QuizResult,
  mistakes: Omit<MistakeItem, "id" | "at">[]
) {
  const p = loadProgress(userId);
  p.quizResults = [result, ...p.quizResults].slice(0, 100);
  const stamped = mistakes.map((m) => ({
    ...m,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
  }));
  p.mistakes = [...stamped, ...p.mistakes].slice(0, 200);
  p.xp += result.score * 2;
  const today = new Date().toISOString().slice(0, 10);
  if (p.lastStudyDay !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    p.streak = p.lastStudyDay === yesterday ? p.streak + 1 : 1;
    p.lastStudyDay = today;
  }
  saveProgress(p);
  return p;
}

export function markChapterOpened(userId: string, chapterId: string) {
  const p = loadProgress(userId);
  if (!p.chaptersOpened.includes(chapterId)) {
    p.chaptersOpened = [chapterId, ...p.chaptersOpened].slice(0, 300);
    saveProgress(p);
  }
  return p;
}

export function weaknessMap(p: UserProgress) {
  const map: Record<string, number> = {};
  for (const m of p.mistakes) {
    const k = m.subjectName || m.chapterId;
    map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
}

export function accuracy(p: UserProgress) {
  if (!p.quizResults.length) return null;
  const s = p.quizResults.reduce((a, r) => a + r.score, 0);
  const t = p.quizResults.reduce((a, r) => a + r.total, 0);
  return t ? Math.round((s / t) * 100) : null;
}
