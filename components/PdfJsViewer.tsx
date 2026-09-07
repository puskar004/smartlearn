"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  /** Absolute, relative, or data: URL that yields a PDF */
  src: string;
  title?: string;
};

function isPdfMagic(data: Uint8Array) {
  if (data.byteLength < 5) return false;
  return (
    data[0] === 0x25 &&
    data[1] === 0x50 &&
    data[2] === 0x44 &&
    data[3] === 0x46
  );
}

async function bytesFromSrc(
  src: string,
  signal: AbortSignal
): Promise<Uint8Array> {
  if (src.startsWith("data:")) {
    const comma = src.indexOf(",");
    if (comma < 0) throw new Error("Invalid data PDF");
    const meta = src.slice(0, comma);
    const payload = src.slice(comma + 1);
    let bin: string;
    if (/;base64/i.test(meta)) {
      bin = atob(payload);
    } else {
      bin = decodeURIComponent(payload);
    }
    const data = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
    return data;
  }

  const res = await fetch(src, {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    let detail = `Load failed (${res.status})`;
    try {
      const j = JSON.parse(t) as { error?: string; detail?: string };
      detail = j.detail || j.error || detail;
    } catch {
      if (t.includes("fetch failed")) detail = "Could not reach PDF host";
    }
    throw new Error(detail);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Loads PDF bytes (with timeout), then shows native browser PDF in an iframe.
 * Avoids pdf.js worker hangs that left students stuck on a spinner.
 */
export default function PdfJsViewer({ src, title }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const ac = new AbortController();
    const hardTimeout = window.setTimeout(() => ac.abort(), 22000);
    const tick = window.setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);

    setLoading(true);
    setError(null);
    setBlobUrl(null);
    setElapsed(0);

    (async () => {
      try {
        const data = await bytesFromSrc(src, ac.signal);
        if (cancelled) return;
        if (data.byteLength < 100) throw new Error("Empty PDF response");
        if (!isPdfMagic(data)) {
          throw new Error(
            "Response was not a PDF (blocked or HTML error page)"
          );
        }
        // Copy into a plain ArrayBuffer-backed view for Blob compatibility
        const copy = new Uint8Array(data.byteLength);
        copy.set(data);
        const blob = new Blob([copy.buffer], { type: "application/pdf" });
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setBlobUrl(objectUrl);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof Error ? e.name : "";
        const msg =
          name === "AbortError"
            ? "PDF took too long to load. Tap Reload, or ask teacher to re-upload."
            : e instanceof Error
              ? e.message
              : "Failed to open PDF";
        setError(msg);
        setLoading(false);
      } finally {
        window.clearTimeout(hardTimeout);
        window.clearInterval(tick);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
      window.clearTimeout(hardTimeout);
      window.clearInterval(tick);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        <p>Loading {title || "PDF"}…</p>
        {elapsed >= 6 && (
          <p className="text-[11px] text-slate-500">
            Still working ({elapsed}s)…
          </p>
        )}
      </div>
    );
  }

  if (error || !blobUrl) {
    const friendly =
      error && /ncert/i.test(error)
        ? "Could not open this class PDF. Ask teacher to re-upload."
        : error || "Could not open PDF";
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center">
        <p className="text-sm font-semibold text-rose-400">{friendly}</p>
        <p className="max-w-sm text-[11px] text-slate-400">
          Tap Reload. If it still fails, teacher must re-upload (old tmp links
          expire).
        </p>
        <a
          href={src.startsWith("data:") ? blobUrl || src : src}
          download={`${(title || "notes").replace(/[^\w]+/g, "_").slice(0, 40)}.pdf`}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
        >
          Download PDF file
        </a>
      </div>
    );
  }

  return (
    <iframe
      title={title || "PDF"}
      src={blobUrl}
      className="h-full w-full border-0 bg-slate-900"
    />
  );
}
