/** Durable public file upload (avoids Vercel /tmp loss). */

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

  // tmpfiles.org
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
      // convert https://tmpfiles.org/123456/file.pdf → direct dl
      const dl = pageUrl.replace("tmpfiles.org/", "tmpfiles.org/dl/");
      return dl;
    }
  } catch (e) {
    console.error("tmpfiles", e);
  }

  // catbox.moe
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

  // litterbox 72h
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

  return null;
}
