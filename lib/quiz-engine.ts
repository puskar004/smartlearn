import { allChapters, type Chapter } from "./curriculum";
import { questionsForChapter, type BankQ } from "./quiz-bank";

export type QuizQuestion = {
  id: string;
  chapterId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: "rapid" | "standard" | "challenge";
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleOptions(
  options: string[],
  correctIndex: number,
  seed: number
): { options: string[]; correctIndex: number } {
  const rand = rng(seed);
  const pairs = options.map((text, i) => ({
    text,
    correct: i === correctIndex,
  }));
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return {
    options: pairs.map((p) => p.text),
    correctIndex: pairs.findIndex((p) => p.correct),
  };
}

function difficultyFor(i: number): QuizQuestion["difficulty"] {
  if (i < 3) return "rapid";
  if (i < 7) return "standard";
  return "challenge";
}

function toQuestion(
  chapterId: string,
  q: BankQ,
  i: number,
  seed: number
): QuizQuestion {
  const shuffled = shuffleOptions([...q.options], q.correctIndex, seed + i * 31);
  return {
    id: `${chapterId}-bq${i + 1}`,
    chapterId,
    prompt: q.prompt,
    options: shuffled.options,
    correctIndex: shuffled.correctIndex,
    explanation: q.explanation,
    difficulty: difficultyFor(i),
  };
}

/** Board-level MCQs matched to chapter; options fully shuffled. */
export function buildChapterQuiz(
  chapter: Chapter & { subjectName?: string; subjectId?: string },
  count = 10
): QuizQuestion[] {
  const pool = questionsForChapter({
    title: chapter.title,
    topics: chapter.topics,
    subjectName: chapter.subjectName,
    subjectId: chapter.subjectId,
  });

  const seed = hash(chapter.id + chapter.title);
  const rand = rng(seed);
  const picked: BankQ[] = [];
  const used = new Set<number>();

  while (picked.length < count && used.size < pool.length) {
    const i = Math.floor(rand() * pool.length);
    if (used.has(i)) continue;
    used.add(i);
    picked.push(pool[i]);
  }

  // if still short, wrap
  let k = 0;
  while (picked.length < count) {
    picked.push(pool[k % pool.length]);
    k++;
  }

  return picked
    .slice(0, count)
    .map((q, i) => toQuestion(chapter.id, q, i, seed));
}

export function getQuizByChapterId(chapterId: string, count = 10) {
  const chapter = allChapters().find((c) => c.id === chapterId);
  if (!chapter) return null;
  return buildChapterQuiz(chapter, count);
}

export function pickDailyRapidSet(grade?: string, n = 15) {
  const pool = allChapters().filter((c) => !grade || c.grade === grade);
  const day = new Date().toISOString().slice(0, 10);
  const seed = hash(day);
  const rand = rng(seed);
  const out: QuizQuestion[] = [];
  for (let i = 0; i < Math.min(n, pool.length); i++) {
    const ch = pool[Math.floor(rand() * pool.length)];
    const qs = buildChapterQuiz(ch, 1);
    out.push(...qs);
  }
  return out;
}
