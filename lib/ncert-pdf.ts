/**
 * NCERT textbook.php → direct PDF, then same-origin proxy so Chrome can embed.
 */

export function chapterPdfUrl(bookCode: string, bookChapter: number): string {
  const code = bookCode.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const n = String(Math.max(1, bookChapter)).padStart(2, "0");
  return `https://ncert.nic.in/textbook/pdf/${code}${n}.pdf`;
}

export function parseTextbookPhp(
  url: string
): { code: string; ch: number } | null {
  try {
    const u = new URL(url);
    for (const [k, v] of u.searchParams.entries()) {
      if (/^[a-z]+\d+$/i.test(k) && /^\d+/.test(v)) {
        const ch = parseInt(v.split("-")[0], 10);
        if (!Number.isNaN(ch)) return { code: k, ch };
      }
    }
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

/** Same-origin proxy — avoids Chrome X-Frame / “page blocked” on ncert.nic.in */
export function proxiedPdf(pdfUrl: string) {
  return `/api/pdf-proxy?url=${encodeURIComponent(pdfUrl)}`;
}

/** Google Docs viewer fallback */
export function googleEmbedPdf(pdfUrl: string) {
  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(pdfUrl)}`;
}

/** Mozilla PDF.js viewer with our proxy (most reliable in-app) */
export function pdfJsEmbed(pdfUrl: string) {
  const file = encodeURIComponent(proxiedPdf(pdfUrl));
  // Use pdf.js from CDN viewer
  return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
    typeof window !== "undefined"
      ? `${window.location.origin}${proxiedPdf(pdfUrl)}`
      : pdfUrl
  )}`;
}

export function inAppPdfSrc(pdfUrl: string, origin?: string) {
  const proxy = proxiedPdf(pdfUrl);
  const abs =
    origin && proxy.startsWith("/")
      ? `${origin}${proxy}`
      : proxy;
  // Prefer native browser PDF via same-origin proxy (no third-party frame)
  return abs;
}
