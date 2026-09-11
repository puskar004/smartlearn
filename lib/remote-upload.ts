/** Durable public file upload (avoids Vercel /tmp loss). */

function toBlob(buf: Buffer, contentType: string) {
  const ab = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  ) as ArrayBuffer;
  return new Blob([ab], { type: contentType });
}

async function resolveTmpfilesDirectUrl(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,*/*",
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    const m =
      html.match(
        /https?:\/\/(?:www\.)?tmpfiles\.org\/dl\/[^\s"'<>]+/i
      ) || html.match(/href="(\/dl\/[^"]+)"/i);
    if (!m) return null;
    const raw = m[1] || m[0];
    return new URL(raw, pageUrl).href;
  } catch {
    return null;
  }
}

async function tryLitterbox(
  buf: Buffer,
  filename: string,
  contentType: string
): Promise<string | null> {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("time", "72h");
  form.append("fileToUpload", toBlob(buf, contentType), filename);
  const res = await fetch(
    "https://litterbox.catbox.moe/resources/internals/api.php",
    { method: "POST", body: form, signal: AbortSignal.timeout(18000) }
  );
  const text = (await res.text()).trim();
  return /^https?:\/\//i.test(text) ? text : null;
}

async function tryCatbox(
  buf: Buffer,
  filename: string,
  contentType: string
): Promise<string | null> {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", toBlob(buf, contentType), filename);
  const res = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(18000),
  });
  const text = (await res.text()).trim();
  return /^https?:\/\//i.test(text) ? text : null;
}

async function try0x0(
  buf: Buffer,
  filename: string,
  contentType: string
): Promise<string | null> {
  const form = new FormData();
  form.append("file", toBlob(buf, contentType), filename);
  const res = await fetch("https://0x0.st", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(18000),
  });
  const text = (await res.text()).trim();
  return /^https?:\/\//i.test(text) ? text : null;
}

async function tryTmpfiles(
  buf: Buffer,
  filename: string,
  contentType: string
): Promise<string | null> {
  const form = new FormData();
  form.append("file", toBlob(buf, contentType), filename);
  const res = await fetch("https://tmpfiles.org/api/v1/upload", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(18000),
  });
  const data = (await res.json().catch(() => null)) as {
    status?: string;
    data?: { url?: string };
  } | null;
  const pageUrl = data?.data?.url;
  if (!pageUrl || !/^https?:\/\//i.test(pageUrl)) return null;
  const direct = await resolveTmpfilesDirectUrl(pageUrl);
  if (direct) return direct;
  return pageUrl.replace("tmpfiles.org/", "tmpfiles.org/dl/");
}

async function tryFileIo(
  buf: Buffer,
  filename: string,
  contentType: string
): Promise<string | null> {
  const form = new FormData();
  form.append("file", toBlob(buf, contentType), filename);
  const res = await fetch("https://file.io/?expires=14d", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(18000),
  });
  const data = (await res.json().catch(() => null)) as {
    success?: boolean;
    link?: string;
  } | null;
  const url = data?.link;
  return url && /^https?:\/\//i.test(url) ? url : null;
}

/**
 * Upload buffer to a public host. Tries Vercel Blob first, then hosts
 * one-by-one (more reliable than racing all at once on flaky networks).
 */
export async function uploadBufferRemote(
  buf: Buffer,
  filename: string,
  contentType = "application/octet-stream"
): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(`smartlearn/${Date.now()}-${filename}`, buf, {
        access: "public",
        token,
        contentType,
        addRandomSuffix: true,
      });
      if (blob?.url) return blob.url;
    } catch (e) {
      console.error("vercel blob", e);
    }
  }

  const hosts = [
    () => tryCatbox(buf, filename, contentType),
    () => tryLitterbox(buf, filename, contentType),
    () => tryTmpfiles(buf, filename, contentType),
    () => try0x0(buf, filename, contentType),
    () => tryFileIo(buf, filename, contentType),
  ];

  for (const run of hosts) {
    try {
      const url = await run();
      if (url && /^https?:\/\//i.test(url)) return url;
    } catch (e) {
      console.warn("host fail", e);
    }
  }
  return null;
}
