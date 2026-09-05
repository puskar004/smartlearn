/**
 * Official NCERT textbook.php codes (chapter index within book).
 * https://ncert.nic.in/textbook.php?{code}={ch}-{total}
 */
export type BookSpan = {
  code: string;
  /** Inclusive chapter numbers in OUR curriculum that map into this book */
  from: number;
  to: number;
  /** Total chapters in the NCERT book (URL suffix) */
  bookTotal: number;
  /** Offset: our ch N → book chapter (N - from + bookStart) */
  bookStart?: number;
};

/** key = `${grade}-${subjectId}` */
export const NCERT_BOOKS: Record<string, BookSpan[]> = {
  // Class 10
  "10-science": [{ code: "jesc1", from: 1, to: 13, bookTotal: 16 }],
  "10-maths": [{ code: "jemh1", from: 1, to: 14, bookTotal: 15 }],
  "10-sst": [
    { code: "jess3", from: 1, to: 5, bookTotal: 5 }, // History
    { code: "jess2", from: 6, to: 12, bookTotal: 7, bookStart: 1 }, // Geography
    { code: "jess4", from: 13, to: 17, bookTotal: 5, bookStart: 1 }, // Pol Sci
    { code: "jess1", from: 18, to: 22, bookTotal: 5, bookStart: 1 }, // Economics
  ],
  "10-english": [
    { code: "jeff1", from: 1, to: 9, bookTotal: 11 }, // First Flight (prose+poetry mix)
  ],
  "10-hindi": [{ code: "jhsp1", from: 1, to: 9, bookTotal: 17 }],
  "10-it": [{ code: "jeit1", from: 1, to: 4, bookTotal: 4 }],

  // Class 11
  "11-physics": [
    { code: "keph1", from: 1, to: 7, bookTotal: 7 },
    { code: "keph2", from: 8, to: 14, bookTotal: 7, bookStart: 1 },
  ],
  "11-chemistry": [
    { code: "kech1", from: 1, to: 6, bookTotal: 6 },
    { code: "kech2", from: 7, to: 9, bookTotal: 3, bookStart: 1 },
  ],
  "11-maths": [
    { code: "kemh1", from: 1, to: 8, bookTotal: 8 },
    { code: "kemh2", from: 9, to: 14, bookTotal: 6, bookStart: 1 },
  ],
  "11-biology": [
    { code: "kebo1", from: 1, to: 10, bookTotal: 10 },
    { code: "kebo2", from: 11, to: 19, bookTotal: 9, bookStart: 1 },
  ],
  "11-english": [
    { code: "kehb1", from: 1, to: 5, bookTotal: 8 }, // Hornbill
    { code: "kesn1", from: 6, to: 10, bookTotal: 5, bookStart: 1 }, // Snapshots
  ],
  "11-cs": [{ code: "kecs1", from: 1, to: 11, bookTotal: 11 }],

  // Class 12
  "12-physics": [
    { code: "leph1", from: 1, to: 8, bookTotal: 8 },
    { code: "leph2", from: 9, to: 14, bookTotal: 6, bookStart: 1 },
  ],
  "12-chemistry": [
    { code: "lech1", from: 1, to: 5, bookTotal: 5 },
    { code: "lech2", from: 6, to: 10, bookTotal: 5, bookStart: 1 },
  ],
  "12-maths": [
    { code: "lemh1", from: 1, to: 6, bookTotal: 6 },
    { code: "lemh2", from: 7, to: 13, bookTotal: 7, bookStart: 1 },
  ],
  "12-biology": [
    { code: "lebo1", from: 1, to: 8, bookTotal: 8 },
    { code: "lebo2", from: 9, to: 13, bookTotal: 5, bookStart: 1 },
  ],
  "12-english": [
    { code: "lefl1", from: 1, to: 13, bookTotal: 14 }, // Flamingo
    { code: "levs1", from: 14, to: 19, bookTotal: 6, bookStart: 1 }, // Vistas
  ],
  "12-cs": [{ code: "lecs1", from: 1, to: 9, bookTotal: 9 }],
  "12-accountancy": [
    { code: "leac1", from: 1, to: 6, bookTotal: 6 },
    { code: "leac2", from: 7, to: 11, bookTotal: 5, bookStart: 1 },
  ],
  "12-business": [
    { code: "lebs1", from: 1, to: 8, bookTotal: 8 },
    { code: "lebs2", from: 9, to: 12, bookTotal: 4, bookStart: 1 },
  ],
  "12-economics": [
    { code: "leec2", from: 1, to: 5, bookTotal: 5 }, // Macro first in our list
    { code: "leec1", from: 6, to: 13, bookTotal: 8, bookStart: 1 }, // Indian Eco
  ],
};

export function resolveNcertUrl(
  grade: string,
  subjectId: string,
  chapterNumber: number
): string | undefined {
  const spans = NCERT_BOOKS[`${grade}-${subjectId}`];
  if (!spans?.length) {
    // Fallback: NCERT textbook catalogue for that class
    return `https://ncert.nic.in/textbook.php?class=${grade}`;
  }
  const span = spans.find(
    (s) => chapterNumber >= s.from && chapterNumber <= s.to
  );
  if (!span) {
    const first = spans[0];
    return `https://ncert.nic.in/textbook.php?${first.code}=0-${first.bookTotal}`;
  }
  const bookCh =
    (span.bookStart ?? span.from) + (chapterNumber - span.from);
  return `https://ncert.nic.in/textbook.php?${span.code}=${bookCh}-${span.bookTotal}`;
}

/** Subject-level “open full book” link */
export function resolveSubjectBookUrl(grade: string, subjectId: string): string {
  const spans = NCERT_BOOKS[`${grade}-${subjectId}`];
  if (!spans?.length) return `https://ncert.nic.in/textbook.php?class=${grade}`;
  const s = spans[0];
  return `https://ncert.nic.in/textbook.php?${s.code}=0-${s.bookTotal}`;
}
