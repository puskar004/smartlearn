/** Shared PDF download helpers (proxy + classroom open). */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export function isPdfBytes(buf: Uint8Array) {
  if (buf.byteLength < 5) return false;
  return (
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  );
}

function extractTmpfilesDl(html: string, base: string): string | null {
  const m =
    html.match(/https?:\/\/(?:www\.)?tmpfiles\.org\/dl\/[^\s"'<>]+/i) ||
    html.match(/href="(\/dl\/[^"]+)"/i);
  if (!m) return null;
  const raw = m[1] || m[0];
  try {
    return new URL(raw, base).href;
  } catch {
    return null;
  }
}

/** NCERT textbook.php → direct pdf path candidates */
export function ncertDirectPdfCandidates(url: string): string[] {
  const out: string[] = [];
  try {
    const u = new URL(url);
    // Already a pdf
    if (/\.pdf$/i.test(u.pathname)) {
      out.push(url);
      if (u.hostname === "ncert.nic.in") {
        out.push(url.replace("://ncert.nic.in", "://www.ncert.nic.in"));
      }
      if (u.hostname === "www.ncert.nic.in") {
        out.push(url.replace("://www.ncert.nic.in", "://ncert.nic.in"));
      }
      return out;
    }
    // textbook.php?jess2=1-7 → jess201.pdf
    for (const [k, v] of u.searchParams.entries()) {
      if (/^[a-z]+\d+$/i.test(k) && /^\d+/.test(v)) {
        const ch = parseInt(v.split("-")[0], 10);
        if (!Number.isNaN(ch) && ch > 0) {
          const code = k.toLowerCase();
          const n = String(ch).padStart(2, "0");
          out.push(`https://ncert.nic.in/textbook/pdf/${code}${n}.pdf`);
          out.push(`https://www.ncert.nic.in/textbook/pdf/${code}${n}.pdf`);
        }
      }
    }
  } catch {
    // ignore
  }
  return out;
}

async function waybackSnapshots(originalUrl: string): Promise<string[]> {
  const urls: string[] = [];
  // Fast identity replay (often works when live NCERT blocks cloud IPs)
  urls.push(`https://web.archive.org/web/0id_/${originalUrl}`);
  urls.push(`https://web.archive.org/web/2024id_/${originalUrl}`);
  urls.push(`https://web.archive.org/web/2023id_/${originalUrl}`);
  urls.push(`https://web.archive.org/web/2022id_/${originalUrl}`);

  try {
    const cdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(
      originalUrl
    )}&output=json&fl=timestamp,statuscode&filter=statuscode:200&limit=6&rel=0`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(cdx, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(t);
    if (res.ok) {
      const rows = (await res.json()) as string[][];
      // first row is header
      for (let i = 1; i < rows.length; i++) {
        const ts = rows[i]?.[0];
        if (ts) {
          urls.push(
            `https://web.archive.org/web/${ts}id_/${originalUrl}`
          );
        }
      }
    }
  } catch {
    // ignore CDX failures
  }
  return Array.from(new Set(urls));
}

function candidates(url: string): string[] {
  const list = [url];
  try {
    const u = new URL(url);
    if (u.hostname.includes("tmpfiles.org")) {
      const path = u.pathname.replace(/\/+$/, "");
      if (!path.includes("/dl/")) {
        list.push(`https://tmpfiles.org/dl${path}`);
        list.push(`https://tmpfiles.org${path}`);
      } else {
        const pagePath = path.replace(/^\/dl\/[^/]+/, "") || path;
        list.push(
          `https://tmpfiles.org${pagePath.startsWith("/") ? pagePath : `/${pagePath}`}`
        );
      }
    }
    if (u.hostname.includes("ncert") || /textbook\.php/i.test(url)) {
      list.push(...ncertDirectPdfCandidates(url));
    }
    if (u.hostname === "ncert.nic.in") {
      list.push(url.replace("://ncert.nic.in", "://www.ncert.nic.in"));
    }
    if (u.hostname === "www.ncert.nic.in") {
      list.push(url.replace("://www.ncert.nic.in", "://ncert.nic.in"));
    }
  } catch {
    // ignore
  }
  return Array.from(new Set(list));
}

