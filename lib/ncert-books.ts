/**
 * Official NCERT book codes → direct PDF URLs.
 * https://ncert.nic.in/textbook/pdf/{code}{ch}.pdf
 */
export type BookSpan = {
  code: string;
  from: number;
  to: number;
  bookTotal: number;
  bookStart?: number;
  /** Live NCERT 404 but Wayback has files */
  archiveOnly?: boolean;
};

/** key = `${grade}-${subjectId}` */
export const NCERT_BOOKS: Record<string, BookSpan[]> = {
  // Class 10
  "10-science": [{ code: "jesc1", from: 1, to: 13, bookTotal: 13 }],
  "10-maths": [{ code: "jemh1", from: 1, to: 14, bookTotal: 14 }],
  "10-sst": [
    { code: "jess3", from: 1, to: 5, bookTotal: 5 }, // History
    { code: "jess2", from: 6, to: 12, bookTotal: 7, bookStart: 1 }, // Geography
    { code: "jess4", from: 13, to: 17, bookTotal: 5, bookStart: 1 }, // Pol Sci
    { code: "jess1", from: 18, to: 22, bookTotal: 5, bookStart: 1 }, // Economics
  ],
  "10-english": [{ code: "jeff1", from: 1, to: 9, bookTotal: 11 }],
  "10-hindi": [{ code: "jhsp1", from: 1, to: 9, bookTotal: 17 }],
  // CBSE IT (402) has no live NCERT chapter PDFs; ICT book iict1 is on Wayback
  "10-it": [
    { code: "iict1", from: 1, to: 4, bookTotal: 8, archiveOnly: true },
  ],

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
    { code: "kehb1", from: 1, to: 5, bookTotal: 8 },
    { code: "kesn1", from: 6, to: 10, bookTotal: 5, bookStart: 1 },
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
    { code: "lefl1", from: 1, to: 13, bookTotal: 14 },
    { code: "levs1", from: 14, to: 19, bookTotal: 6, bookStart: 1 },
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
    { code: "leec2", from: 1, to: 5, bookTotal: 5 },
    { code: "leec1", from: 6, to: 13, bookTotal: 8, bookStart: 1 },
  ],
};

/** Codes known missing on live NCERT but present on Wayback */
export const ARCHIVE_FIRST_CODES = new Set([
  "iict1",
  "iict2",
  "kect1",
  "kect2",
]);

export function chapterDirectPdf(code: string, bookChapter: number): string {
  const c = code.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const n = String(Math.max(1, bookChapter)).padStart(2, "0");
  return `https://ncert.nic.in/textbook/pdf/${c}${n}.pdf`;
}

export function resolveBookChapter(
  grade: string,
  subjectId: string,
  chapterNumber: number
): { code: string; bookCh: number; archiveOnly?: boolean } | null {
  const spans = NCERT_BOOKS[`${grade}-${subjectId}`];
  if (!spans?.length) return null;
  const span = spans.find(
    (s) => chapterNumber >= s.from && chapterNumber <= s.to
  );
  if (!span) return null;
  const bookCh =
    (span.bookStart ?? 1) + (chapterNumber - span.from);
  return {
    code: span.code,
    bookCh,
    archiveOnly: span.archiveOnly || ARCHIVE_FIRST_CODES.has(span.code),
  };
}

/** Direct PDF URL (preferred for in-app reader) */
export function resolveNcertPdfUrl(
  grade: string,
  subjectId: string,
  chapterNumber: number
): string | undefined {
  const hit = resolveBookChapter(grade, subjectId, chapterNumber);
  if (!hit) return undefined;
  const live = chapterDirectPdf(hit.code, hit.bookCh);
  // IT/ICT etc.: live NCERT 404 — use Wayback identity capture (real PDF bytes)
  if (hit.archiveOnly || ARCHIVE_FIRST_CODES.has(hit.code)) {
    return `https://web.archive.org/web/0id_/${live}`;
  }
  return live;
}

/** textbook.php portal URL (Source tab) */
export function resolveNcertUrl(
  grade: string,
  subjectId: string,
  chapterNumber: number
): string | undefined {
  const spans = NCERT_BOOKS[`${grade}-${subjectId}`];
  if (!spans?.length) {
    return `https://ncert.nic.in/textbook.php?class=${grade}`;
  }
  const span = spans.find(
    (s) => chapterNumber >= s.from && chapterNumber <= s.to
  );
  if (!span) {
    const first = spans[0];
    return `https://ncert.nic.in/textbook.php?${first.code}=1-${first.bookTotal}`;
  }
  const bookCh =
    (span.bookStart ?? 1) + (chapterNumber - span.from);
  return `https://ncert.nic.in/textbook.php?${span.code}=${bookCh}-${span.bookTotal}`;
}

export function resolveSubjectBookUrl(grade: string, subjectId: string): string {
  const spans = NCERT_BOOKS[`${grade}-${subjectId}`];
  if (!spans?.length) return `https://ncert.nic.in/textbook.php?class=${grade}`;
  const s = spans[0];
  return `https://ncert.nic.in/textbook.php?${s.code}=1-${s.bookTotal}`;
}

/** Parse jesc1=3-16 style → direct pdf */
export function ncertCodeToPdf(codeEq: string): string | null {
  const m = codeEq.trim().match(/^([a-z]+\d+)\s*=\s*(\d+)/i);
  if (!m) return null;
  return chapterDirectPdf(m[1], parseInt(m[2], 10));
}
