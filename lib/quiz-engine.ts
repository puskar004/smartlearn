import { allChapters, type Chapter } from "./curriculum";

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

/** Deterministic PRNG (mulberry32) */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle — correct answer lands on A/B/C/D evenly */
function shuffleOptions(
  options: string[],
  correctIndex: number,
  seed: number
): { options: string[]; correctIndex: number } {
  const rand = rng(seed);
  const pairs = options.map((text, i) => ({ text, correct: i === correctIndex }));
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return {
    options: pairs.map((p) => p.text),
    correctIndex: pairs.findIndex((p) => p.correct),
  };
}

function pick<T>(arr: T[], seed: number) {
  return arr[seed % arr.length];
}

export function buildChapterQuiz(
  chapter: Chapter & { subjectName?: string },
  count = 10
): QuizQuestion[] {
  const topic = chapter.topics[0] || chapter.title;
  const topic2 = chapter.topics[1] || chapter.topics[0] || "core idea";
  const topic3 = chapter.topics[2] || topic2;
  const subj = chapter.subjectName || "this subject";
  const base = hash(chapter.id + chapter.title);

  const distractors = [
    "A concept from an unrelated chapter",
    "Only used in competitive exams abroad",
    "Removed from the latest CBSE syllabus",
    "A sports statistic, not NCERT content",
    "An optional activity with no marks",
    "A definition that applies only to Class 6",
    "Purely historical trivia without science link",
    "A cooking measurement system",
  ];

  const templates: Array<Omit<QuizQuestion, "id" | "chapterId">> = [
    {
      prompt: `Which idea is central to “${chapter.title}”?`,
      options: [topic, distractors[0], distractors[1], distractors[3]],
      correctIndex: 0,
      explanation: `NCERT builds this chapter around ${topic}.`,
      difficulty: "rapid",
    },
    {
      prompt: `In “${chapter.title}”, ${topic} is best linked with:`,
      options: [
        topic2,
        "Ignoring NCERT examples",
        "Skipping all diagrams",
        "Memorizing only YouTube titles",
      ],
      correctIndex: 0,
      explanation: `${topic} connects naturally with ${topic2}.`,
      difficulty: "rapid",
    },
    {
      prompt: `Best board-prep method for “${chapter.title}” is:`,
      options: [
        "NCERT lines + examples + PYQs + self-explain",
        "Only last-night mugging",
        "Deleting notes after one read",
        "Avoiding numerical practice forever",
      ],
      correctIndex: 0,
      explanation: "Active recall with NCERT + PYQs scores method marks.",
      difficulty: "rapid",
    },
    {
      prompt: `A frequent trap in “${chapter.title}” is:`,
      options: [
        `Mixing similar terms without grasping ${topic}`,
        "Reading NCERT too carefully",
        "Labeling diagrams neatly",
        "Writing units in the final answer",
      ],
      correctIndex: 0,
      explanation: `Students lose marks by confusing ideas around ${topic}.`,
      difficulty: "standard",
    },
    {
      prompt: `Why do PYQs keep returning to “${chapter.title}”?`,
      options: [
        `${topic} is a foundation for later ${subj} chapters`,
        "It is marked optional in CBSE",
        "It has no real applications",
        "Teachers never set it",
      ],
      correctIndex: 0,
      explanation: "Foundational chapters feed application questions.",
      difficulty: "standard",
    },
    {
      prompt: `If a question mentions “${topic3}”, open which chapter first?`,
      options: [
        chapter.title,
        "An unrelated elective topic",
        "Only grammar rules",
        "Leave the answer blank always",
      ],
      correctIndex: 0,
      explanation: `${topic3} sits inside “${chapter.title}”.`,
      difficulty: "rapid",
    },
    {
      prompt: `For presentation marks in “${chapter.title}”, you should:`,
      options: [
        "Write clear steps, keywords, and underline the final result",
        "Give one-word answers only",
        "Never draw a labeled figure",
        "Skip units and conditions",
      ],
      correctIndex: 0,
      explanation: "Method marks come from structured steps.",
      difficulty: "challenge",
    },
    {
      prompt: `“${chapter.title}” mainly strengthens:`,
      options: [topic, distractors[4], distractors[5], distractors[6]],
      correctIndex: 0,
      explanation: `Keyword to lock: ${topic}.`,
      difficulty: "rapid",
    },
    {
      prompt: `Right after finishing “${chapter.title}”, do this next:`,
      options: [
        "Solve exemplar/PYQ set and tag weak sub-topics",
        "Stop the subject for the year",
        "Throw away worked examples",
        "Avoid any revision",
      ],
      correctIndex: 0,
      explanation: "Immediate practice freezes learning into memory.",
      difficulty: "standard",
    },
    {
      prompt: `NCERT examples in “${chapter.title}” matter because:`,
      options: [
        "Board wording often mirrors NCERT logic",
        "NCERT is never used by CBSE",
        "Examples are only decoration",
        "Guides replace NCERT completely",
      ],
      correctIndex: 0,
      explanation: "CBSE stays close to NCERT phrasing and steps.",
      difficulty: "standard",
    },
    {
      prompt: `Ignoring ${topic} while revising “${chapter.title}” usually means:`,
      options: [
        "Easy direct/application marks slip away",
        "Automatic full marks",
        "No change in score",
        "Extra grace marks",
      ],
      correctIndex: 0,
      explanation: `${topic} is a high-yield scoring zone.`,
      difficulty: "challenge",
    },
    {
      prompt: `Pick the FALSE statement about “${chapter.title}”.`,
      options: [
        "It has zero link to board exam questions",
        `It develops ${topic} carefully`,
        `It uses ideas like ${topic2}`,
        "NCERT examples support application items",
      ],
      correctIndex: 0,
      explanation: "The false claim is that it has zero board link — it does not.",
      difficulty: "challenge",
    },
  ];

  // Pick `count` templates with rotation so not always same first N
  const start = base % templates.length;
  const ordered = [
    ...templates.slice(start),
    ...templates.slice(0, start),
  ].slice(0, count);

  return ordered.map((t, i) => {
    const seed = base + i * 97 + hash(t.prompt);
    const shuffled = shuffleOptions(t.options, t.correctIndex, seed);
    return {
      id: `${chapter.id}-q${i + 1}`,
      chapterId: chapter.id,
      prompt: t.prompt,
      explanation: t.explanation,
      difficulty: t.difficulty,
      options: shuffled.options,
      correctIndex: shuffled.correctIndex,
    };
  });
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
  const selected = Array.from({ length: Math.min(n, pool.length) }, (_, i) =>
    pick(pool, seed + i * 13)
  );
  return selected.flatMap((c) => buildChapterQuiz(c, 1));
}
