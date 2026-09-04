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

/** Deterministic hash for stable question variants */
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number) {
  return arr[seed % arr.length];
}

/** Build rapid-revision MCQs from chapter metadata (scalable across all chapters) */
export function buildChapterQuiz(chapter: Chapter & { subjectName?: string }, count = 10): QuizQuestion[] {
  const topic = chapter.topics[0] || chapter.title;
  const topic2 = chapter.topics[1] || chapter.title;
  const subj = chapter.subjectName || "this subject";
  const base = hash(chapter.id);

  const templates: Array<Omit<QuizQuestion, "id" | "chapterId">> = [
    {
      prompt: `Rapid revision: Which concept is central to “${chapter.title}”?`,
      options: [
        topic,
        "Unrelated historical date only",
        "Random sports statistic",
        "None of the NCERT syllabus ideas",
      ],
      correctIndex: 0,
      explanation: `NCERT focuses on ${topic} in this chapter.`,
      difficulty: "rapid",
    },
    {
      prompt: `For Class revision of ${chapter.title}, ${topic} is best described as:`,
      options: [
        `A core idea linked to ${topic2}`,
        "A topic removed from CBSE",
        "Only for competitive exams abroad",
        "Not needed for board exams",
      ],
      correctIndex: 0,
      explanation: `${topic} connects with ${topic2} in the chapter flow.`,
      difficulty: "rapid",
    },
    {
      prompt: `Which study approach helps most for “${chapter.title}”?`,
      options: [
        "Definitions + NCERT examples + PYQ practice",
        "Memorizing only social media summaries",
        "Skipping diagrams completely",
        "Ignoring in-text questions",
      ],
      correctIndex: 0,
      explanation: "Board success needs NCERT line + examples + past questions.",
      difficulty: "rapid",
    },
    {
      prompt: `A common exam trap in ${chapter.title} is:`,
      options: [
        "Confusing similar terms without understanding ${topic}",
        "Reading the full NCERT carefully",
        "Practicing numerical steps",
        "Writing neat diagrams",
      ].map((o) => o.replace("${topic}", topic)),
      correctIndex: 0,
      explanation: `Students often mix terms around ${topic}.`,
      difficulty: "standard",
    },
    {
      prompt: `PYQ-style: Why does CBSE repeatedly test ideas from “${chapter.title}”?`,
      options: [
        `Because ${topic} builds foundations for later ${subj} chapters`,
        "Because it is optional reading",
        "Because it is only for internal assessment",
        "Because it has no real applications",
      ],
      correctIndex: 0,
      explanation: "Foundational chapters appear often in application questions.",
      difficulty: "standard",
    },
    {
      prompt: `Quick check: Select the BEST revision order for this chapter.`,
      options: [
        "Key definitions → worked example → 5 PYQs → self-explain",
        "Only last-minute YouTube shorts",
        "Skip NCERT, only guide book",
        "Read once, never practice",
      ],
      correctIndex: 0,
      explanation: "Active recall + PYQs beat passive reading.",
      difficulty: "rapid",
    },
    {
      prompt: `If a question mentions “${topic2}”, which chapter should you recall first?`,
      options: [
        chapter.title,
        "An unrelated chapter from another subject",
        "Only Class 6 basics",
        "None — leave blank",
      ],
      correctIndex: 0,
      explanation: `${topic2} is listed under ${chapter.title}.`,
      difficulty: "rapid",
    },
    {
      prompt: `Challenge: Which statement is TRUE for exam presentation of ${chapter.title}?`,
      options: [
        "Write steps/keywords clearly and underline final result",
        "Write only one word answers always",
        "Never draw labeled diagrams",
        "Ignore units and conditions",
      ],
      correctIndex: 0,
      explanation: "Clear steps and keywords score method marks.",
      difficulty: "challenge",
    },
    {
      prompt: `Flash drill: ${chapter.title} primarily strengthens understanding of:`,
      options: [topic, "Cricket rules", "Cooking recipes", "Movie reviews"],
      correctIndex: 0,
      explanation: `Focus keyword: ${topic}.`,
      difficulty: "rapid",
    },
    {
      prompt: `Board mindset: After finishing ${chapter.title}, you should next:`,
      options: [
        "Solve exemplar/PYQ set and mark weak sub-topics",
        "Stop studying the subject forever",
        "Delete notes",
        "Avoid revision",
      ],
      correctIndex: 0,
      explanation: "Immediate practice locks retention.",
      difficulty: "standard",
    },
    {
      prompt: `Assertion style: Careful reading of NCERT examples in “${chapter.title}” is useful because:`,
      options: [
        "Board questions often mirror NCERT language and logic",
        "NCERT is never used by CBSE",
        "Examples are only for decoration",
        "Teachers never ask from NCERT",
      ],
      correctIndex: 0,
      explanation: "CBSE stays close to NCERT phrasing.",
      difficulty: "standard",
    },
    {
      prompt: `Error-spotting: A student ignores ${topic} while revising ${chapter.title}. Result?`,
      options: [
        "Likely loss of easy marks on direct/application items",
        "Guaranteed full marks",
        "No impact at all",
        "Extra grace marks",
      ],
      correctIndex: 0,
      explanation: `${topic} is a scoring keyword area.`,
      difficulty: "challenge",
    },
  ];

  return templates.slice(0, count).map((t, i) => {
    // light shuffle of options with stable seed
    const seed = base + i * 17;
    const opts = [...t.options];
    if (seed % 2 === 0) {
      const a = seed % opts.length;
      const b = (seed + 1) % opts.length;
      if (a !== b) {
        const correctVal = opts[t.correctIndex];
        [opts[a], opts[b]] = [opts[b], opts[a]];
        return {
          id: `${chapter.id}-q${i + 1}`,
          chapterId: chapter.id,
          ...t,
          options: opts,
          correctIndex: opts.indexOf(correctVal),
        };
      }
    }
    return {
      id: `${chapter.id}-q${i + 1}`,
      chapterId: chapter.id,
      ...t,
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
