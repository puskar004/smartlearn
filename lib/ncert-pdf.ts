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
        if (!Number.isNaN(ch) && ch > 0) return { code: k, ch };
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

/** Normalize host landing pages to a fetchable PDF URL when possible */
export function normalizeTeacherPdfUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (/tmpfiles\.org/i.test(u) && !/\/dl\//i.test(u)) {
    try {
      return new URL(u).href;
    } catch {
      return u;
    }
  }
  return u;
}

export function resolveEmbeddablePdf(ncertLink?: string): string | null {
  if (!ncertLink) return null;
  const u = normalizeTeacherPdfUrl(ncertLink.trim());

  if (
    u.startsWith("data:application/pdf") ||
    u.startsWith("data:application/octet-stream")
  )
    return u;

  if (u.startsWith("/api/")) return u;

  // textbook.php?jess2=1-7 → direct PDF (must run before generic https)
  const parsed = parseTextbookPhp(u);
  if (parsed) return chapterPdfUrl(parsed.code, parsed.ch);

  // already a direct ncert pdf
  if (/\.pdf(\?|$)/i.test(u)) return u;

  if (
    /^https?:\/\//i.test(u) &&
    /pdf|drive\.google|tmpfiles|catbox|blob\.vercel|0x0\.st|ncert|web\.archive/i.test(
      u
    )
  )
    return u;

  if (/^https?:\/\//i.test(u)) return u;
  return null;
}

/** Same-origin proxy — avoids Chrome X-Frame / “page blocked” on ncert.nic.in */
export function proxiedPdf(pdfUrl: string) {
  if (
    pdfUrl.startsWith("data:") ||
    pdfUrl.startsWith("/api/") ||
    pdfUrl.startsWith("/")
  ) {
    return pdfUrl;
  }
  return `/api/pdf-proxy?url=${encodeURIComponent(pdfUrl)}`;
}

/** Google Docs viewer fallback (works when NCERT blocks cloud IPs) */
export function googleEmbedPdf(pdfUrl: string) {
  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(pdfUrl)}`;
}

export function pdfJsEmbed(pdfUrl: string) {
  return `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
    typeof window !== "undefined"
      ? `${window.location.origin}${proxiedPdf(pdfUrl)}`
      : pdfUrl
  )}`;
}

export function inAppPdfSrc(pdfUrl: string, origin?: string) {
  const proxy = proxiedPdf(pdfUrl);
  const abs =
    origin && proxy.startsWith("/") ? `${origin}${proxy}` : proxy;
  return abs;
}

export function isNcertUrl(url?: string | null) {
  if (!url) return false;
  return /ncert\.nic\.in|textbook\.php/i.test(url);
}
