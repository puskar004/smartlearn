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
    if (u.hostname === "ncert.nic.in") {
      list.push(url.replace("://ncert.nic.in", "://www.ncert.nic.in"));
    }
    if (u.hostname === "www.ncert.nic.in") {
      list.push(url.replace("://www.ncert.nic.in", "://ncert.nic.in"));
    }
    if (u.hostname.includes("ncert") || u.hostname.includes("cbse")) {
      list.push(`https://web.archive.org/web/0id_/${url}`);
    }
  } catch {
    // ignore
  }
  return Array.from(new Set(list));
}

async function fetchBytes(url: string, ms = 20000): Promise<Uint8Array | null> {
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

/** Download PDF bytes from http(s) hosts (handles tmpfiles HTML pages). */
export async function resolvePdfBytes(url: string): Promise<Uint8Array | null> {
  if (url.startsWith("data:")) return decodeDataUrl(url);

  for (const candidate of candidates(url)) {
    const buf = await fetchBytes(candidate);
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
  if (h.includes("tmpfiles.org")) return true;
  if (h.includes("catbox.moe")) return true;
  if (h.includes("google")) return true;
  return false;
}
