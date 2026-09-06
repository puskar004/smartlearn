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
      const blob = await put(`smartlearn/${filename}`, buf, {
        access: "public",
        token,
        contentType,
      });
      if (blob?.url) return blob.url;
    } catch (e) {
      console.error("vercel blob", e);
    }
  }

  // catbox.moe
  try {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append(
      "fileToUpload",
      new Blob([new Uint8Array(buf)], { type: contentType }),
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

  // litterbox (72h)
  try {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("time", "72h");
    form.append(
      "fileToUpload",
      new Blob([new Uint8Array(buf)], { type: contentType }),
      filename
    );
    const res = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
      method: "POST",
      body: form,
    });
    const text = (await res.text()).trim();
    if (/^https?:\/\//i.test(text)) return text;
  } catch (e) {
    console.error("litterbox", e);
  }

  return null;
}