async function fetchBytes(url: string, ms = 22000): Promise<Uint8Array | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/pdf,application/octet-stream,*/*",
        "Accept-Language": "en-IN,en;q=0.9",
        Referer: "https://ncert.nic.in/",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength ? buf : null;
  } catch {
    return null;
  }
}

export function decodeDataUrl(dataUrl: string): Uint8Array | null {
  try {
    if (!dataUrl.startsWith("data:")) return null;
    const comma = dataUrl.indexOf(",");
    if (comma < 0) return null;
    const meta = dataUrl.slice(0, comma);
    const payload = dataUrl.slice(comma + 1);
    const bin = /;base64/i.test(meta)
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    return new Uint8Array(bin);
  } catch {
    return null;
  }
}

/** Download PDF bytes from http(s) hosts (NCERT via Wayback when blocked). */
export async function resolvePdfBytes(url: string): Promise<Uint8Array | null> {
  if (url.startsWith("data:")) return decodeDataUrl(url);

  const primary = [
    ...expandArchiveUrl(url),
    ...candidates(url),
  ].filter((v, i, a) => a.indexOf(v) === i);
  const isNcert =
    /ncert\.nic\.in|textbook\.php|web\.archive\.org/i.test(url) ||
    primary.some((c) => /ncert\.nic\.in/i.test(c));

  // Archive-first codes (live NCERT 404, Wayback has files) e.g. iict1 IT/ICT
  const archiveFirst = /\/(iict|kect|jeit)\d/i.test(url + primary.join(" "));

  const pdfTargets = primary.filter(
    (c) => /\.pdf(\?|$)/i.test(c) || /ncert\.nic\.in/i.test(c)
  );

  const tryList = async (list: string[], ms: number) => {
    for (const candidate of list) {
      const buf = await fetchBytes(candidate, ms);
      if (!buf) continue;
      if (isPdfBytes(buf)) return buf;
      const head = new TextDecoder().decode(
        buf.slice(0, Math.min(buf.length, 12000))
      );
      if (/<!DOCTYPE|<html/i.test(head)) {
        const dl = extractTmpfilesDl(head, candidate);
        if (dl) {
          const pdf = await fetchBytes(dl);
          if (pdf && isPdfBytes(pdf)) return pdf;
        }
      }
    }
    return null;
  };

  // 1) Wayback first for archive-only / blocked IT books
  if (archiveFirst || isNcert) {
    for (const target of pdfTargets.slice(0, 4)) {
      const snaps = await waybackSnapshots(target);
      const hit = await tryList(snaps.slice(0, 8), 25000);
      if (hit) return hit;
    }
  }

  // 2) Live hosts
  const live = await tryList(primary, isNcert ? 12000 : 20000);
  if (live) return live;

  // 3) Wayback fallback for remaining
  if (!archiveFirst) {
    for (const target of pdfTargets.slice(0, 4)) {
      const snaps = await waybackSnapshots(target);
      const hit = await tryList(snaps.slice(0, 6), 25000);
      if (hit) return hit;
    }
  }

  return null;
}

export function hostAllowed(host: string) {
  const h = host.toLowerCase();
  if (
    [
      "ncert.nic.in",
      "cbseacademic.nic.in",
      "cbse.gov.in",
      "cdn.cbse.gov.in",
      "web.archive.org",
      "tmpfiles.org",
      "catbox.moe",
      "files.catbox.moe",
      "litter.catbox.moe",
      "0x0.st",
      "drive.google.com",
      "docs.google.com",
      "googleapis.com",
    ].some((x) => h === x || h.endsWith(`.${x}`))
  )
    return true;
  if (h.includes("blob.vercel-storage.com")) return true;
  if (h.includes("supabase.co")) return true;
  if (h.includes("supabase.in")) return true;
  if (h.includes("tmpfiles.org")) return true;
  if (h.includes("catbox.moe")) return true;
  if (h.includes("google")) return true;
  if (h.includes("archive.org")) return true;
  return false;
}

/** Expand wayback + www variants when input is already archive URL */
export function expandArchiveUrl(url: string): string[] {
  const list = [url];
  try {
    const u = new URL(url);
    if (u.hostname.includes("web.archive.org")) {
      // extract original
      const m = u.pathname.match(/\/web\/[^/]+\/(https?:\/.+)$/);
      if (m) {
        const orig = m[1];
        list.push(orig);
        list.push(`https://web.archive.org/web/0id_/${orig}`);
        if (orig.includes("ncert.nic.in")) {
          list.push(
            orig.replace("ncert.nic.in", "www.ncert.nic.in")
          );
        }
      }
    }
  } catch {
    // ignore
  }
  return Array.from(new Set(list));
}
