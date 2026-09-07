/** Durable public file upload (avoids Vercel /tmp loss). */

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

  const bytes = new Uint8Array(buf);

  // litterbox 72h — covers student 48h window
  try {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("time", "72h");
    form.append(
      "fileToUpload",
      new Blob([bytes], { type: contentType }),
      filename
    );
    const res = await fetch(
      "https://litterbox.catbox.moe/resources/internals/api.php",
      { method: "POST", body: form }
    );
    const text = (await res.text()).trim();
    if (/^https?:\/\//i.test(text)) return text;
  } catch (e) {
    console.error("litterbox", e);
  }

  // catbox.moe — permanent direct file URL
  try {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append(
      "fileToUpload",
      new Blob([bytes], { type: contentType }),
      filename
    );
    const res = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: form,
    });
    const text = (await res.text()).trim();
    if (/^https?:\/\//i.test(text)) return text;
  } catch (e) {
    console.error("catbox", e);
  }

  // 0x0.st
  try {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: contentType }), filename);
    const res = await fetch("https://0x0.st", { method: "POST", body: form });
    const text = (await res.text()).trim();
    if (/^https?:\/\//i.test(text)) return text;
  } catch (e) {
    console.error("0x0", e);
  }

  // tmpfiles.org — resolve tokenized /dl/ URL (page URL is HTML only)
  try {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: contentType }), filename);
    const res = await fetch("https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: form,
    });
    const data = (await res.json().catch(() => null)) as {
      status?: string;
      data?: { url?: string };
    } | null;
    const pageUrl = data?.data?.url;
    if (pageUrl && /^https?:\/\//i.test(pageUrl)) {
      const direct = await resolveTmpfilesDirectUrl(pageUrl);
      if (direct) return direct;
      // last-ditch: simple /dl/ rewrite (may still work for older IDs)
      return pageUrl.replace("tmpfiles.org/", "tmpfiles.org/dl/");
    }
  } catch (e) {
    console.error("tmpfiles", e);
  }

  return null;
}
