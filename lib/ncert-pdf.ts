/**
 * Convert NCERT textbook.php style links / book codes into direct PDF URLs
 * so we can embed them in-app (same tab, no external jump when possible).
 *
 * Example: code leph1, chapter 3 → https://ncert.nic.in/textbook/pdf/leph103.pdf
 */

export function chapterPdfUrl(bookCode: string, bookChapter: number): string {
  const code = bookCode.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const n = String(Math.max(1, bookChapter)).padStart(2, "0");
  return `https://ncert.nic.in/textbook/pdf/${code}${n}.pdf`;
}

/** Parse textbook.php?leph1=3-14 → { code, ch } */
export function parseTextbookPhp(url: string): { code: string; ch: number } | null {
  try {
    const u = new URL(url);
    // query like leph1=3-14
    for (const [k, v] of u.searchParams.entries()) {
      if (/^[a-z]+\d+$/i.test(k) && /^\d+/.test(v)) {
        const ch = parseInt(v.split("-")[0], 10);
        if (!Number.isNaN(ch)) return { code: k, ch };
      }
    }
    // sometimes ?leph1=3-14 is the whole search without standard parse
    const q = u.search.replace(/^\?/, "");
    const m = q.match(/^([a-z]+\d+)=(\d+)/i);
    if (m) return { code: m[1], ch: parseInt(m[2], 10) };
  } catch {
    // ignore
  }
  return null;
}

export function resolveEmbeddablePdf(ncertLink?: string): string | null {
  if (!ncertLink) return null;
  if (/\.pdf(\?|$)/i.test(ncertLink)) return ncertLink;
  const parsed = parseTextbookPhp(ncertLink);
  if (parsed) return chapterPdfUrl(parsed.code, parsed.ch);
  return null;
}

/** Google Docs embedded viewer — keeps user on SmartLearn chrome */
export function googleEmbedPdf(pdfUrl: string) {
  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(pdfUrl)}`;
}
